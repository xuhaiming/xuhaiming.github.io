# Path chapter assets

All of these are locally generated placeholders (ComfyUI on this machine). Replace any file with one of the same name;
wide layers are read at any size, their aspect ratio sets the width of the plane. Sources, raw generations and the
scripts that made them are in `tools/gen/src/path/` (`gen_layers.py`, `process_layers.py`, `build_assets.sh`, `fix_sprites.py`).

Total: 8.36 MB in 31 files.

| File | Size | Used as | Model | Seed |
|---|---|---|---|---|
| `bicycle.glb` | 626 KB | 3D prop (image -> Trellis 2 -> Blender decimate) | qwen_image_2.1_turbo (8 steps) | 51 |
| `bollard.glb` | 439 KB | 3D prop (image -> Trellis 2 -> Blender decimate) | qwen_image_2.1_turbo (8 steps) | 56 |
| `clouds.jpg` | 31 KB | poster / phone still for clouds.mp4 |  |  |
| `clouds.mp4` | 336 KB | looping video: cloud edges drifting over every sky | qwen_image_2.1_turbo + MiniMax H3 image-to-video | 61 |
| `far_bj.webp` | 86 KB | far skyline, cut out (flood key of the plain sky), mirrored into the water (Beijing) | qwen_image_2.1_turbo (8 steps) | 22 |
| `far_nl.webp` | 84 KB | far skyline, cut out (flood key of the plain sky), mirrored into the water (the Netherlands) | qwen_image_2.1_turbo (8 steps) | 21 |
| `far_sg.webp` | 193 KB | far skyline, cut out (flood key of the plain sky), mirrored into the water (Singapore) | qwen_image_2.1_turbo (8 steps) | 24 |
| `far_sz.webp` | 223 KB | far skyline, cut out (flood key of the plain sky), mirrored into the water (Shenzhen) | qwen_image_2.1_turbo (8 steps) | 23 |
| `lamp.glb` | 326 KB | 3D prop (image -> Trellis 2 -> Blender decimate) | qwen_image_2.1_turbo (8 steps) | 52 |
| `lion.glb` | 557 KB | 3D prop (image -> Trellis 2 -> Blender decimate) | qwen_image_2.1_turbo (8 steps) | 55 |
| `mid_bj.webp` | 113 KB | far bank, cut out (flood key), mirrored into the water (Beijing) | qwen_image_2.1_turbo (8 steps) | 32 |
| `mid_nl.webp` | 168 KB | far bank, cut out (flood key), mirrored into the water (the Netherlands) | qwen_image_2.1_turbo (8 steps) | 31 |
| `mid_sg.webp` | 133 KB | far bank, cut out (flood key), mirrored into the water (Singapore) | qwen_image_2.1_turbo (8 steps) | 34 |
| `mid_sz.webp` | 169 KB | far bank, cut out (flood key), mirrored into the water (Shenzhen) | qwen_image_2.1_turbo (8 steps) | 33 |
| `near_bj_gate.webp` | 100 KB | quay sprite, cut out (BiRefNet; the gate by flood key), also reused dark and soft close to the lens (Beijing) | qwen_image_2.1_turbo (8 steps) | 43 |
| `near_bj_tree.webp` | 154 KB | quay sprite, cut out (BiRefNet; the gate by flood key), also reused dark and soft close to the lens (Beijing) | qwen_image_2.1_turbo (8 steps) | 44 |
| `near_nl_bikes.webp` | 98 KB | quay sprite, cut out (BiRefNet; the gate by flood key), also reused dark and soft close to the lens (the Netherlands) | qwen_image_2.1_turbo (8 steps) | 41 |
| `near_nl_tree.webp` | 174 KB | quay sprite, cut out (BiRefNet; the gate by flood key), also reused dark and soft close to the lens (the Netherlands) | qwen_image_2.1_turbo (8 steps) | 42 |
| `near_sg_palm.webp` | 51 KB | quay sprite, cut out (BiRefNet; the gate by flood key), also reused dark and soft close to the lens (Singapore) | qwen_image_2.1_turbo (8 steps) | 48 |
| `near_sg_plants.webp` | 148 KB | quay sprite, cut out (BiRefNet; the gate by flood key), also reused dark and soft close to the lens (Singapore) | qwen_image_2.1_turbo (8 steps) | 47 |
| `near_sz_rail.webp` | 27 KB | quay sprite, cut out (BiRefNet; the gate by flood key), also reused dark and soft close to the lens (Shenzhen) | qwen_image_2.1_turbo (8 steps) | 45 |
| `near_sz_tree.webp` | 173 KB | quay sprite, cut out (BiRefNet; the gate by flood key), also reused dark and soft close to the lens (Shenzhen) | qwen_image_2.1_turbo (8 steps) | 46 |
| `palm.glb` | 540 KB | 3D prop (image -> Trellis 2 -> Blender decimate) | qwen_image_2.1_turbo (8 steps) | 54 |
| `signpost.glb` | 189 KB | 3D prop (image -> Trellis 2 -> Blender decimate) | qwen_image_2.1_turbo (8 steps) | 53 |
| `sky_bj.webp` | 7 KB | sky backdrop, cross-faded per place (Beijing) | qwen_image_2.1_turbo (8 steps) | 12 |
| `sky_nl.webp` | 12 KB | sky backdrop, cross-faded per place (the Netherlands) | qwen_image_2.1_turbo (8 steps) | 11 |
| `sky_sg.webp` | 5 KB | sky backdrop, cross-faded per place (Singapore) | qwen_image_2.1_turbo (8 steps) | 14 |
| `sky_sz.webp` | 9 KB | sky backdrop, cross-faded per place (Shenzhen) | qwen_image_2.1_turbo (8 steps) | 13 |
| `tex_road.webp` | 242 KB | paving texture of the road | qwen_image_2.1_turbo (8 steps) | 71 |
| `water.jpg` | 49 KB | poster / phone still for water.mp4 |  |  |
| `water.mp4` | 458 KB | looping video: ripple highlights on the water | qwen_image_2.1_turbo + MiniMax H3 image-to-video | 62 |

