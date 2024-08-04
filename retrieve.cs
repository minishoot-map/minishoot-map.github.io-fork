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

// "Overworld", "Cave", "CaveExtra", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower", "CaveArena", "Snow"
// SceneAsyncActivationGO (remove rate limit)
// CameraManager (.basePath, .sceneNames)
// GameManager (yield return this.LaunchGame(); from InitializeGame())
// CrystalDestroyable (public dropXp)
// ScarabDrop (public destroyable)

public partial class GameManager : MonoBehaviour
{
	public static StreamWriter errorsSw, sw;

    public class JsObject {
        private Dictionary<string, JsObject> dictionary;
        private List<JsObject> list;
        private object val;
        private int active = -1;

        public JsObject(int expected) {
            setActive(expected);
        }

        public static JsObject from(object value) {
            if(value != null && value.GetType().IsArray) {
                var o = new JsObject(1);
                foreach(var value2 in (value as Array)) {
                    o.add(value2);
                }
                return o;
            }
            else {
                var o = new JsObject(2);
                o.val = value;
                return o;
            }
        }

		public static JsObject arr(params object[] args) {
			return from(args);
		}

		public JsObject this[string name] {
			get {
                setActive(0);
				JsObject res;
				if(!dictionary.TryGetValue(name, out res)) {
					res = new JsObject(-1);
					dictionary.Add(name, res);
				}
				return res;
			}
			set {
                setActive(0);
				dictionary[name] = value;
			}
		}

        private void setActive(int expected) {
            if(active == -1) {
				active = expected;
                if(expected == 0) dictionary = new Dictionary<string, JsObject>();
                else if(expected == 1) list = new List<JsObject>();
            }
            else if(active != expected) throw new Exception("Different active: " + active + " for " + expected);
        }

		public void add(object value) {
            setActive(1);
            if(value is JsObject) {
                list.Add(value as JsObject);
            }
			else {
				list.Add(JsObject.from(value));
			}
		}

        public JsObject addObj(params object[] value) {
            setActive(1);
            var jo = JsObject.from(value);
            list.Add(jo);
            return jo;
        }

		public void write(StreamWriter sw, int level) {
			if(active == 0) {
				if(level == 0) {
					foreach(var kv in dictionary) {
						sw.Write("var " + kv.Key + " = ");
						kv.Value.write(sw, level + 1);
						sw.WriteLine("");
					}
				}
				else throw new NotImplementedException();
			}
			else if(active == 1) {
				if(level == 0) throw new NotImplementedException();

				if(level == 1) sw.WriteLine('[');
				else sw.Write('[');

				for(var i = 0; i < list.Count; i++) {
					list[i].write(sw, level + 1);
					if(i != list.Count-1) sw.Write(',');
                    if(level == 1) sw.Write('\n');
				}

				sw.Write(']');
			}
			else if(active == 2) {
				if(level == 0) throw new NotImplementedException();

				if(val is bool) sw.Write((bool)val ? "true" : "false");
				else if(val is int) sw.Write((int)val);
				else if(val is float) sw.Write((float)val);
				else if(val is string) sw.Write(System.Web.HttpUtility.JavaScriptStringEncode((string)val, true));
				else if(val is Vector2) sw.Write("[" + ((Vector2)val).x + "," + ((Vector2)val).y + "]");
				else throw new Exception("Unknown type: " + val.GetType().Name);
			}
            else {
                sw.Write("[]");
            }
		}
    }

    public static Dictionary<GameObject, int> objects;
    public static List<GameObject> objectList;
    public static Dictionary<string, int> knownColliders;
    public static Dictionary<String, int> locations;
    public static Dictionary<long, int> textureIndices;
    public static int objectCount, textureCount;
    public JsObject s;

    private Texture2D duplicateTexture(Texture2D source)
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

