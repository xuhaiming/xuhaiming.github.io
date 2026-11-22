# About chapter assets

All generated locally (ComfyUI + Blender) and all placeholders: replace any file with one of the same
name. Working files, the exact prompts (`prompts.json`) and the scripts that made these are in
`tools/gen/src/about/` (`gen.sh`).

| File | What | How it was made |
| --- | --- | --- |
| `darkroom-haze.mp4` (136 KB, 1248x704, 5.6 s loop) + `darkroom-haze.jpg` poster | Far wall plate: slow haze in a rose safelight | Still: `comfy_t2i.py --model qwen --w 1280 --h 720 --seed 21`, prompt `backdrop`. Motion: `comfy_video.py --seconds 6 --res 720 --seed 5 --lora 8step`, prompt `backdrop_motion`. Loop: `web_video.py --loop crossfade --fade 1.0 --crf 25` |
| `light-stand.glb` (0.42 MB, 12k tris) | Key light on a tripod | `comfy_t2i.py --model qwen 1024x1024 --seed 7` (prompt `stand`) -> `comfy_3d.py --model trellis --faces 30000 --tex-size 1024 --seed 3` -> `glb_web.py --tris 12000 --tex 1024 --ground --yaw 180` |
| `stool.glb` (0.29 MB, 12k tris) | Workshop stool | same chain, prompt `stool` |
| `print-line.glb` (0.28 MB, 12k tris) | Rail with blank prints on clothespins | same chain, prompt `line` |

Prompts:

- `backdrop`: Empty photographic darkroom at night seen from the middle of the room, almost black, a bare wall far away softly lit by one dim rose red safelight glow from the upper left, thin haze hanging in the air catching the rose magenta light, faint soft light leaks and a weak warm practical glow low on the right, deep black shadows, heavily out of focus, shallow depth of field, film grain, cinematic still, no people, no text, no furniture in the foreground
- `backdrop_motion`: Live-action cinematic plate, the dark empty darkroom shown in <Picture 1>. The camera is locked off and completely static. Thin haze drifts very slowly from left to right through the rose red safelight glow, the soft light leaks breathe gently brighter and dimmer, tiny dust motes float in the air. Nothing else moves, the room stays dark.
- `stand`: A single photography studio light on a stand: a tall slim black metal tripod light stand with three splayed legs, holding one round black fresnel spotlight lamp head with four barn-door flaps, whole object fully visible and centred from the feet to the top, three-quarter view, plain light grey seamless background, soft even studio lighting, no harsh shadows, product photograph
- `stool`: A single round-seat workshop stool: a worn dark oak round wooden seat on four slim matte black steel legs with a steel footrest ring, whole object fully visible and centred, three-quarter view from slightly above, plain light grey seamless background, soft even studio lighting, no harsh shadows, product photograph
- `line`: A single darkroom print drying rack: one straight horizontal dark wooden rail with five blank matte white rectangular photo paper sheets hanging below it side by side from small wooden clothespins, the sheets are completely blank white, whole object fully visible and centred, straight front view, plain mid grey seamless background, soft even studio lighting, no harsh shadows, product photograph

The sheets hanging on the drying line at the back of the room are plain blank paper drawn in code
(`src/chapters/about/set.ts`), not image files. The lens views (points, mesh, skeleton, texture) are
not assets either: they are live second drawings of the hero model (`src/chapters/about/xray.ts`).

GLB props are served compressed (`npx gltf-transform optimize in out --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --palette false --join false --flatten false --instance false --prune-solid-textures false`); the loader decodes them with MeshoptDecoder. Uncompressed originals: `tools/gen/backup-glb/`.