## Prompts

**bicycle.glb**

> One classic black Dutch city bicycle with a rear rack and a front basket, three-quarter side view, whole object, product photograph, isolated on a plain white background, soft even studio light, no shadow, no text

**bollard.glb**

> One heavy black cast-iron harbour mooring bollard with a thick rope looped around it, on a small concrete base, three-quarter view, whole object, product photograph, isolated on a plain white background, soft even studio light, no shadow, no text

**clouds.mp4**

> first frame: Empty sky only. Soft layered clouds drifting across a dark teal pre-dawn sky, pale sea-green light on the cloud edges, high contrast between bright cloud edges and dark sky, no land, no sun, no text, cinematic / motion: Static locked-off camera. Time-lapse: the layered clouds drift steadily from left to right across the dark teal sky, the pale cloud edges slowly changing shape as they travel. No camera movement, no zoom.

**far_bj.webp**

> A distant big-city skyline in morning haze: many generic modern office towers of different heights, plain rectangular glass blocks, pale and faded by haze, a few tiny lit windows, low trees along the base. straight-on flat side elevation view like a theatre backdrop, no perspective, the subject runs unbroken from the left edge to the right edge, its base sits on the bottom edge of the frame, behind it only a plain empty flat pale grey sky with no clouds and nothing else. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**far_nl.webp**

> A distant flat Dutch horizon in silhouette: a long line of poplar trees, one church spire, one far traditional windmill, low farmhouse roofs, a row of slender modern wind turbines far away. The land is a thin dark strip in the lower third. straight-on flat side elevation view like a theatre backdrop, no perspective, the subject runs unbroken from the left edge to the right edge, its base sits on the bottom edge of the frame, behind it only a plain empty flat pale grey sky with no clouds and nothing else. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**far_sg.webp**

