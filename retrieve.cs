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
using System.Linq;

// "Overworld", "Cave", "CaveExtra", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower", "CaveArena", "Snow"
// SceneAsyncActivationGO (remove rate limit)
// CameraManager (.basePath, .sceneNames)
// GameManager (yield return this.LaunchGame(); from InitializeGame())
// CrystalDestroyable (public dropXp, public size)
// ScarabDrop (public destroyable)

public partial class GameManager : MonoBehaviour
{
	static StreamWriter errorsSw;

    delegate void Writer(BinaryWriter w, object v);
    struct Schema {
        public int type; // 0 - prim, 1 - record, 2 - array
        public Type itType;
        public int? textureIndex;

        public Writer primitiveWriter;

        public Type[] memberTypes;
        public string[] memberNames;

        public Type elementType;
    }

    struct None {};
    struct Sprite { public int sprite; }
    struct Reference { public int reference; }
    struct Any { public int schema; public object value; }

    static Sprite toSprite(int number) { return new Sprite{ sprite = number }; }
    static Reference toReference(int number) { return new Reference{ reference = number }; }

    static List<Serializer> serializers;
    static Dictionary<Type, Serializer> typeSerializers;

    abstract class Serializer {
        public int index;
        public Schema schema;
        public virtual void prepare() {}
        // returns one of: some primitive (+ string, Vector2), Record, Sprite, Reference, Any, Array
        public abstract object serialize(object it);
    }

    class RecordSerializer : Serializer {
        public Func<object, object> ser;
        public Type outType;
        Serializer[] sers;

        public override void prepare() {
            if(sers != null) return;

            var elementTypes = outType.GetGenericArguments();
            var len = elementTypes.Length;
            sers = new Serializer[len];
            for(var i = 0; i < len; i++) {
                sers[i] = getSerializer(elementTypes[i]);
            }
        }

        public override object serialize(object it) {
            prepare();
            var result = (ITuple)ser(it);
            var props = new object[sers.Length];
            for(var i = 0; i < sers.Length; i++) {
                props[i] = sers[i].serialize(result[i]);
            }
            return props;
        }
    }

    class ArraySerializer : Serializer {
        public Type elementType;
        Serializer elementSerializer;

        public override void prepare() {
            if(elementSerializer != null) return;
            elementSerializer = getSerializer(elementType);
        }

        public override object serialize(object it) {
            prepare();
            var arr = (Array)it;
            var result = new object[arr.Length];
            for(var i = 0; i < arr.Length; i++) {
                result[i] = elementSerializer.serialize(arr.GetValue(i));
            }
            return result;
        }
    }

    class PrimSerializer : Serializer {
        public override object serialize(object it) {
            return it;
        }
    }

    static Any serialized(object it) {
        var s = getSerializer(it.GetType()); // Exact match required!
        return new Any{ schema = s.index, value = s.serialize(it) };
    }

    static Serializer getSerializer(Type type) {
        Serializer it;
        if(typeSerializers.TryGetValue(type, out it)) return it;
        else if(type.IsArray) return addarr(type);

        // consider base classes
        // note: not array at this point
        for(var bt = type.BaseType; bt != null; bt = bt.BaseType) {
            if(typeSerializers.TryGetValue(bt, out it)) {
                typeSerializers.Add(type, it);
                return it;
            }
        }

        return addrec(new string[]{}, (object input) => new ValueTuple(), type, typeof(ValueTuple));
    }

    static void setupSerializer(Serializer ser, Type type, Schema schema) {
        var index = serializers.Count;
        ser.schema = schema;
        ser.index = index;
        serializers.Add(ser);
        typeSerializers.Add(type, ser);
    }

    static Serializer addrec(string[] names, Func<object, object> it, Type t, Type r) {
        if(!typeof(System.Runtime.CompilerServices.ITuple).IsAssignableFrom(r)) throw new Exception("type " + r.FullName + " is not tuple");

        var ser = new RecordSerializer();
        ser.ser = it;
        ser.outType = r;
        setupSerializer(ser, t, new Schema{ type = 1, itType = t, memberNames = names, memberTypes = r.GetGenericArguments() });

        return ser;
    }
    static Serializer addrec<T, R>(Func<T, R> it, params string[] names) {
        return addrec(names, (input) => (object)it((T)input), typeof(T), typeof(R));
    }

