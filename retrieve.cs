using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityEngine;
using System.IO;
using UnityEngine.SceneManagement;
using System.Collections.Generic;
using UnityEngine.Tilemaps;
using System.Runtime.InteropServices;
using System.Reflection;

// "Overworld", "Cave", "CaveExtra", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower", "CaveArena", "Snow"
// SceneAsyncActivationGO (remove rate limit)
// CameraManager (.basePath, .sceneNames)
// GameManager (yield return this.LaunchGame(); from InitializeGame())
// CrystalDestroyable (public dropXp, public size)
// ScarabDrop (public destroyable)

public partial class GameManager : MonoBehaviour
{
	static StreamWriter errorsSw;
    static int snone, sbool, sint, sfloat, sstring, svector2, sobjref, ssprite, sany;

    struct Schema {
        public int type; // 0 - prim, 1 - record, 2 - array
        public string name;
        public int[] memberSchemas;
        public int elementSchema;
    }

    static List<Schema> schemas;

    static int addS(Schema s) {
        var index = schemas.Count;
        schemas.Add(s);
        return index;
    }

    static int addSPrim(String name) {
        return addS(new Schema{ type = 0, name = name });
    }

    static int addSRecord(String name, int[] memberSchemas) {
        return addS(new Schema{ type = 1, name = name, memberSchemas = memberSchemas });
    }

    static int addSarray(int elementSchema) {
        return addS(new Schema{ type = 2, elementSchema = elementSchema });
    }


    static string prepString(StreamWriter sw, string str) {
        return str.Replace("\\", "\\\\").Replace("\n", "\\n") + "\n";
    }


    struct Dynamic {
        public Dynamic[] props;
        public object value;
        public int schema;
    }

    static Dynamic dprops(int schema, params Dynamic[] props) {
        return new Dynamic{ props = props, schema = schema };
    }

    static Dynamic dprops(int schema, List<Dynamic> props) {
        return new Dynamic{ props = props.ToArray(), schema = schema };
    }

    static Dynamic dval(int schema, object val) {
        return new Dynamic{ value = val, schema = schema };
    }

    class Context {}

    interface Serializer {
        int schema{ get; }
        Dynamic serialize(object it, Context c);
    }

    static Dictionary<Type, int> typeSchema;

    static Dynamic serializeUnknown(object it, Context c) {
        if(typeSchema == null) typeSchema = new Dictionary<Type, int>();

        var type = it.GetType();
        int s;
        if(!typeSchema.TryGetValue(type, out s)) {
            s = addSRecord(type.FullName, new int[]{});
            typeSchema[type] = s;
        }
        return dprops(s);
    }

    class AnySerializer : Serializer {
        public List<Serializer> serializers;
        public int schema { get{ return sany; } }

        public AnySerializer() {
            serializers = new Dictionary<Type, Serializer>();
        }

        public void add<T>(Serializer it) {
            var type = typeof(T);
            if(serializers.ContainsKey(type)) throw new Exception("Duplicate type " + type.Name);
            serializers[type] = it;
        }

        public void addrec<T>(params Serializer[] sers) {
            add<T>(rec(typeof(T).FullName, sers));
        }

        public Dynamic serialize(object it, Context c) {
            Serializer ser;
            if(serializers.TryGetValue(it.GetType(), out ser)) return dprops(sany, ser.serialize(it, c));
            else return dprops(sany, serializeUnknown(it, c));
        }
    }

    class RecordSerializer : Serializer {
        Serializer[] sers;
        public int schema{ get; set; }

        public RecordSerializer(string name, Serializer[] sers) {
            this.sers = sers;
            var schemas = new int[sers.Length];
            for(var i = 0; i < sers.Length; i++) {
                schemas[i] = sers[i].schema;
            }
            schema = addSRecord(name, schemas);
        }

        public Dynamic serialize(object it, Context c) {
            var len = sers != null ? sers.Length : 0;
            var props = new Dynamic[len];
            for(var i = 0; i < len; i++) {
                props[i] = sers[i].serialize(it, c);
            }
            return dprops(schema, props);
        }
    }