> A distant tropical waterfront financial skyline at night: generic modern glass towers of different heights with lit windows, a line of large rain trees along the shore at the base, humid air. straight-on flat side elevation view like a theatre backdrop, no perspective, the subject runs unbroken from the left edge to the right edge, its base sits on the bottom edge of the frame, behind it only a plain empty flat pale grey sky with no clouds and nothing else. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**far_sz.webp**

> A very dense distant skyline of generic supertall glass skyscrapers at dusk, dozens of slim towers packed tightly at different heights, hundreds of tiny warm lit windows, red aircraft warning lights on the tops, low green hills at the far left and right. straight-on flat side elevation view like a theatre backdrop, no perspective, the subject runs unbroken from the left edge to the right edge, its base sits on the bottom edge of the frame, behind it only a plain empty flat pale grey sky with no clouds and nothing else. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**lamp.glb**

> One tall classic cast-iron street lamp post with a single glass lantern on top, dark green-black painted metal, from base to top, whole object, product photograph, isolated on a plain white background, soft even studio light, no shadow, no text

**lion.glb**

> One traditional carved grey stone guardian lion statue sitting on a square stone plinth, three-quarter view, whole object, product photograph, isolated on a plain white background, soft even studio light, no shadow, no text

**mid_bj.webp**

> A continuous row of traditional Beijing hutong courtyard houses: grey brick walls, grey clay tile roofs with upturned eaves, dark red wooden gates, round red paper lanterns glowing warm, old bare scholar trees rising behind the roofs, one small two-storey gate pavilion with a tiled roof in the middle. straight-on flat side elevation view like a theatre backdrop, no perspective, the subject runs unbroken from the left edge to the right edge, its base sits on the bottom edge of the frame, behind it only a plain empty flat pale grey sky with no clouds and nothing else. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**mid_nl.webp**

> A continuous row of narrow old Dutch brick canal houses with stepped gables and bell gables, tall white-framed windows, a few windows lit warm, a stone quay wall at the base with bicycles parked along an iron railing and small moored boats. straight-on flat side elevation view like a theatre backdrop, no perspective, the subject runs unbroken from the left edge to the right edge, its base sits on the bottom edge of the frame, behind it only a plain empty flat pale grey sky with no clouds and nothing else. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**mid_sg.webp**

> A continuous row of two- and three-storey colonial tropical shophouses with louvred wooden shutters, arched covered walkways at street level, pastel walls lit by warm lamps, lush rain trees and tall palms rising between and behind them, a stone waterfront promenade at the base. straight-on flat side elevation view like a theatre backdrop, no perspective, the subject runs unbroken from the left edge to the right edge, its base sits on the bottom edge of the frame, behind it only a plain empty flat pale grey sky with no clouds and nothing else. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**mid_sz.webp**

> A harbour front at dusk: a continuous row of tall generic residential high-rise towers and glass office blocks with many warm lit windows, two tower construction cranes, at the base a container quay with gantry cranes, stacked shipping containers without markings and a low concrete sea wall. straight-on flat side elevation view like a theatre backdrop, no perspective, the subject runs unbroken from the left edge to the right edge, its base sits on the bottom edge of the frame, behind it only a plain empty flat pale grey sky with no clouds and nothing else. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**near_bj_gate.webp**

> A short section of grey brick hutong wall with a tiled roof ridge, a dark red wooden door with brass knockers, two round red paper lanterns glowing, an old cargo tricycle parked beside the door, single subject, full view, centred, side view, isolated on a plain flat pale grey studio background, soft even light, no shadow, no text, deep teal colour grade

**near_bj_tree.webp**

> One old ginkgo tree with golden-green leaves and a thick trunk, whole tree from the base of the trunk to the top, single subject, full view, centred, side view, isolated on a plain flat pale grey studio background, soft even light, no shadow, no text, deep teal colour grade

**near_nl_bikes.webp**