    static Serializer addarr(Type arrType) {
        if(!arrType.IsArray) throw new Exception("" + arrType.FullName + " is not array");

        var ser = new ArraySerializer();
        ser.elementType = arrType.GetElementType();
        setupSerializer(ser, arrType, new Schema{ type = 2, itType = arrType, elementType = ser.elementType });

        return ser;
    }

    static Serializer addprim(Type prim, Writer w) {
        var ser = new PrimSerializer();
        setupSerializer(ser, prim, new Schema{ type = 0, itType = prim, primitiveWriter = w });
        return ser;
    }
    delegate void TWriter<T>(BinaryWriter bw, T it);
    static Serializer addprim<T>(TWriter<T> w) {
        return addprim(typeof(T), (bw, it) => w(bw, (T)it));
    }

    struct Scenes {};

    public static Dictionary<GameObject, int> objects;
    public static List<GameObject> objectList;
    public static List<string> textureNames;
    public static Dictionary<long, int> textureIndices;

    static int getObjectRef(GameObject o) {
        if(o == null) return -1;
        int index;
        if(!objects.TryGetValue(o, out index)) return -1;
        else return index;
    }

    static void addObjectRef(GameObject o) {
        int index;
        if(!objects.TryGetValue(o, out index)) {
            index = objectList.Count;
            objectList.Add(o);
            objects.Add(o, index);
        }
        var cc = o.transform.GetChildCount();
        for(int i = 0; i < cc; i++) {
            addObjectRef(o.transform.GetChild(i).gameObject);
        }
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

            var textureCount = textureNames.Count;
            textureIndices.Add(key, textureCount);
            textureNames.Add(name);
            byte[] array = duplicateTexture(sprite.sprite.texture).EncodeToPNG();
            using (FileStream fileStream = new FileStream(CameraManager.basePath + "sprites/" + name + ".png", FileMode.Create, FileAccess.Write)) {
				fileStream.Write(array, 0, array.Length);
            }
			return textureCount;
        }
        catch (Exception e) {
            errorsSw.WriteLine(e.Message);
            errorsSw.WriteLine(e.StackTrace);
            errorsSw.WriteLine("");
        }