	int tryAddSprite(SpriteRenderer sprite, string name) {
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
            s["textures"].add(name);
            byte[] array = this.duplicateTexture(sprite.sprite.texture).EncodeToPNG();
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

    public void addObject(int parentI, GameObject o) {
        try {
            addObject0(parentI, o);
        } catch(Exception e) {
            errorsSw.WriteLine(e.Message);
            errorsSw.WriteLine(e.StackTrace);
            errorsSw.WriteLine("");
        }
    }

    public void addObject0(int parentI, GameObject o) {
        if(objects.ContainsKey(o)) return;
        int index = objectCount;
        objects.Add(o, index);
        objectCount++;
        objectList.Add(o);

        var comps = JsObject.arr();
        foreach(var c in o.GetComponents<Component>()) {
            comps.add(c.GetType().Name);
        }
		s["objects"].addObj(o.name, parentI, (Vector2)o.transform.localPosition, (Vector2)o.transform.position, o.transform.localRotation.eulerAngles.z, (Vector2)o.transform.localScale, comps);

        var cc = o.transform.GetChildCount();
        for(int i = 0; i < cc; i++) {
            addObject(index, o.transform.GetChild(i).gameObject);
        }
    }

    public void addComponents(int index) {
        try {
            addComponents0(index);
        } catch(Exception e) {
            errorsSw.WriteLine(e.Message);
            errorsSw.WriteLine(e.StackTrace);
            errorsSw.WriteLine("");
        }
    }

    static string removeFromEndIfMatches(string source, string valueToRemove) {
        if (source.EndsWith(valueToRemove)) {
            return source.Substring(0, source.Length - valueToRemove.Length);
        }
        return source;
    }

    public void addComponents0(int index) {
        var o = objectList[index];

        foreach(var comp in o.GetComponents<Component>()) {
            switch(comp) {
                case Jar jar: {
                    s["jars"].addObj(index, jar.Size, (int)jar.DropType);
                } break;
                case Enemy enemy: {
                    SpriteRenderer sprite = enemy.Sprite;
                    int spriteIndex = tryAddSprite(sprite, o.name);
                    s["enemies"].addObj(index, enemy.Size, enemy.Tier, enemy.Destroyable.HpMax, spriteIndex);
                } break;
                case CrystalDestroyable cDestroyable: {
                    s["crystalDestroyables"].addObj(index, cDestroyable.dropXp, cDestroyable.Size);
                } break;
                case ScarabPickup scarab: {
                    int oIndex;
                    if(!objects.TryGetValue(scarab.destroyable.gameObject, out oIndex)) oIndex = -1;
                    s["scarabs"].addObj(index, oIndex);
                } break;
                case Collider2D collider: {
                    object colliderName;
                    var name = collider.GetType().Name;
                    int colliderId;
                    if(knownColliders.TryGetValue(name, out colliderId)) colliderName = colliderId;
                    else colliderName = name;

                    var coll = JsObject.arr(index, collider.isTrigger, collider.offset, o.layer, colliderName);
                    s["colliders"].add(coll);

                    if(collider is BoxCollider2D) {
                        var c = collider as BoxCollider2D;
                        coll.add(c.size);
                        coll.add(c.usedByComposite);
                    }
                    else if(collider is CapsuleCollider2D) {
                        var c = collider as CapsuleCollider2D;
                        coll.add(c.size);
                        coll.add(c.direction == CapsuleDirection2D.Vertical);
                    }
                    else if(collider is CircleCollider2D) {
                        var c = collider as CircleCollider2D;
                        coll.add(c.radius);
                    }
                    else if(collider is PolygonCollider2D) {
                        var c = collider as PolygonCollider2D;
                        coll.add(c.usedByComposite);
                        coll.add(c.points);
                    }
                    else if(collider is CompositeCollider2D) {
                        var cd = JsObject.arr();

                        var c = collider as CompositeCollider2D;
                        int pathCount = c.pathCount;
                        for(int i = 0; i < pathCount; i++) {
                            var points = new Vector2[c.GetPathPointCount(i)];
                            c.GetPath(i, points);
                            cd.add(points);
                        }

                        coll.add(cd);
                    }
                } break;
                case Transition transition: {
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

                    s["transitions"].addObj(index, sameLoc, destLocIndex, destIndex);
                } break;
                case Destroyable destroyable: {
                    s["destroyables"].addObj(index, destroyable.Permanent);
                } break;
			}
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
            yield return this.LoadScenes(0.1f, CameraManager.sceneNames);
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

        s = new JsObject(0);

        using(errorsSw = new StreamWriter(CameraManager.basePath + "errors.txt", false)) {
            for(int i = 0; i < SceneManager.sceneCount; i++) {
				Scene scene = SceneManager.GetSceneAt(i);
				foreach(var obj in scene.GetRootGameObjects()) {
					addObject(-1 - i, obj);
                }
            }

			for(int i = 0; i < objectList.Count; i++) {
				addComponents(i);
            }

			try {
				using(sw = new StreamWriter(CameraManager.basePath + "objects.js", false)) {
                    {
                        int index = -1;
                        var it = FindObjectOfType<Jar>(true);
                        if(it != null) index = tryAddSprite(it.gameObject.GetComponentInChildren<SpriteRenderer>(), it.gameObject.name);
                        s["jarTexture"] = JsObject.from(index);
                    }
                    {
                        int index = -1;
                        foreach(var it in FindObjectsOfType<CrystalDestroyable>(true)) {
                            if(!it.dropXp) continue;
                            if(it != null) index = tryAddSprite(it.gameObject.GetComponentInChildren<SpriteRenderer>(), it.gameObject.name);
                            if(index != -1) break;
                        }
                        s["crystalDestroyableTexture"] = JsObject.from(index);
                    }
					s["xpForCrystalSize"] = JsObject.from(PlayerData.DestroyableCrystalValue);

					s.write(sw, 0);
				}
			}
			catch(Exception e) {
				errorsSw.WriteLine(e.Message);
				errorsSw.WriteLine(e.StackTrace);
				errorsSw.WriteLine("");
			}
		}

        Application.Quit();
        yield break;
    }
}