    class ArraySerializer : Serializer {
        Serializer ser;
        public int schema{ get; set; }

        public ArraySerializer(Serializer ser) {
            this.ser = ser;
            schema = addSarray(ser.schema);
        }

        public Dynamic serialize(object it, Context c) {
            if(it is Array arr) {
                var props = new Dynamic[arr.Length];
                var i = 0;
                foreach(var el in arr) {
                    props[i] = ser.serialize(el, c);
                    i++;
                }
                return dprops(schema, props);
            }
            throw new Exception("element is not array");
        }
    }

    class PropSerializer : Serializer {
        String[] props;
        MemberInfo[] membersInfo;
        Serializer post;
        public int schema{ get{ return post.schema; } }

        public PropSerializer(String[] props, Serializer post) {
            this.props = props;
            this.post = post;
        }

        void prepare(object it) {
            if(membersInfo != null) return;
            membersInfo = new MemberInfo[props.Length];

            var type = it.GetType();
            for(var i = 0; i < props.Length; i++) try {
                MemberInfo member = type.GetProperty(props[i], BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                Type newType;
                if(member == null) {
                    member = type.GetField(props[i], BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    newType = (member as FieldInfo).FieldType;
                }
                else {
                    newType = (member as PropertyInfo).PropertyType;
                }
                membersInfo[i] = member;
                type = newType;
            } catch(Exception e) {
				throw new Exception("typeof(it) = " + it.GetType().FullName + ", type = " + type.FullName + ", i = " + i + ", props = [" + string.Join(", ", props) + "]", e);
			}
        }

        public Dynamic serialize(object it, Context c) {
            prepare(it);
            for(var i = 0; i < membersInfo.Length; i++) {
                var mi = membersInfo[i];
                if(mi is PropertyInfo pi) it = pi.GetValue(it);
                else if(mi is FieldInfo fi) it = fi.GetValue(it);
                else throw new Exception();
            }
            return post.serialize(it, c);
        }
    }

    class PrimSerializer<T> : Serializer {
        public int schema{ get; set; }
        public Dynamic serialize(object it, Context c) {
            if(it is T) return dval(schema, it);
            else throw new Exception(it.GetType().FullName + " is not " + typeof(T).FullName);
        }
    }

    class ConvSerializer<T> : Serializer {
        Serializer serializer;
        public int schema{ get; set; }

        public ConvSerializer(Serializer s) {
            serializer = s;
        }

        public Dynamic serialize(object it, Context c) {
            try {
                return serializer.serialize(Convert.ChangeType(it, typeof(T)), c);
            }
            catch(Exception e) {
                throw new Exception("typeof(it) = " + it?.GetType()?.FullName + ", to = " + typeof(T).FullName, e);
            }
        }
    }

    class Vec3toVec2Serializer : Serializer {
        Serializer serializer;
        public int schema{ get; set; }

        public Vec3toVec2Serializer(Serializer s) {
            serializer = s;
        }

        public Dynamic serialize(object it, Context c) {
            return serializer.serialize((Vector2)(Vector3)it, c);
        }
    }

    static ConvSerializer<T> primConv<T>() {
        return new ConvSerializer<T>(prim<T>());
    }

    static Serializer toVec2;

    static RecordSerializer rec(string name, params Serializer[] sers) {
        return new RecordSerializer(name, sers);
    }

    static Serializer prim<T>() {
        if(typeof(T) == typeof(bool)) return new PrimSerializer<bool>{ schema = sbool };
        if(typeof(T) == typeof(int)) return new PrimSerializer<int>{ schema = sint };
        if(typeof(T) == typeof(float)) return new PrimSerializer<float>{ schema = sfloat };
        if(typeof(T) == typeof(string)) return new PrimSerializer<string>{ schema = sstring };
        if(typeof(T) == typeof(Vector2)) return new PrimSerializer<Vector2>{ schema = svector2 };
        else throw new Exception("type " + typeof(T).FullName + " is not primitive");
    }

    static PropSerializer prop(Serializer post, params String[] names) {
        return new PropSerializer(names, post);
    }

    static PropSerializer propPrim<T>(params String[] names) {
        return prop(prim<T>(), names);
    }

    static Serializer componentSerializer;

    class GameObjectSerializer : Serializer {
        Serializer propS, componentsSerializer, childrenSerializer;
        public int schema{ get; set; }

        public GameObjectSerializer() {
            propS = rec(
                "GameObjectProps",
                propPrim<string>("name"), prop(toVec2, "transform", "localPosition"),
                prop(toVec2, "transform", "localScale"),
                propPrim<float>("transform", "localRotation", "eulerAngles", "z")
            );
            componentsSerializer = new ArraySerializer(componentSerializer);
            var schemas = new int[3]{ propS.schema, componentsSerializer.schema, 0 };
            childrenSerializer = new ChildrenSerializer(this);
            schema = addSRecord("GameObject", schemas);
            schemas[2] = childrenSerializer.schema;
        }

        public Dynamic serialize(object it, Context c) {
            var o = it as GameObject;
            var i = getObjectRef(o);
            var prop = propS.serialize(it, c);
            // note: order is important! Children first, then components, so that object refs are filled!
            var children = childrenSerializer.serialize(it, c);
            var components = componentsSerializer.serialize(o.GetComponents<Component>(), c);
            return dprops(schema, prop, components, children);
        }
    }

    class ChildrenSerializer : Serializer {
        Serializer gameObjectS;
        public int schema{ get; set; }

        public ChildrenSerializer(Serializer gameObjectS) {
            this.gameObjectS = gameObjectS;
            schema = addSarray(gameObjectS.schema);
        }

        public Dynamic serialize(object it, Context c) {
            var o = it as GameObject;
            var cc = o.transform.GetChildCount();
            var props = new Dynamic[cc];
            for(int i = 0; i < cc; i++) {
                props[i] = gameObjectS.serialize(o.transform.GetChild(i).gameObject, c);
            }
            return dprops(schema, props);
        }
    }

    class RootObjectsSerializer : Serializer {
        Serializer objectsSerializer;
        public int schema{ get; set; }

        public RootObjectsSerializer() {
            objectsSerializer = new GameObjectSerializer();
            schema = addSarray(objectsSerializer.schema);
        }

        public Dynamic serialize(object it, Context c) {
            var scene = (Scene)it;
            var objs = scene.GetRootGameObjects();
            var props = new Dynamic[objs.Length];
            for(var i = 0; i < objs.Length; i++) {
                props[i] = objectsSerializer.serialize(objs[i], c);
            }
            return dprops(schema, props);
        }
    }

    class ScenesSerializer : Serializer {
        Serializer sceneSerializer;
        public int schema{ get; set; }

        public ScenesSerializer() {
            sceneSerializer = rec("Scene", propPrim<string>("name"), new RootObjectsSerializer());
            schema = addSarray(sceneSerializer.schema);
        }

        public Dynamic serialize(object it, Context c) {
            var props = new Dynamic[SceneManager.sceneCount];
            for(int i = 0; i < SceneManager.sceneCount; i++) {
                Scene scene = SceneManager.GetSceneAt(i);
                props[i] = sceneSerializer.serialize(scene, c);
            }
            return dprops(schema, props);
        }
    }

    class EnemySpriteSerializer : Serializer {
        public int schema{ get{ return ssprite; } }

        public Dynamic serialize(object it, Context c) {
            var enemy = it as Enemy;
            SpriteRenderer sprite = enemy.Sprite;
            int spriteIndex = tryAddSprite(sprite, enemy.gameObject.name);
            return dval(schema, spriteIndex);
        }
    }

    class ScarabRefSerializer : Serializer {
        public int schema{ get{ return sobjref; } }

        public Dynamic serialize(object it, Context c) {
            var scarab = it as ScarabPickup;
            int oIndex;
            if(!objects.TryGetValue(scarab.destroyable.gameObject, out oIndex)) oIndex = -1;
            return dval(schema, oIndex);
        }
    }

    class CompositePointsSerializer : Serializer {
        public int schema{ get; set; }

        public CompositePointsSerializer() {
            schema = addSarray(polygonSerializer.schema);
        }

        public Dynamic serialize(object it, Context c) {
            var coll = it as CompositeCollider2D;
            int pathCount = coll.pathCount;
            var props = new Dynamic[pathCount];
            for(int i = 0; i < pathCount; i++) {
                var points = new Vector2[coll.GetPathPointCount(i)];
                coll.GetPath(i, points);
                props[i] = polygonSerializer.serialize(points, c);
            }
            return dprops(schema, props);
        }
    }

    class TransitionDestSerializer : Serializer {
        public int schema{ get{ return sobjref; } }

        public Dynamic serialize(object it, Context c) {
            var transition = it as Transition;
            string destLoc = transition.destinationLocation;
            int destLocIndex;
            if(!locations.TryGetValue(destLoc, out destLocIndex)) destLocIndex = -1;

            bool sameLoc = true;
            Transition dest = transition.sameLocTransition;
            if (dest == null) {
                sameLoc = false;
                LocationManager.TransitionsLoaded.TryGetValue(transition.DestinationId, out dest);
            }
            int destIndex;
            if(!dest || !objects.TryGetValue(dest.gameObject, out destIndex)) destIndex = -1;

            return dval(schema, destIndex);
        }
    }

    static Serializer polygonSerializer;


    public static Dictionary<GameObject, int> objects;
    public static List<GameObject> objectList;
    public static Dictionary<string, int> knownColliders;
    public static Dictionary<String, int> locations;
    public static Dictionary<long, int> textureIndices;
    public static int textureCount;

    static int getObjectRef(GameObject o) {
        int index;
        if(objects.TryGetValue(o, out index)) return index;
        index = objectList.Count;
        objectList.Add(o);
        objects.Add(o, index);
        return index;
    }

    static Texture2D duplicateTexture(Texture2D source)
    {
        RenderTexture temporary = RenderTexture.GetTemporary(source.width, source.height, 0, RenderTextureFormat.Default, RenderTextureReadWrite.Linear);
        Graphics.Blit(source, temporary);
        RenderTexture active = RenderTexture.active;
        RenderTexture.active = temporary;
        Texture2D texture2D = new Texture2D(source.width, source.height);
        texture2D.ReadPixels(new Rect(0f, 0f, (float)temporary.width, (float)temporary.height), 0, 0);
        texture2D.Apply();
        RenderTexture.active = active;
        RenderTexture.ReleaseTemporary(temporary);
        return texture2D;
    }

	static int tryAddSprite(SpriteRenderer sprite, string name) {
		if(sprite == null) return -1;

		try {
			long key = sprite.sprite.texture.GetNativeTexturePtr().ToInt64();
			int existingIndex;
			if(textureIndices.TryGetValue(key, out existingIndex)) {
				return existingIndex;
            }

            textureIndices.Add(key, textureCount);
            var spriteIndex = textureCount;
            textureCount++;
            byte[] array = duplicateTexture(sprite.sprite.texture).EncodeToPNG();
            using (FileStream fileStream = new FileStream(CameraManager.basePath + "sprites/" + name + ".png", FileMode.Create, FileAccess.Write)) {
				fileStream.Write(array, 0, array.Length);
            }
			return spriteIndex;
        }
        catch (Exception e) {
            errorsSw.WriteLine(e.Message);
            errorsSw.WriteLine(e.StackTrace);
            errorsSw.WriteLine("");
        }

		return -1;
	}

    static byte[] compactInt(int iit) {
        var bytes = new List<byte>();
        uint it = iit < 0 ? (uint)int.MaxValue + (uint)-iit : (uint)iit;
        do {
            var div = it >> 7;
            var rem = it & ((1u << 7) - 1);
            bytes.Add((byte)(rem | (div == 0 ? 1u << 7 : 0u)));
            it = div;
        } while(it != 0);
        return bytes.ToArray();
    }

    static byte[] compactFloat(float it) {
        var b = BitConverter.GetBytes(it);
        if(b.Length != 4) throw new Exception();
        return b;
    }

    static void writeDynamic(BinaryWriter sw, Dynamic it) {
        var c = it.schema;
        var s = schemas[c];
        if(s.type == 1 || s.type == 2) {
            if(s.type == 2) {
                sw.Write(compactInt(it.props.Length));
            }
            foreach(var d in it.props) {
                writeDynamic(sw, d);
            }
        }
        else {
            var v = it.value;
            if(c == snone) throw new Exception("none is not writable");
            else if(c == sbool) sw.Write((bool)v ? "1" : "0");
            else if(c == sint) sw.Write(compactInt((int)v));
            else if(c == sfloat) sw.Write(compactFloat((float)v));
            else if(c == sstring) {
                byte[] bytes = System.Text.Encoding.UTF8.GetBytes((string)v);
                for(var i = 0; i < bytes.Length; i++) if((sbyte)bytes[i] < 0 || bytes[0] == 0) throw new Exception((string)v);
                if(bytes.Length == 0) {
                    sw.Write((byte)0);
                }
                else {
                    bytes[bytes.Length - 1] = (byte)(bytes[bytes.Length - 1] | (1u << 7));
                    sw.Write(bytes);
                }
            }
            else if(c == svector2) {
                sw.Write(compactFloat(((Vector2)v).x));
                sw.Write(compactFloat(((Vector2)v).y));
            }
            else if(c == sobjref || c == ssprite) sw.Write(compactInt((int)v));
            else if(c == sany) {
                var ps = it.props;
                if(ps.Length != 1) throw new Exception("any must have length (" + ps.Length + ") == 1");
                var p = ps[0];
                sw.Write(compactInt(p.schema));
                writeDynamic(sw, p);
            }
            else throw new Exception("no type " + c);
        }
    }

    private IEnumerator LaunchGame()
    {
        Debug.Log(" > LaunchGame");
        if (this.preloader != null)
        {
            this.preloader.StartLoading(false);
        }
        this.UpdateLoadPercent(0f, true);
        PauseManager.Resume();
        PostProcessManager.Enable();
        UIManager.Background.Close();
        SteamIntegration.DoubleCheckGameCompleted();
        if (this.preloadScenes)
        {
            yield return this.LoadScenes(0.1f, new string[]{ "Cave" });
            if (this.scenesToActivate.Exists((SceneAsyncActivationGO elem) => elem.Progress < 1f))
            {
                yield return new WaitForSecondsRealtime(0.1f);
                yield return this.ActivateScenes(0.9f);
                yield return null;
            }
        }
        if (!this.gameFullyLoaded)
        {
            Action gameLocationLoaded = GameManager.GameLocationLoaded;
            if (gameLocationLoaded != null)
            {
                gameLocationLoaded();
            }
            yield return null;
            Action gamePostLoaded = GameManager.GamePostLoaded;
            if (gamePostLoaded != null)
            {
                gamePostLoaded();
            }
            yield return null;
            this.gameFullyLoaded = true;
        }

        objects = new Dictionary<GameObject, int>();
        objectList = new List<GameObject>();
        textureIndices = new Dictionary<long, int>();
        locations = new Dictionary<string, int>{
            { "Overworld", 0 },
            { "Cave", 1 },
            { "CaveExtra", 2 },
            { "Dungeon1", 3 },
            { "Dungeon2", 4 },
            { "Dungeon3", 5 },
            { "Dungeon4", 6 },
            { "Dungeon5", 7 },
            { "Temple1", 8 },
            { "Temple2", 9 },
            { "Temple3", 10 },
            { "Tower", 11 },
            { "CaveArena", 12 },
            { "Snow", 13 }
        };
        knownColliders = new Dictionary<string, int>{
            { "BoxCollider2D", 0 },
            { "CapsuleCollider2D", 1 },
            { "CircleCollider2D", 2 },
            { "PolygonCollider2D", 3 },
            { "CompositeCollider2D", 4 },
            { "TilemapCollider2D", 5 }
        };


        schemas = new List<Schema>();
        snone = addSPrim("$none");
        sbool = addSPrim("bool");
        sint = addSPrim("int");
        sfloat = addSPrim("float");
        sstring = addSPrim("string");
        svector2 = addSPrim("vector2");
        sobjref = addSPrim("$objref");
        ssprite = addSPrim("$sprite");
        sany = addSPrim("$any");

        toVec2 = new Vec3toVec2Serializer(prim<Vector2>());
        //spriteSer = new SpriteSerializer();
        polygonSerializer = new ArraySerializer(prim<Vector2>());

        var cs = new AnySerializer();
        componentSerializer = cs;
        cs.addrec<Jar>(prop(primConv<int>(), "size"), prop(primConv<int>(), "drop"));
        cs.addrec<Enemy>(
            new EnemySpriteSerializer(), propPrim<int>("Size"), propPrim<int>("Tier"),
            propPrim<int>("Destroyable", "HpMax")
        );
        cs.addrec<CrystalDestroyable>(propPrim<bool>("dropXp"), prop(primConv<int>(), "size"));
        cs.addrec<ScarabPickup>(new ScarabRefSerializer());

        var colS = new AnySerializer();
        colS.addrec<BoxCollider2D>(propPrim<Vector2>("size"), propPrim<bool>("usedByComposite"));
        colS.addrec<CapsuleCollider2D>(propPrim<Vector2>("size"), prop(primConv<int>(), "direction"));
        colS.addrec<CircleCollider2D>(propPrim<int>("radius"));
        colS.addrec<PolygonCollider2D>(prop(polygonSerializer, "points"), propPrim<bool>("usedByComposite"));
        colS.addrec<CompositeCollider2D>(new CompositePointsSerializer());

        cs.addrec<Collider2D>(
            propPrim<bool>("isTrigger"), propPrim<Vector2>("offset"),
            prop(primConv<int>(), "layer"), colS
        );

        cs.addrec<Transition>(new TransitionDestSerializer());
        cs.addrec<Destroyable>(propPrim<bool>("Permanent"));


        Directory.CreateDirectory(CameraManager.basePath);
        Directory.CreateDirectory(CameraManager.basePath + "sprites/");
        using(errorsSw = new StreamWriter(CameraManager.basePath + "errors.txt", false)) {
            try {
                var ss = new ScenesSerializer();
                var result = ss.serialize(null, null);

                using(var schemasS = new StreamWriter(CameraManager.basePath + "schemas.txt", false)) {
                    schemasS.WriteLine("var schemas = [");
                    for(var i = 0; i < schemas.Count; i++) {
                        var it = schemas[i];
                        schemasS.Write("[" + it.type);
                        if(it.type == 0 || it.type == 1) {
                            schemasS.Write(", " + System.Web.HttpUtility.JavaScriptStringEncode(it.name, true));
                        }
                        if(it.type == 1 && it.memberSchemas.Length > 0) {
                            schemasS.Write(", [" + string.Join(", ", it.memberSchemas) + "]");
                        }
                        if(it.type == 2) {
                            schemasS.Write(", " + it.elementSchema);
                        }
                        schemasS.WriteLine("],");
                    }
                    schemasS.WriteLine("]");
                }

				using (FileStream fs = new FileStream(CameraManager.basePath + "objects.bp", FileMode.Create, FileAccess.Write))
				using (BinaryWriter sw = new BinaryWriter(fs)) {
                    writeDynamic(sw, result);
                }
            }
            catch(Exception e) {
                errorsSw.WriteLine(e.ToString());
            }
        }

        Application.Quit();
        yield break;
    }
}
