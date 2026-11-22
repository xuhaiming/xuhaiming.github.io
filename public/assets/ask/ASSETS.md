# Ask: generated assets

All of these are placeholders made with the local tools in `tools/gen` (ComfyUI). Sources, sidecar
JSON (exact prompt, model, seed) and the two scripts that made them are in `tools/gen/src/ask/`
(`prompts.sh` = stills, `stage2.sh` = 3D and video). Replace any file in place; the code only needs
the same name. Props are normalised to a unit box centred on the origin.

Every still used this tail: "whole object fully visible and centred with margin around it,
three-quarter view from slightly above, plain light grey seamless background, soft even studio
lighting, no harsh shadows, no text, no letters, no logo, product photograph".

| File | Size | Used for | Prompt (qwen_image_2.1_turbo, 1024x1024) then Trellis 2, seed 42 |
|---|---|---|---|
| `tool-range.glb` | 396 KB | Range instrument (cobalt) | A single compact carpenter's block plane, a chunky hand tool with a cobalt blue enamelled cast-iron body, a polished steel sole and blade and a round brass adjustment knob (seed 11) |
| `tool-systems.glb` | 542 KB | Systems instrument (lime) | A single precision planetary gear set as one solid machine part: a thick outer ring gear holding three planet gears around a central sun gear, machined matte steel teeth, the carrier plate anodised in vivid lime green (seed 12) |
| `tool-scale.glb` | 317 KB | Scale instrument (amber) | A single small night-market hanging lantern: a rounded amber glass globe inside a simple black wire cage, with a brass cap and a short brass hook on top, the glass glowing warm amber (seed 13) |
| `tool-path.glb` | 323 KB | Path instrument (teal) | A single small roadside milestone marker carved from pale weathered granite, rounded top, blank smooth front face, one wide band of teal enamel paint around its upper part, standing on a low square stone base (seed 14) |
| `tool-about.glb` | 440 KB | About instrument (rose) | A single vintage camera lens standing on its rear mount, short wide black metal barrel with a knurled focus ring, a rose-gold trim ring, large front glass element with rose pink coating reflections (seed 15) |
| `tool-links.glb` | 208 KB | Links instrument (pale violet) | A single sculpture of two thick interlocked chain links, smooth rounded oval links in violet anodised titanium with a satin finish, one link standing upright through the other (seed 16) |
| `light-loop.mp4` | 391 KB | Light on the back wall and its streak on the floor (tiers 1 and 2). 1248x704, 5.8 s, seamless, muted | Still (1280x720, seed 21): "Abstract photograph of light on a wall: narrow shafts of violet light and soft rippling caustic patterns, as if light passed through moving water and tall slatted blinds, falling diagonally across a dark charcoal plaster wall. Most of the frame is deep black, the light is crisp cool violet with fine detail, no objects, no people, no text". Motion (MiniMax H3, 6 s, seed 5): "The camera is locked off and perfectly still. The narrow shafts of violet light drift very slowly sideways across the wall while the soft caustic ripples inside them shimmer and flow gently, like light passing through slowly moving water. Nothing else appears, the wall stays dark, the motion is slow, smooth and continuous." Then `web_video.py --loop crossfade --fade 0.8 --crf 27` |
| `light-loop.jpg` | 52 KB | Poster of the loop; the still used on phones, with reduced motion and in capture mode | frame 0 of the loop |

GLB post-process: `glb_web.py --tris 10000 --tex 1024 --tex-format webp --quality 82 --size 1.0 --yaw 180`.
Total: about 4.3 MB.

GLB props are served compressed (`npx gltf-transform optimize in out --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --palette false --join false --flatten false --instance false --prune-solid-textures false`); the loader decodes them with MeshoptDecoder. Uncompressed originals: `tools/gen/backup-glb/`.
