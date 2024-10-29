`process/retrieve_objects.cs` extracts object properies, sprites, and colliders. Use `dnSpy` (or [`dnSpyEx`](https://github.com/dnSpyEx/dnSpy)) to replace one of the methods in `Assembly-CSharp.dll` of the game according to the unstructions in the file, and run the game. The output directory should be `data-raw/objects`.

After extracting, generate a sprite atlas following the link in `process/compress_markers.js`, place the unzipped result in `data-raw/markers` (files should be named `markers.`\* and execute npm `run b-markers`.

Also generate colliders (and schema json, but that's details) with npm `run b-colliders`.

`process/retrieve_backgrounds.cs` generates background images. The same procedure to run as for `process/retrieve_objects.js`. Output is `data-raw/backgrounds`. Then run npm `run b-backgrounds`, and `run c-backgrounds`.

