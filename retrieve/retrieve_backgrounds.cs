using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using Unity.Collections.LowLevel.Unsafe;
using UnityEngine;
using System.IO;
using UnityEngine.SceneManagement;

// CameraManager (basePath, remove body of LateUpdate())
// SceneAsync... (same as in retrieve.cs)
// AspectUtility (set _wantedAspectRatio = 1 at the start of Awake())
// LightFlicker (remove body of Awake())

/*
using System.Collections.Generic;
using UnityEngine;

public partial class LightManager : MonoBehaviour {
	public void UpdateIntensity(Biome biome, float duration) {
		foreach (KeyValuePair<Biome, List<Transform>> keyValuePair in this.LightSetupByBiome) {
			foreach (Transform transform in keyValuePair.Value) transform.gameObject.SetActive(false);
		}
		foreach (Transform transform2 in this.LightSetupByBiome[Biome.Overworld]) transform2.gameObject.SetActive(true);
		this.globalLight.intensity = FxData.GetBiomeData(biome).GlobalLight;
	}
}
*/

public partial class GameManager : MonoBehaviour {
	private IEnumerator LaunchGame() {
		Debug.Log(" > LaunchGame");
		if (this.preloader != null) {
			this.preloader.StartLoading(false);
		}
		this.UpdateLoadPercent(0f, true);
		PauseManager.Resume();
		PostProcessManager.Enable();
		UIManager.Background.Close();
		SteamIntegration.DoubleCheckGameCompleted();
		// var scenes = new string[]{ "Overworld" };
		var scenes = new string[]{ "Overworld", "Cave", "CaveExtra", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower", "CaveArena", "Snow" };

        yield return this.LoadScenes(0.1f, scenes);
        if (this.scenesToActivate.Exists((SceneAsyncActivationGO elem) => elem.Progress < 1f))
        {
            yield return this.ActivateScenes(0.9f);
            yield return null;
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
        PlayerState.CurrLocation = "Overworld";
		if (this.preloader != null)
		{
			this.preloader.EndLoading();
		}
		Fx.OnLoadSaveSlot();
		EmissionPools.RecycleAll();
		Action gameStateLoaded = GameManager.GameStateLoaded;
		if (gameStateLoaded != null)
		{
			gameStateLoaded();
		}
		SGTime.Init();
		GameSettings.OnGameStateLoaded();
        GameManager.State = GameState.Game;
        GameManager.Unfreeze();
        Player.Instance.Restore(true, true);
        Player.Instance.SetActive(false, false);

        // note: tilemap edges are cut off at 100
        var cameraSize2 = 50;
        var cameraSize = cameraSize2 * 2;
        var c = CameraManager.Camera;

        int scale = 256;
        int upscaleRes = scale * 8; // downscaled later by 2
        RenderTexture tex;
        Texture2D image;

        c.orthographicSize = cameraSize2;

        Bounds bounds;
		using(var errorsSw = new StreamWriter(CameraManager.basePath + "errors.txt", false)) try {
            bounds = Prepare();

            tex = new RenderTexture(upscaleRes, upscaleRes, 24);
            image = new Texture2D(upscaleRes, upscaleRes, TextureFormat.RGB24, false);

            Screen.SetResolution(scale, scale, false);
            PostProcessManager.Vignette(0f, 0, 0, new Color(), true);
            PostProcessManager.SetSettingLensDist(false);

            Player.Instance.transform.localScale = Vector3.zero;
            Time.timeScale = 0f;
            Application.targetFrameRate = -1;

            foreach (Location location2 in LocationManager.AllLocationsLoaded.Values) {
                location2.SetActive(true);
            }

            /* ittelevant... string res = "[";
            foreach(var b in boundss) {
                res += "{ min: [" + b.min.x + "," + b.min.y + "], max: [" + b.max.x + "," + b.max.y
                    + "], name: '" + b.name + "', names: ['" + b.minx + "', '" + b.maxx + "', '" + b.miny + "', '" + b.maxy + "'] }, ";
            }
            res += "]";
            using(var boundsSw = new StreamWriter(CameraManager.basePath + "bounds.txt", false)) {
                boundsSw.WriteLine(res);
            }
            // see at the end of the file how to preview in 36410d6a10331ed6d
            */
		}
        catch(Exception e) {
            errorsSw.WriteLine("Error during prep: " + e.ToString());
            Application.Quit();
            yield break;
        }

        c.targetTexture = tex;

        // wait for next frames
        yield return null;
        yield return null;

        {
            var start = bounds.min - Vector2.one * 10;
            var end = bounds.max + Vector2.one * 10;

            // wrong?
            var sx = (int)Mathf.Floor(start.x + cameraSize2);
            var sy = (int)Mathf.Floor(start.y + cameraSize2);
            var countX = (int)Mathf.Ceil((end.x - sx) / cameraSize);
            var countY = (int)Mathf.Ceil((end.y - sy) / cameraSize);

            // FOR SOME REASON TILEMAP IS ONLY RENDERD IN A CIRCLE AROUND THE PLAYER.
            // AND TREES!!!! WHICH ARE NOT ON THE TILEMAP BUT DISSABER TILE BY TILE, HOW???
            // AND HOUSE ROOFS...
            // AND POSITION FROM THE PREVIOUS FRAME IS USED!!
            // Probably I update position too late, and some random comonent which I couldn't find
            // does some stuff with the old player's position???????????
            // Note: not ActivationManager
            // Solution: lead player position by one frame
            var p = Player.Instance;
            p.transform.position = new Vector3(sx, sy, p.transform.position.z);
            yield return null;

            var backgroundColor = "#000000";
            var backgrounds = "";

            for(var cy = 0; cy < countY; cy++)
            for(var cx = 0; cx < countX; cx++) {
                var nextcx = cx + 1;
                var nextcy = cy;
                if(nextcx == countX) {
                    nextcx = 0;
                    nextcy++;
                }

                var px = sx + cx * cameraSize;
                var py = sy + cy * cameraSize;
                var nx = sx + nextcx * cameraSize;
                var ny = sy + nextcy * cameraSize;

                p.transform.position = new Vector3(nx, ny, p.transform.position.z);
                c.transform.position = new Vector3(px, py, -10f/* from CamPos(this Vector3 v)*/);;
                yield return null;

                using(var errorsSw = new StreamWriter(CameraManager.basePath + "errors.txt")) try {
                    RenderTexture.active = tex;
                    image.ReadPixels(new Rect(0, 0, tex.width, tex.height), 0, 0);
                    image.Apply();
                    RenderTexture.active = null;

                    bool same = true;
                    Color[] pixels = image.GetPixels();
                    foreach (Color color in pixels) {
                        if (color != pixels[0]) {
                            same = false;
                            break;
                        }
                    }
                    if(same) {
						var color = pixels[0];
                        int r = Mathf.RoundToInt(color.r * 255);
                        int g = Mathf.RoundToInt(color.g * 255);
                        int b = Mathf.RoundToInt(color.b * 255);
                        backgroundColor = $"{r:X2}{g:X2}{b:X2}";
                        continue;
                    }

                    byte[] bytes = image.EncodeToPNG();
                    var name = cx + "_" + cy + ".png";
                    System.IO.File.WriteAllBytes(CameraManager.basePath + name, bytes);
                    backgrounds += "[" + cx + "," + cy + "],\n";

                    //ScreenCapture.CaptureScreenshot(CameraManager.basePath + name);
                }
                catch(Exception e) {
                    errorsSw.WriteLine("Error during capture: " + e.ToString());
                }
            }

            using(var boundsSw = new StreamWriter(CameraManager.basePath + "backgrounds.js")) {
                boundsSw.WriteLine("var backgroundSize = " + cameraSize);
                boundsSw.WriteLine("var backgroundResolution = " + upscaleRes);
                boundsSw.WriteLine("var backgroundStart = [" + sx + ", " + sy + "]");
                boundsSw.WriteLine("var backgroundCount = [" + countX + ", " + countY + "]");
                boundsSw.WriteLine("var backgroundColor = '" + backgroundColor + "'");
                boundsSw.WriteLine("var backgrounds = [");
                boundsSw.WriteLine(backgrounds + "]");
            }

            yield return null;
        }

		Application.Quit();
		yield break;
	}

    class Bounds {
        public string minx, miny, maxx, maxy; // names of game objects
        public Vector2 min, max;
    }

	static void prepareCapture(GameObject it, Bounds bounds) {
		if(
            it.GetComponent<Enemy>() != null
            || it.GetComponent<ParticleSystem>() != null
            // || it.GetComponent<Player>() != null shaders do crazy stuff and half the objects becomes dim
            || it.GetComponent<Canvas>() != null
            || it.GetComponent<Drop>() != null
            || it.name == "UI"
        ) {
			Destroy(it);
			return;
		}

        var p = it.transform.position;

        // GroundSnow game object with tilemap collider and no composite collider
        // so I can't preview it and have no idea what it is
        // but it is located unfortunately and generates a lot of empty space
        // so exclude it from bounds considerations
        var groundSnowPos = new Vector3(-1874, 549);
        bool isGroundSnow = Vector2.Dot(p - groundSnowPos, p - groundSnowPos) < 5;

        if(it.GetComponent<Collider2D>() != null && !isGroundSnow) {
            Vector2 min = p;
            Vector2 max = p;

            Renderer renderer = it.GetComponent<Renderer>();
            if (renderer != null) {
                var itb = renderer.bounds;
                min = itb.min;
                max = itb.max;
            }

            if(min.x < bounds.min.x) bounds.minx = it.name;
            if(max.x > bounds.max.x) bounds.maxx = it.name;
            if(min.y < bounds.min.y) bounds.miny = it.name;
            if(max.y > bounds.max.y) bounds.maxy = it.name;
            bounds.min = Vector2.Min(bounds.min, min);
            bounds.max = Vector2.Max(bounds.max, max);
        }

		var cc = it.transform.GetChildCount();
        for(int i = 0; i < cc; i++) {
            prepareCapture(it.transform.GetChild(i).gameObject, bounds);
        }

	}

	static Bounds Prepare() {
        var bounds = new Bounds{
            min = new Vector2(float.PositiveInfinity, float.PositiveInfinity),
            max = new Vector2(float.NegativeInfinity, float.NegativeInfinity)
        };
        bounds.minx = bounds.maxx = bounds.miny = bounds.maxy = "";

		for(int i = 0; i < SceneManager.sceneCount; i++) {
            Scene scene = SceneManager.GetSceneAt(i);
            var objs = scene.GetRootGameObjects();
            foreach(var obj in objs) {
                prepareCapture(obj, bounds);
            }
        }

        return bounds;
	}
}


/* // HOW TO PREVIEW BOUNDS:
   const coords = paste array here

    var ji = 0, jii = 0

    for(let i = 0; i < jars.length; i++) {
        let it = jars[i]
        it.objI = it[0]
        it.size = it[1]
        it.dropType = it[2]

        const cc = coords[ji]
        if(cc == null) continue

        const oo = objects[it.objI]
        oo.parentI = -1
        oo.scale = [1, 1]
        oo.rz = 0
        oo.pos = oo.localPos = jii == 0 ? cc.min : cc.max

        objects[it.objI].components['Jar'] = it
        objects[it.objI].name = cc.name + ": (" + cc.names.join(', ') + ")"

        jii++
        if(jii == 2) {
            jii = 0
            ji++
        }
    }

    var ci = 0

    for(let i = 0; i < colliders.length; i++) {
        let it = colliders[i]
        it.objI = it[0]
        it.isTrigger = it[1]
        it.off = it[2]
        it.layer = 14
        it.type = it[4]
        if(it.type == colliderTypes.box) {
            const cc = coords[ci]
            if(cc == null) continue
            ci++
            it.size = [cc.max[0] - cc.min[0], cc.max[1] - cc.min[1]]
            const oo = objects[it.objI]
            oo.parentI = -1
            oo.scale = [1, 1]
            oo.rz = 0
            oo.pos = oo.localPos = [(cc.max[0] + cc.min[0]) * 0.5, (cc.max[1] + cc.min[1]) * 0.5]


            it.usedByComposite = it[6]
        }
        else continue

        objects[it.objI].components[colliderNames[it.type] ?? it.type] = it
    }

    for(let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        const c = obj.components

        if(c.Jar) {
            const it = c.Jar

            var el = document.createElement('span')
            el.classList.add('mark')
            el.setAttribute('data-index', i)
            el.setAttribute("data-jar-index", i)
            el.setAttribute("data-jar-type", it.dropType)
            el.style.left = cx(obj.pos[0]) + 'px'
            el.style.top = cy(obj.pos[1]) + 'px'

            var img = document.createElement('img')
            img.src = 'data/sprites/' + textures[jarTexture] + '.png'
            img.draggable = false
            el.appendChild(img)

            addMark(el)
            markers.push(i)
            continue
        }


        {
            const it = c.BoxCollider2D
            if(it) {
                const el = createCollider(it, obj)
                if(el) {
                    el.setAttribute('data-index', i)
                    el.setAttribute('data-collider-layer', it.layer)
                    addCollider(el)
                }
                continue
            }
        }
    }

*/
