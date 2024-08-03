using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityEngine;
using System.IO;
using UnityEngine.SceneManagement;
using System.Collections.Generic;
using UnityEngine.Tilemaps;

// "Overworld", "Cave", "CaveExtra", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower", "CaveArena", "Snow"
// SceneAsyncActivationGO (remove rate limit)
// CameraManager (.basePath, .sceneNames)
// GameManager (yield return this.LaunchGame(); from InitializeGame())

public partial class GameManager : MonoBehaviour
{
    public static Dictionary<GameObject, int> objects;
    public static List<GameObject> objectList;
    public static Dictionary<String, int> locations;
    public static Dictionary<long, int> textureIndices;
    public static int objectCount, textureCount;
    public static StreamWriter sw, senemies, sjars, serrors, stextures, scdestroyables, sscarabs, senvcolliders, stransitions;

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
			if(GameManager.textureIndices.TryGetValue(key, out existingIndex)) {
				return existingIndex;
            }

            textureIndices.Add(key, textureCount);
            var spriteIndex = textureCount;
            textureCount++;
            stextures.WriteLine("\"" + name + "\",");
            byte[] array = this.duplicateTexture(sprite.sprite.texture).EncodeToPNG();
            using (FileStream fileStream = new FileStream(CameraManager.basePath + "sprites/" + name + ".png", FileMode.Create, FileAccess.Write)) {
				fileStream.Write(array, 0, array.Length);
            }
			return spriteIndex;
        }
        catch (Exception e) {
			GameManager.serrors.WriteLine(e.Message);
        }

		return -1;
	}

    public void addObject(int parentI, GameObject o) {
        try {
            addObject0(parentI, o);
        } catch(Exception e) {
            serrors.WriteLine(e.Message);
        }
    }

    public void addObject0(int parentI, GameObject o) {
        if(objects.ContainsKey(o)) return;
        int index = objectCount;
        objects.Add(o, index);
        objectCount++;
        objectList.Add(o);

        sw.Write(
            "[\"" + o.name + "\", " + parentI
             + ", " + o.transform.position.x + ", " + o.transform.position.y
             + ", " + o.transform.rotation.z
             + ", " + o.transform.localScale.x + ", " + o.transform.localScale.y
             + ", ["
        );
        foreach(var c in o.GetComponents<Component>()) {
            sw.Write("\"" + c.GetType().Name + "\", ");
        }
        sw.WriteLine("]],");

        var cc = o.transform.GetChildCount();
        for(int i = 0; i < cc; i++) {
            addObject(index, o.transform.GetChild(i).gameObject);
        }
    }

    public void addComponents(int index) {
        try {
            addComponents0(index);
        } catch(Exception e) {
            serrors.WriteLine(e.Message);
        }
    }


    public void addComponents0(int index) {
        var o = objectList[index];

        var jar = o.GetComponent<Jar>();
        if(jar != null) {
            sjars.WriteLine("[" + index + ", " + jar.Size + ", " + (int)jar.DropType + "],");
        }

        var enemy = o.GetComponent<Enemy>();
        if(enemy != null) {
            SpriteRenderer sprite = enemy.Sprite;
            int spriteIndex = tryAddSprite(sprite, o.name);
            senemies.WriteLine("[" + index + ", " + enemy.Size + ", " + enemy.Tier + ", " + enemy.Destroyable.HpMax + ", " + spriteIndex + "],");
        }

        var cDestroyable = o.GetComponent<CrystalDestroyable>();
        if(cDestroyable != null) {
            scdestroyables.WriteLine("[" + index + ", " + (cDestroyable.dropXp ? "true" : "false") + ", " + cDestroyable.Size + "],");
        }

        var scarab = o.GetComponent<ScarabPickup>();
        if(scarab != null) {
            int oIndex;
            if(!objects.TryGetValue(scarab.destroyable.gameObject, out oIndex)) oIndex = -1;
            sscarabs.WriteLine("[" + index + ", " + oIndex + "],");
        }

        var cCollider = o.GetComponent<CompositeCollider2D>();
        var tCollider = o.GetComponent<TilemapCollider2D>();
        // for some reason world colliders have non-kinematic rigidbody...
        if(cCollider != null && tCollider != null) {
            // cannot guarantee that the layer is correct, there are some properties in tilemap and composite colliders that may or may not apply
			// also there's tilemap collider offset. No idea what to do with it
            senvcolliders.Write("[" + index + ", " + (cCollider.isTrigger ? "true" : "false") + ", " + cCollider.offset.x + ", " + cCollider.offset.y + ", " + o.layer + ", [");

            int pathCount = cCollider.pathCount;
            for(int i = 0; i < pathCount; i++) {
                var points = new Vector2[cCollider.GetPathPointCount(i)];
                cCollider.GetPath(i, points);
                senvcolliders.Write("[");
                foreach(var point in points) {
                    senvcolliders.Write("[" + point.x + ", " + point.y + "], ");
                }
                senvcolliders.Write("],");
            }

            senvcolliders.WriteLine("]],");
        }

        var transition = o.GetComponent<Transition>();
        if(transition != null) {
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

            stransitions.WriteLine("[" + index + ", " + (sameLoc ? "true" : "false") + ", " + destLocIndex + ", " + destIndex + "],");
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

        using(serrors = new StreamWriter(CameraManager.basePath + "errors", false)) {
            using(sw = new StreamWriter(CameraManager.basePath + "objects.js", false)) {
                sw.WriteLine("var objects = [");
                for(int i = 0; i < SceneManager.sceneCount; i++) {
                    Scene scene = SceneManager.GetSceneAt(i);
                    foreach(var obj in scene.GetRootGameObjects()) {
                        addObject(-1 - i, obj);
                    }
                }
                sw.WriteLine("]");
            }

            using(senemies = new StreamWriter(CameraManager.basePath + "enemies.js", false)) {
            using(sjars = new StreamWriter(CameraManager.basePath + "jars.js", false)) {
            using(stextures = new StreamWriter(CameraManager.basePath + "textures.js", false)) {
            using(scdestroyables = new StreamWriter(CameraManager.basePath + "cdestroyables.js", false)) {
            using(sscarabs = new StreamWriter(CameraManager.basePath + "scarabs.js", false)) {
            using(senvcolliders = new StreamWriter(CameraManager.basePath + "envcolliders.js", false)) {
            using(stransitions = new StreamWriter(CameraManager.basePath + "transitions.js", false)) {
                senemies.WriteLine("var enemies = [");
                sjars.WriteLine("var jars = [");

                stextures.WriteLine("var textures = [");

                scdestroyables.Write("var xpForCrystalSize = [");
                for(int k = 0; k < PlayerData.DestroyableCrystalValue.Length; k++) {
                    scdestroyables.Write(PlayerData.DestroyableCrystalValue[k] + ", ");
                }
                scdestroyables.WriteLine("]");
                scdestroyables.WriteLine("var crystalDestroyables = [");

                sscarabs.WriteLine("var scarabs = [");
                senvcolliders.WriteLine("var envColliders = [");
                stransitions.WriteLine("var transitions = [");

                for(int i = 0; i < objectList.Count; i++) {
                    addComponents(i);
                }

                senemies.WriteLine("]");
                sjars.WriteLine("]");
                stextures.WriteLine("]");
                scdestroyables.WriteLine("]");
                sscarabs.WriteLine("]");
                senvcolliders.WriteLine("]");
                stransitions.WriteLine("]");

                stextures.Write("var jarTexture = ");
                var j = FindObjectOfType<Jar>(true);
                if(j == null) stextures.WriteLine("-1");
                else {
                    int index = tryAddSprite(j.gameObject.GetComponentInChildren<SpriteRenderer>(), "Jar");
                    stextures.WriteLine(index);
                }
            }}}}}}}
        }

        Application.Quit();
        yield break;
    }
}