> Three old Dutch city bicycles leaning in a row against a black wrought-iron canal railing with two cast-iron bollards, single subject, full view, centred, side view, isolated on a plain flat pale grey studio background, soft even light, no shadow, no text, deep teal colour grade

**near_nl_tree.webp**

> One tall bare elm street tree in winter with fine dark branches, whole tree from the base of the trunk to the top, single subject, full view, centred, side view, isolated on a plain flat pale grey studio background, soft even light, no shadow, no text, deep teal colour grade

**near_sg_palm.webp**

> One tall coconut palm tree with a slender curved trunk and full crown of fronds, whole tree from the base of the trunk to the top, single subject, full view, centred, side view, isolated on a plain flat pale grey studio background, soft even light, no shadow, no text, deep teal colour grade

**near_sg_plants.webp**

> A dense clump of tropical garden plants: bird of paradise leaves, heliconia, ferns and a low fan palm, lush dark green, single subject, full view, centred, side view, isolated on a plain flat pale grey studio background, soft even light, no shadow, no text, deep teal colour grade

**near_sz_rail.webp**

> A section of modern stainless steel and glass harbour promenade railing with two heavy black iron mooring bollards and a coiled rope, single subject, full view, centred, side view, isolated on a plain flat pale grey studio background, soft even light, no shadow, no text, deep teal colour grade

**near_sz_tree.webp**

> One large banyan tree with hanging aerial roots and a dense dark green crown, whole tree from the base of the trunk to the top, single subject, full view, centred, side view, isolated on a plain flat pale grey studio background, soft even light, no shadow, no text, deep teal colour grade

**palm.glb**

> One stylised tropical palm tree with a thick trunk and eight broad solid fronds, sculpted like a painted scale model, from base to top, whole object, product photograph, isolated on a plain white background, soft even studio light, no shadow, no text

**signpost.glb**

> One weathered wooden signpost: a square timber post with a small pitched cap and one blank dark wooden arrow board pointing right, no writing on it, from base to top, whole object, product photograph, isolated on a plain white background, soft even studio light, no shadow, no text

**sky_bj.webp**

> Empty sky only, no land. Hazy early morning sky, soft high cloud veil, a pale diffused sun disc low in thick haze, jade green and grey-teal tones, slightly warm glow near the horizon. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**sky_nl.webp**

> Empty sky only, no land. Vast pre-dawn sky over flat lowland, long thin layered stratus clouds, deep blue-teal zenith fading to a pale mint glow low at the horizon, a few faint stars at the top. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**sky_sg.webp**

> Empty sky only, no land. Clear tropical night sky, deep teal-black, scattered stars, a few low moonlit clouds near the horizon, faint green-blue glow at the horizon. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**sky_sz.webp**

> Empty sky only, no land. Humid dusk sky after rain, tall towering cumulus clouds with dark teal undersides and faint warm amber rims, deep sea-green upper sky. cinematic matte painting, photoreal detail, blue hour, deep teal and sea-green colour grade, cool thin mist, soft diffuse light, no people, no text, no letters, no logos, no signs

**tex_road.webp**

> Top-down flat photograph of wet dark granite cobblestone paving after rain, small rectangular setts in a regular running bond, even lighting, no perspective, no shadows, no objects, texture filling the whole frame, dark grey-teal stone, glossy wet highlights on the stones

**water.mp4**

> first frame: Close view of a dark calm water surface filling the whole frame, gentle small ripples, soft pale teal highlights glinting on black water, seen from a low angle, no shore, no objects, no text, cinematic / motion: Static locked-off camera. The dark water surface moves with gentle small ripples travelling slowly toward the viewer, pale teal highlights glinting and fading on the ripples. Seamless calm motion, no camera movement, no zoom.

GLB props are served compressed (`npx gltf-transform optimize in out --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --palette false --join false --flatten false --instance false --prune-solid-textures false`); the loader decodes them with MeshoptDecoder. Uncompressed originals: `tools/gen/backup-glb/`.