		return -1;
	}

    static object prop(object it, params string[] names) {
        var type = it.GetType();
        for(var i = 0; i < names.Length; i++) try {
            var prop = type.GetProperty(names[i], BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
            if(prop != null) {
                it = prop.GetValue(it);
                type = prop.PropertyType;
            }
            else {
                var field = type.GetField(names[i], BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                it = field.GetValue(it);
                type = field.FieldType;
            }
        } catch(Exception e) {
            throw new Exception("typeof(it) = " + it.GetType().FullName + ", type = " + type.FullName + ", i = " + i + ", props = [" + string.Join(", ", names) + "]", e);
        }
        return it;
    }

    static byte[] compactInt(int iit) {
        var bytes = new List<byte>();
        // I hope it won't crash w/ overflow for negatives ...
        uint it = iit < 0 ? (uint)int.MaxValue + (uint)-iit : (uint)iit;
        do {
            var div = it >> 7;
            var rem = it & ((1u << 7) - 1);
            bytes.Add((byte)(rem | (div == 0 ? 1u << 7 : 0u)));
            it = div;
        } while(it != 0);
        return bytes.ToArray();
    }

    static bool isPZero(float it) {
        return it == 0.0f && 1 / it > 0;
    }
    static byte[] compactFloat(float it) {
        if(isPZero(it)) {
            return new byte[]{ (byte)0b1111_1111 };
        }
        var b = BitConverter.GetBytes(it);
        if (BitConverter.IsLittleEndian) Array.Reverse(b);
        if(b.Length != 4) throw new Exception();

        if(b[0] == 0b1111_1111 || b[0] == 0b0111_1111) {
            throw new Exception("Scary numbers, not tested");
            // return new byte[]{ (byte)0b0111_11111, b[0], b[1], b[2], b[3] };
        }
        else return b;
    }

    static byte[] compactVector2(Vector2 it) {
        var px0 = isPZero(it.x);
        if(px0 && isPZero(it.y)) {
            return new byte[]{ (byte)0b0111_1111 };
        }
        var bytes = new List<byte>();
        if(px0) {
            bytes.Add((byte)0b1111_1111);
            bytes.AddRange(compactFloat(it.y));
            return bytes.ToArray();
        }

        var bx = BitConverter.GetBytes(it.x);
        if (BitConverter.IsLittleEndian) Array.Reverse(bx);
        if(bx.Length != 4) throw new Exception();

        if(bx[0] == 0b1111_1111 || bx[0] == 0b0111_1111 || bx[0] == 0b1111_1110) {
            throw new Exception("Scary numbers, not tested");
            // bytes.Add((byte)0b1111_1110);
            // fallthrough...
        }

        bytes.AddRange(bx);
        bytes.AddRange(compactFloat(it.y));
        return bytes.ToArray();
    }

    static int getSchemaI(Type t) {
        return typeSerializers[t].index;
    }
    static Schema getSchema(int i) {
        return serializers[i].schema;
    }

    void writeDynamic(BinaryWriter w, object v, int schemaI) {
        try {
			var s = getSchema(schemaI);
            if(s.type == 0) s.primitiveWriter(w, v);
            else if(s.type == 1) {
                var props = v as object[];
                if(props.Length != s.memberTypes.Length) throw new Exception("#props = " + props.Length + ", #members = " + s.memberTypes.Length);
                for(var i = 0; i < props.Length; i++) {
                    writeDynamic(w, props[i], getSchemaI(s.memberTypes[i]));
                }
            }
            else if(s.type == 2) {
                var props = v as object[];
                var elSchema = getSchemaI(s.elementType);
                w.Write(compactInt(props.Length));
                for(var i = 0; i < props.Length; i++) {
                    writeDynamic(w, props[i], elSchema);
                }
            }
            else {
                throw new Exception("type = " + s.type);
            }
        } catch(Exception e) {
            throw new Exception("Dynamic = " + v.GetType().FullName + ", " + schemaI, e);
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
        var scenes = new string[]{ "Overworld", "Cave", "CaveExtra", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower", "CaveArena", "Snow" };
        //var scenes = new string[]{ "Cave" };
        if (this.preloadScenes)
        {
            yield return this.LoadScenes(0.1f, scenes);
            if (this.scenesToActivate.Exists((SceneAsyncActivationGO elem) => elem.Progress < 1f))
            {
                yield return this.ActivateScenes(0.9f);
            }
        }
        if (!this.gameFullyLoaded)
        {
            Action gameLocationLoaded = GameManager.GameLocationLoaded;
            if (gameLocationLoaded != null)
            {
                gameLocationLoaded();
            }
            Action gamePostLoaded = GameManager.GamePostLoaded;
            if (gamePostLoaded != null)
            {
                gamePostLoaded();
            }
            this.gameFullyLoaded = true;
        }

        serializers = new List<Serializer>();
        typeSerializers = new Dictionary<Type, Serializer>();

        objects = new Dictionary<GameObject, int>();
        objectList = new List<GameObject>();
        textureNames = new List<string>();
        textureIndices = new Dictionary<long, int>();
        /*locations = new Dictionary<string, int>{
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
        };*/

        using(errorsSw = new StreamWriter(CameraManager.basePath + "errors.txt", false)) try {
            Write();
        }
        catch(Exception e) {
            errorsSw.WriteLine(e.ToString());
        }

        Application.Quit();
        yield break;
    }

    static string jsStr(string it) {
        return System.Web.HttpUtility.JavaScriptStringEncode(it, true);
    }

    private void Write() {
        for(int i = 0; i < SceneManager.sceneCount; i++) {
            Scene scene = SceneManager.GetSceneAt(i);
            var objs = scene.GetRootGameObjects();
            foreach(var obj in objs) {
                addObjectRef(obj);
            }
        }

        addprim<None>((w, v) => { throw new Exception("none is not writable"); });
        addprim<bool>((w, v) => w.Write(v ? (byte)1 : (byte)0));
        addprim<int>((w, v) => w.Write(compactInt(v)));
        addprim<float>((w, v) => w.Write(compactFloat(v)));
        addprim<string>((w, v) => {
            byte[] bytes = System.Text.Encoding.UTF8.GetBytes(v);
            for(var i = 0; i < bytes.Length; i++) if((sbyte)bytes[i] < 0) throw new Exception(v);
            if(bytes.Length == 0) w.Write((byte)(1u << 7));
            else {
                if(bytes.Length == 1 && bytes[0] == (1u << 7)) throw new Exception();
                bytes[bytes.Length - 1] = (byte)(bytes[bytes.Length - 1] | (1u << 7));
                w.Write(bytes);
            }
        });
        addprim<Reference>((w, v) => w.Write(compactInt(v.reference)));
        addprim<Sprite>((w, v) => w.Write(compactInt(v.sprite)));
        var anySerializer = addprim<Any>((w, v) => {
            w.Write(compactInt(v.schema));
            writeDynamic(w, v.value, v.schema);
        });
        addprim<Vector2>((w, v) => w.Write(compactVector2(v)));

        addrec<Jar, (int, int)>(v => ((int)prop(v, "size"), Convert.ToInt32(prop(v, "drop"))), "size", "dropType");
        addrec<Enemy, (Sprite, int, int, int)>(v => (toSprite(tryAddSprite(v.Sprite, v.gameObject.name)), v.Size, v.Tier, v.Destroyable.HpMax), "spriteI", "size", "tier", "hp");
        addrec<CrystalDestroyable, (bool, int)>(v => ((bool)prop(v, "dropXp"), Convert.ToInt32(prop(v, "size"))), "dropXp", "size");
        addrec<ScarabPickup, ValueTuple<Reference>>(v => {
            int oIndex;
            if(!objects.TryGetValue(v.destroyable.gameObject, out oIndex)) oIndex = -1;
            return new ValueTuple<Reference>(toReference(oIndex));
        }, "container");

        addrec<Collider2D, (bool, Vector2)>(v => (v.isTrigger, v.offset), "isTrigger", "offset");
        addrec<BoxCollider2D, (Vector2, bool, Collider2D)>(v => (v.size, v.usedByComposite, v), "size", "usedByComposite", "base");
        addrec<CapsuleCollider2D, (Vector2, Collider2D)>(v => (v.size, v), "size", "base");
        addrec<CircleCollider2D, (float, Collider2D)>(v => (v.radius, v), "radius", "base");
        addrec<PolygonCollider2D, (Vector2[], bool, Collider2D)>(v => (v.points, v.usedByComposite, v), "points", "usedByComposite", "base");
        addrec<CompositeCollider2D, (Vector2[][], Collider2D)>(v => {
            var pathCount = v.pathCount;
            var polygons = new Vector2[pathCount][];
            for(int i = 0; i < pathCount; i++) {
                var points = new Vector2[v.GetPathPointCount(i)];
                v.GetPath(i, points);
                polygons[i] = points;
            }
            return (polygons, v);
        }, "polygons", "base");

        addrec<Transition, ValueTuple<Reference>>(v => {
            Transition dest = v.sameLocTransition;
            if (dest == null) {
                LocationManager.TransitionsLoaded.TryGetValue(v.DestinationId, out dest);
            }
            return new ValueTuple<Reference>(toReference(getObjectRef(dest?.gameObject)));
        }, "destI");
        addrec<Destroyable, ValueTuple<bool>>(v => new ValueTuple<bool>(v.Permanent), "permanent");
        addrec<Transform, (Vector2, Vector2, float)>(v => (v.localPosition, v.localScale, v.localRotation.eulerAngles.z), "position", "scale", "rotation");

        addrec<GameObject, (string, int, Any[], GameObject[])>(v => {
            var t = v.transform;
            var children = new GameObject[t.GetChildCount()];
            for(var i = 0; i < children.Length; i++) children[i] = t.GetChild(i).gameObject;

            var c = v.GetComponents<Component>();
            var components = new Any[c.Length];
            for(var i = 0; i < c.Length; i++) components[i] = serialized(c[i]);

            return (v.name, v.layer, components, children);
        }, "name", "layer", "components", "children");
        addrec<Scene, (string, GameObject[])>(v => (v.name, v.GetRootGameObjects()), "name", "roots");
        addrec<Scenes, ValueTuple<Scene[]>>(v => {
            var scenes = new Scene[SceneManager.sceneCount];
            for(int i = 0; i < SceneManager.sceneCount; i++) {
                scenes[i] = SceneManager.GetSceneAt(i);
            }
            return new ValueTuple<Scene[]>(scenes);
        }, "scenes");

        Directory.CreateDirectory(CameraManager.basePath);
        Directory.CreateDirectory(CameraManager.basePath + "sprites/");
        var result = serialized(new Scenes());

        using(var schemasS = new StreamWriter(CameraManager.basePath + "schemas.js", false)) {
            {
                int index = -1;
                var it = FindObjectOfType<Jar>(true);
                if(it != null) index = tryAddSprite(it.gameObject.GetComponentInChildren<SpriteRenderer>(), it.gameObject.name);
                typeSerializers[typeof(Jar)].schema.textureIndex = index;
            }
            {
                int yindex = -1, nindex = -1;
                foreach(var it in FindObjectsOfType<CrystalDestroyable>(true)) {
                    if(it.dropXp) {
                        if(yindex == -1) yindex = tryAddSprite(it.gameObject.GetComponentInChildren<SpriteRenderer>(), it.gameObject.name);
                    }
                    else {
                        if(nindex == -1) nindex = tryAddSprite(it.gameObject.GetComponentInChildren<SpriteRenderer>(), it.gameObject.name);
                    }
                    if(yindex != -1 && nindex != -1) break;
                }
                typeSerializers[typeof(CrystalDestroyable)].schema.textureIndex = yindex;
                schemasS.WriteLine("var crystalDestroyableTexture2 = " + nindex);
            }
            {
                int index = -1;
                var it = FindObjectOfType<ScarabPickup>(true);
                if(it != null) index = tryAddSprite(it.gameObject.GetComponentNamed<SpriteRenderer>("FullImage", true), it.gameObject.name);
                typeSerializers[typeof(ScarabPickup)].schema.textureIndex = index;
            }
            schemasS.WriteLine("var xpForCrystalSize = [" + String.Join(", ", PlayerData.DestroyableCrystalValue) + "]");

            schemasS.WriteLine("var textureNames = [");
            for(var i = 0; i < textureNames.Count; i++) {
                schemasS.WriteLine(jsStr(textureNames[i]) + ",");
            }
            schemasS.WriteLine("]");

            schemasS.WriteLine("var schemas = [");
            for(var i = 0; i < serializers.Count; i++) {
                var it = serializers[i].schema;
                var name = jsStr(it.itType.FullName);
                if(it.type == 1 && it.memberTypes.Length == 0) {
                    schemasS.WriteLine(name + ",");
                }
                else {
                    schemasS.Write("{ type: " + it.type + ", name: " + name);
                    if(it.textureIndex != null) {
                        schemasS.Write(", textureI: " + it.textureIndex);
                    }
                    if(it.type == 1) {
                        schemasS.Write(", members: [" + string.Join(", ", it.memberNames.Select(t => jsStr(t))) + "]");
                        schemasS.Write(", membersT: [" + string.Join(", ", it.memberTypes.Select(t => typeSerializers[t].index)) + "]");
                    }
                    if(it.type == 2) {
                        schemasS.Write(", elementT: " + typeSerializers[it.elementType].index);
                    }
                    schemasS.WriteLine(" },");
                }
            }
            schemasS.WriteLine("]");

        }

        using (FileStream fs = new FileStream(CameraManager.basePath + "objects.bp", FileMode.Create, FileAccess.Write))
        using (BinaryWriter bw = new BinaryWriter(fs)) {
            writeDynamic(bw, result, anySerializer.index);
        }
    }
}
