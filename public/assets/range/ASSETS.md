# Range: generated assets

All of these are placeholders made locally with `tools/gen` (ComfyUI). Sources, sidecars and the
exact command lines are in `tools/gen/src/range/` (`gen_images.sh`, `gen_3d.sh`, `*.json`).
No text is baked into any of them; every word in the chapter is DOM or canvas.

| File | Size | Used for | Made with |
|---|---|---|---|
| `camera-512.webp` | 12 KB | product photo inside the frontend station's page | `comfy_t2i.py` (qwen, seed 11) then `web_image.py` |
| `camera-1024.webp` | 40 KB | station 4: the "Image" card and film-strip frame 1 | same source image |
| `camera.glb` | 0.64 MB | station 4: the mesh, and the surface the points are sampled from in the browser | `comfy_3d.py` (Trellis 2, 60k faces, seed 7) then `glb_web.py --tris 30000 --tex 1024 --tex-format webp --quality 72 --yaw 180` |
| `camera-mesh-512.webp` | 5 KB | station 4: film-strip frame 2 (Blender preview render of the GLB) | `glb_web.py --preview` then `web_image.py` |
| `rack.glb` | 0.52 MB | hall: three server racks behind the backend station | `comfy_t2i.py` (qwen, seed 21), `comfy_3d.py` (Trellis 2), `glb_web.py --tris 14000 --tex 1024 --ground --yaw 180` |
| `bench.glb` | 0.49 MB | hall: workbenches against the walls | `comfy_t2i.py` (qwen, seed 31), `comfy_3d.py` (Trellis 2), `glb_web.py --tris 22000 --tex 1024 --ground --yaw 180` |
| `haze.mp4` | 150 KB | far wall of the hall (moving light) and the screen + film-strip frame 4 of station 4 | `comfy_t2i.py` (qwen, seed 51) first frame, `comfy_video.py --last <same frame> --seconds 5 --res 720 --lora 8step --seed 5`, `web_video.py --loop crossfade --fade 0.6 --crf 27` (4.6 s, 1216x704, muted) |
| `haze.jpg` | 20 KB | poster / tier 0 still for the loop | `web_video.py --poster 1.0` |

Total: about 3.7 MB.

## Prompts

Object prompts all end with: "whole object fully visible and centred, three-quarter view from
slightly above, plain light grey seamless background, soft even studio lighting, no harsh shadows,
product photograph".

- **camera**: "A single vintage 16mm cine film camera with a glossy cobalt blue enamel body, a brushed steel lens turret with three lenses, a round film magazine on top and a side crank handle, no lettering, …"
- **rack**: "A single tall black server rack cabinet with the door removed, stacked rack-mounted server units with small blue status lights and neat blue cables, matte black steel frame, no lettering, …"
- **bench**: "A single heavy industrial workshop workbench, dark steel frame with drawers, thick worn wooden top, a bench vise, an articulated desk lamp, a small steel toolbox and a few hand tools on it, no lettering, …"
- **haze (first frame)**: "Abstract photograph of slow billowing ink smoke lit from within by cobalt blue light, soft volumetric light shafts through haze, deep cobalt blue fading to pure black at the edges, a brighter pale blue core slightly left of centre, no objects, no people, no text, cinematic, fine film grain"
- **haze (motion)**: "[Shot 1] Static camera. The cloud of blue-lit ink smoke from the first picture slowly curls and billows in darkness: dark filaments drift outward, fold over each other and sink back toward the bright pale-blue core, which swells and dims gently like breathing. Slow, continuous, weightless motion; deep cobalt blue on pure black; no objects, no text."

Not shipped: a generated robot-arm image (`tools/gen/src/range/arm_0*.png`) was made and left out.
The point cloud of station 4 is not a file: it is sampled from `camera.glb` at load.

GLB props are served compressed (`npx gltf-transform optimize in out --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --palette false --join false --flatten false --instance false --prune-solid-textures false`); the loader decodes them with MeshoptDecoder. Uncompressed originals: `tools/gen/backup-glb/`.
