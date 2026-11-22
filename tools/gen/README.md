# tools/gen: local generative-asset toolchain

Small CLIs that turn prompts into placeholder images, short silent video loops and 3D props, and then
into web-ready files. Generation runs on the local ComfyUI server (RTX 5090); conversion runs on
ffmpeg, Pillow and Blender.

Everything below was run end-to-end on this machine on 2026-11-22. Test outputs are in
`tools/gen/src/_test/` (`tools/gen/src/` is gitignored: put sources and raw generations there, and
only web-ready files under `public/`).

## Art direction

_(to be filled in by the site owner: house style, palette, lighting, subject matter, what to avoid)_

## Ground rules

- **ComfyUI is already running** at `http://127.0.0.1:8188`. Never start, restart or reconfigure it.
- **The queue is shared.** Scripts only ever cancel the job they submitted (on `--timeout` or Ctrl-C).
  Do not clear the queue, interrupt other jobs, or free/unload models.
- Waiting time is not generation time: scripts print `waiting in queue, N job(s) ahead` and then
  `done: 5.5s on GPU, 41.0s including queue`. Timings quoted below are GPU time.
- Use the ComfyUI venv python for every `comfy_*.py` and for `web_image.py` (it has Pillow with WebP and AVIF):

  ```bash
  PY=/c/projects/ComfyUI/.venv/Scripts/python.exe        # Git Bash
  $PY = "C:\projects\ComfyUI\.venv\Scripts\python.exe"   # PowerShell: & $PY tools\gen\comfy_t2i.py ...
  ```

  `web_video.py` and `glb_web.py` are stdlib-only and run with any `python`.
- Run commands from the repo root (`C:\projects\xuhaiming.github.io`). Paths in the examples are relative to it.
- Every generator writes a sidecar `<output>.json` with the exact prompt, model, seed and size. Keep
  it next to the source file so an asset can be regenerated or varied later.
- Every script has `--help`, exits non-zero with a one-line `error: ...` on failure, and has a
  `--timeout` (seconds, queue time included).

## Typical pipelines

```bash
# still image -> responsive web images
$PY tools/gen/comfy_t2i.py "prompt" tools/gen/src/desk.png --w 1664 --h 928
$PY tools/gen/web_image.py tools/gen/src/desk.png --out public/media/desk --widths 640,1280,1920 --formats avif,webp,jpg

# still -> seamless muted loop -> web video + poster
$PY tools/gen/comfy_video.py --image tools/gen/src/desk.png --last tools/gen/src/desk.png --prompt "..." --seconds 4 --out tools/gen/src/desk.mp4
python tools/gen/web_video.py tools/gen/src/desk.mp4 --out public/media/desk-loop --webm vp9

# object image -> 3D prop -> web GLB
$PY tools/gen/comfy_3d.py tools/gen/src/teapot.png tools/gen/src/teapot.glb
python tools/gen/glb_web.py tools/gen/src/teapot.glb public/models/teapot.glb --yaw 180 --ground --preview tools/gen/src/teapot_preview.png
```

| Script | Does | GPU time measured |
|---|---|---|
| `comfy_t2i.py` | prompt -> image (4 models) | 4-9 s at 1344x768 |
| `comfy_edit.py` | 1-3 reference images + prompt -> image | 4-6 s at ~1 MP |
| `comfy_video.py` | image (+ last image) + prompt -> silent MP4 | 19 s (3 s, 832x480); 60 s (4 s, 1344x768) |
| `comfy_3d.py` | image -> textured GLB | 120 s Trellis 2; 49 s Pixal3D |
| `web_video.py` | clip -> MP4 / WebM / poster / loop / sprite sheet | 2 s |
| `web_image.py` | image -> WebP / AVIF / JPG at several widths, optional cut-out | 3 s (+0.4 s cut-out) |
| `glb_web.py` | GLB -> decimated, normalised web GLB + preview | 4 s |
| `comfy_api.py` | shared helper module (not a CLI) | |
| `comfy_bust.py`, `glb_to_points.py` | older, portrait-specific (photo -> bust GLB -> point cloud); left unchanged | |

---

## comfy_t2i.py: text to image

```bash
# original positional form (still works): <prompt.txt | "text"> <out.png> [width] [height] [seed]
$PY tools/gen/comfy_t2i.py tools/gen/src/prompt.txt tools/gen/src/out.png 1664 928 7

# options
$PY tools/gen/comfy_t2i.py "A matte ceramic cube on a dark studio floor, soft key light from the upper left, product photograph" \
    tools/gen/src/cube.png --model qwen --w 1344 --h 768 --seed 7
$PY tools/gen/comfy_t2i.py tools/gen/src/prompt.txt tools/gen/src/cube.png --model zimage --n 4   # cube_01.png .. cube_04.png, seeds seed..seed+3
```

- The first argument is the prompt text, or the path of a UTF-8 text file containing it.
- Defaults: `--model qwen`, 1664x928, random seed, `--n 1`, `--timeout 900`. Width/height snap to multiples of 16.
- Output is PNG. With `--n N` the files are `<stem>_01.png` ... and each has its own sidecar.

| `--model` | Model | Measured (1344x768) | Character in the cube test |
|---|---|---|---|
| `qwen` (default) | Qwen Image 2.1 Turbo, 8 steps | 5.5 s | Most literal and restrained; clean composition, obeys lighting directions. Best default, best for text in images. |
| `zimage` | Z-Image Turbo, 8 steps | 9.0 s | Photographic, high contrast; tends to add props (it put the studio lamp itself in frame). |
| `krea` | Krea 2 Turbo, 8 steps | 7.7 s | Soft, moody, "art-directed" look; larger subject in frame. |
| `klein` | FLUX 3 Klein distilled, 15 steps | 4.0 s | Most surface texture and micro-detail; same model family as `comfy_edit.py`, so use it when the image will be edited afterwards. |

Prompt guidance (all four):
- Write one or two plain descriptive sentences: subject, material, setting, light direction and
  quality, framing, medium ("product photograph", "flat vector illustration"). No keyword soup, no
  quality tags.
- These are distilled models running at CFG 1: **there is no working negative prompt** (`--negative`
  only reaches qwen and has little effect). Say what you want, not what to avoid; "plain dark
  background" works, "no clutter" does not.
- Mention a light only by its effect ("soft key light from the upper left"). Naming equipment
  ("studio lamp", "softbox") makes zimage and klein draw it.
- For images that will become 3D props: "single object, whole object fully visible and centred,
  three-quarter view from slightly above, plain light grey seamless background, soft even lighting,
  no harsh shadows".
- Same seed + same prompt + same size reproduces the image. Seeds are not comparable across models.

Failure modes: sizes are snapped to multiples of 16, not rejected; only sizes up to 1664x928 were
tested, so treat anything above ~2 MP as untested; the timings above include model loading after a
different model was in use.

## comfy_edit.py: edit / reference-guided generation (FLUX 3 Klein)

```bash
# restyle one image (output takes the reference's size)
$PY tools/gen/comfy_edit.py --image tools/gen/src/cube.png --out tools/gen/src/cube_amber.png --seed 3 \
    --prompt "The same studio photograph as <ref_image_0>, same camera angle, dark floor and soft lighting, but the cube is now made of polished translucent amber glass with light glowing through it and a warm caustic reflection on the floor."

# combine references: material from one, scene from another, explicit output size
$PY tools/gen/comfy_edit.py --image tools/gen/src/cube.png --image tools/gen/src/lampscene.png --w 1024 --h 1024 --out tools/gen/src/sphere.png \
    --prompt "A product photograph of a matte ceramic sphere on a dark studio floor. The sphere has the beige speckled ceramic material of the cube in <ref_image_0>. The scene uses the lighting and environment of <ref_image_1>."
```

- `--image` 1 to 3 times; they are `<ref_image_0>`, `<ref_image_1>`, `<ref_image_2>` in the prompt, in order.
- Defaults: 16 steps, `--mp 1.0` (each reference is scaled to ~1 megapixel), random seed, `--n 1`.
  Without `--w/--h` the output has the first reference's aspect at `--mp` megapixels.
- Measured: 3.7 s (1 reference, 1344x768), 5.5 s (2 references, 1024x1024).

Prompt guidance:
- **Write a full caption of the result with the change folded in**, not a command. "The same
  photograph as `<ref_image_0>`, same camera angle and lighting, but the cube is now amber glass"
  kept framing and background exactly; terse instructions ("make it glass") drift.
- State what must stay ("same camera angle, same floor, same lighting") as well as what changes.
- With several references, say what each one contributes (material / subject / lighting / palette).
- For a consistent look across a set of assets, pass the same style reference as `<ref_image_0>` to
  every call and describe it as "in the visual style, palette and lighting of `<ref_image_0>`".
- Raise `--mp` only when fine reference detail matters; time grows with it (only 1.0 was tested).

Failure modes: more than 3 references is rejected; always name every reference in the prompt;
with `--w/--h` at a different aspect ratio than the reference, the scene is recomposed rather than cropped.

## comfy_video.py: image-to-video and first/last-frame-to-video (MiniMax H3)

```bash
# image-to-video, quick draft
$PY tools/gen/comfy_video.py --image tools/gen/src/cube.png --seconds 3 --res 480 --seed 11 --out tools/gen/src/cube_i2v.mp4 \
    --prompt "Live-action product film, the matte ceramic cube shown in <Picture 1> rests on the dark studio floor, keeping its shape, colour and position. The camera performs an arc shot with small amplitude at slow speed to the right around the cube while the soft key light drifts slowly across its top face. The cube itself stays perfectly still."

# first frame -> last frame, full quality
$PY tools/gen/comfy_video.py --image tools/gen/src/cube.png --last tools/gen/src/cube_amber.png --seconds 4 --out tools/gen/src/cube_morph.mp4 \
    --prompt-file tools/gen/src/cube_morph.txt

# true seamless loop: same image as first and last frame
$PY tools/gen/comfy_video.py --image tools/gen/src/cube.png --last tools/gen/src/cube.png --seconds 3 --res 480 --out tools/gen/src/cube_loop.mp4 \
    --prompt "Live-action product film, a static shot of the matte ceramic cube from Picture 1 on the dark studio floor. A narrow band of soft light sweeps slowly across the cube from left to right and fades out, while fine dust motes drift through the light; the cube stays perfectly still, and the scene settles back exactly into the lighting and composition of Picture 2."
```

- Output: H.264 MP4, 24 fps, **no audio track** (the model's audio latent is never decoded). This is
  a source file; run it through `web_video.py` before shipping.
- Defaults: `--seconds 4`, `--res 768` (short edge), `--lora 4step`, random seed, `--timeout 1800`.
- Size: `--res` is the short edge; the long edge follows the first image's aspect ratio, capped at
  1344, both snapped to 32. A 16:9 image gives 1344x768 at `--res 768` and 832x480 at `--res 480`.
  `--w/--h` set it explicitly. Images are centre-cropped to the target aspect, never stretched.
  768 is the model's native size; do not go above 768x1344.
- Length snaps **up** to the model grid of 17k+5 frames: 3 s -> 73 frames (3.04 s), 4 s -> 107 (4.46 s),
  5 s -> 124 (5.17 s). The script prints the real frame count.
- `--lora 4step` (default, fast; the only setting that was tested), `8step` (8 steps, so expect
  about twice the time; try it when motion is mushy or fine detail boils), `none` (20 steps, expect
  about 5x the time).

Measured (4-step): 3 s at 832x480 = **19 s**; 4 s at 1344x768 = **60 s**. Time scales roughly with
pixels x frames.

### Prompt format (from the `h3-prompt-writing` skill)

The model expects a structured prompt. **The script builds the structure for you**: pass only the
shot description and it sends

```text
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

integrated_multimodal_description: [Shot 1] <your text>

overall_soundscape: N/A

non_diegetic_music: N/A
```

and with `--last` the first line becomes

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the S.SS-second mark of the target video.
```

(S.SS is the real clip duration.) If your text already contains `integrated_multimodal_description:`
it is sent untouched, as is anything given with `--raw`. The sidecar JSON holds the final prompt.

How to write the shot description:
- Start with the visual style, derived from the image: `Live-action, cinematic, ...`, `3D CG, ...`,
  `2D-animated, ...`, then the framing.
- Image-to-video: **anchor, then develop**. Name what is in `<Picture 1>` and what must stay the
  same (shape, colour, position), then the action, then how it settles.
- First/last frame: **describe the path between the two pictures**, not the pictures themselves:
  first-frame state -> visible intermediate changes -> "...until it matches Picture 2 at the end of
  the shot". Keep it to a single shot so the model can interpolate.
- Camera: motion type + amplitude + speed, written as a sentence. Types: zoom in/out, push in / pull
  out, pan left/right, truck left/right, tilt up/down, pedestal up/down, arc shot, tracking shot,
  static shot, POV, roll. Amplitude: `with small amplitude` / `with large amplitude`. Speed:
  `at slow speed` / `at fast speed`. Example: "The camera pushes in with small amplitude at slow speed toward the cube."
- Use concrete, visible detail ("a narrow band of light sweeps left to right") rather than mood
  words ("cinematic", "beautiful").
- Multi-shot: later shots start with a cut time, `[Shot 2] At 00:02.500, the camera cuts to ...`.
  Cut times must be inside the clip duration. For 3-5 s site loops, one shot is almost always right.
- Text that must appear on screen goes in double quotes.
- Leave the two audio fields as `N/A`; audio is discarded anyway.

Learned from the tests:
- "The cube itself stays perfectly still" / "keeping its shape, colour and position" really does
  pin the subject while the camera or light moves.
- For loops, `--last` = `--image` plus a prompt whose motion leaves and returns ("...settles back
  exactly into the composition of Picture 2") gives a clean loop with real motion in the middle.
  Without a described motion the clip is nearly static.
- A material change between first and last frame (ceramic -> glowing glass) is interpolated as a
  plausible physical transition when the prompt explains the mechanism ("a warm glow kindles in the
  centre and spreads outward").
- Overall exposure and background brightness drift slightly over an image-to-video clip. That is
  what makes a cross-faded loop visible; use first = last instead.

Failure modes: `--seconds` outside 1-15 is rejected; a first/last pair with different framing
produces a morph rather than a camera move; the 4-step LoRA is trained for 768p, so treat `--res 480`
as a draft setting; only 3-4 s clips were tested, and longer clips cost proportionally more time and
memory; if the queue is busy the 30 min default timeout counts waiting time too.

## comfy_3d.py: image to textured GLB prop

```bash
$PY tools/gen/comfy_3d.py tools/gen/src/teapot.png tools/gen/src/teapot.glb                       # Trellis 2, 30k tris, 2048 px textures
$PY tools/gen/comfy_3d.py tools/gen/src/teapot.png tools/gen/src/teapot_p.glb --model pixal3d     # faster
$PY tools/gen/comfy_3d.py tools/gen/src/teapot.png tools/gen/src/teapot_v.glb --vertex-colors --faces 200000
$PY tools/gen/comfy_3d.py photo.jpg out.glb --crop 120,40,900,820 --upscale                        # small object in a real photo
```

- Pipeline: background removal (BiRefNet) -> crop to a 1024 square -> structure -> shape -> colour ->
  watertight remesh -> decimate to `--faces` -> UV unwrap -> bake base colour, metallic-roughness,
  normal and AO at `--tex-size` -> GLB.
- Defaults: `--model trellis`, `--faces 30000`, `--tex-size 2048`, `--seed 42`, `--timeout 1800`.
- Also writes `<out>.crop.png`, **the image the model actually saw**. Look at it first when a result
  is wrong: a bad cut-out is the usual cause.
- Raw output is 14-15 MB (PNG textures). Always finish with `glb_web.py` (1.2 MB at 20k tris / 1024 px).
- `--vertex-colors`: no UVs or textures, colour per vertex (blotchy below ~100k faces). For point
  clouds and shader work.
- `--no-normal-map` skips the normal and AO bakes. `--use-alpha` trusts the input's own alpha instead
  of BiRefNet. `--upscale` 4x-upscales a small or blurry input first (slow, only for real photos).

| `--model` | Measured | Orientation of the result | Notes |
|---|---|---|---|
| `trellis` (default) | 119-123 s | Upright, canonical pose; **front faces -Z** (use `glb_web.py --yaw 180` to face the three.js camera) | Best geometry and thin parts (the bamboo handle and lugs came out clean). |
| `pixal3d` | 49 s | **Pixel-aligned: keeps the camera's tilt from the photo**, front faces +Z | 2.5x faster. A three-quarter-from-above photo yields a tilted object, so feed it a level, straight-on view, or use it when the prop is only ever seen from the photo's angle. Shape was slightly softer. `--fov` sets the assumed horizontal field of view (default 49.13; the depth model that would estimate it is not installed). |

Source-image guidance: one object, fully in frame, plain contrasting background, soft even light
(baked highlights and shadows end up in the base colour), three-quarter view so the model sees top
and side. The unseen back is invented; symmetric objects work best. Thin, transparent or glossy
mirror-like objects are the weak spots. Base colour comes out darker and flatter than the photo
because lighting is removed; that is expected, light it in the scene.

Failure modes: cut-out takes the wrong region (check `.crop.png`, then use `--crop`); `--tex-size`
is clamped to 512-4096; only one test object (a teapot) was run, so judge each result from the
`glb_web.py --preview` render.

## web_video.py: clip to web video, poster, loop, sprite sheet

```bash
# MP4 + WebM + poster at 1.0 s
python tools/gen/web_video.py tools/gen/src/cube_i2v.mp4 --out public/media/cube --webm vp9 --poster 1.0

# seamless loop by cross-fading the tail into the head
python tools/gen/web_video.py tools/gen/src/cube_i2v.mp4 --out public/media/cube-loop --loop crossfade --fade 0.5 --webm vp9

# scroll-scrubbed playback: sprite sheet of 24 frames, or an all-intra MP4
python tools/gen/web_video.py tools/gen/src/cube_morph.mp4 --out public/media/cube-scrub --frames 24 --sheet --sheet-width 320
python tools/gen/web_video.py tools/gen/src/cube_morph.mp4 --out public/media/cube-scrub --max-width 960 --keyint 1
```

Outputs, all from the same processed (trimmed, looped, scaled) frames:

| File | When | Details |
|---|---|---|
| `<stem>.mp4` | always | H.264 high, yuv420p, `+faststart`, no audio, `--crf` (default 23), `--max-width` (default 1280, never upscales) |
| `<stem>.webm` | `--webm vp9` or `--webm av1` | `--webm-crf` (default 33 vp9, 36 av1), no audio |
| `<stem>.jpg` | unless `--no-poster` | frame at `--poster` seconds (default 0) |
| `<stem>-sheet.webp` + `<stem>-sheet.json` | `--frames N --sheet` | N evenly spaced frames in a grid; JSON has `frames, cols, rows, frameWidth, frameHeight, width, height, duration` |
| `<stem>-frames/0001.webp ...` | `--frames N` without `--sheet` | N separate frames of `--sheet-width` px |

Other options: `--start/--end` (trim, seconds), `--fps`, `--cols`, `--sheet-quality` (default 80).

Use in the page: `<video autoplay muted loop playsinline poster="cube.jpg"><source src="cube.webm" type="video/webm"><source src="cube.mp4" type="video/mp4"></video>`.
Sheet frame `i` is at column `i % cols`, row `floor(i / cols)`.

Loops:
- `--loop crossfade`: output is `--fade` seconds shorter than the input. It suits ambient motion
  (light, particles, slow drift). With a camera move or a lighting change across the clip the fade
  shows as a brief double image; in that case regenerate with `comfy_video.py --last` equal to
  `--image`, which needs no loop processing at all.
- `--loop pingpong`: forward then reversed, twice as long. Only for motion that reads the same
  backwards (a slow push-in, a material change); smoke, falling or walking look wrong.

Measured: 2 s for MP4 + VP9 + poster + sheet from a 3 s 832x480 clip. Sizes from the tests: 2.5 s
832x480 loop = 130 KB MP4 / 43 KB VP9; 24-frame 320 px sheet = 24 KB; 8.8 s 960 px all-intra
(`--keyint 1`) = 2.6 MB MP4 / 0.7 MB AV1.

Failure modes: `--fade` longer than a third of the clip is rejected; a sheet larger than 16383 px on
a side is rejected (lower `--frames` or `--sheet-width`); `--keyint 1` files are several times
larger, so only use it for scrubbing.

## web_image.py: responsive web images and cut-outs

```bash
$PY tools/gen/web_image.py tools/gen/src/cube.png --out public/media/cube --widths 480,960,1920 --formats avif,webp,jpg
$PY tools/gen/web_image.py tools/gen/src/teapot.png --out public/media/teapot --widths 512,1024 --formats webp,avif --cutout --trim
```

- Writes `<stem>-<width>.<ext>` for each width and format. Widths above the source width are
  replaced by the source width; nothing is upscaled (a 1344 px source with `--widths 480,960,1920`
  gives 480, 960 and 1344).
- Defaults: `--widths 640,1280,1920`, `--formats webp,jpg`, `--quality 82` (WebP and JPG),
  `--avif-quality 60`. `png` is also accepted.
- `--cutout` removes the background with BiRefNet through ComfyUI (0.4 s GPU) and also writes the
  full-size master `<stem>-cutout.png`. `--trim` crops to the opaque area plus `--pad` (default 0.04).
  WebP and AVIF keep alpha; JPG is flattened onto `--bg` (default `#000000`).
- Inputs that already have alpha work the same way without `--cutout`.

Measured: 3 s for 3 widths x 3 formats. Sizes at 1344x768 (dark studio image): AVIF 13 KB, WebP 21 KB, JPG 35 KB.

Failure modes: BiRefNet keeps the most salient object, so contact shadows and reflections on the
floor are removed with the background; hair, glass and smoke get hard or partial edges. Generate
subjects for cut-out on a plain contrasting background. `--trim` without transparency is rejected.

## glb_web.py: optimise a GLB for the web (Blender)

```bash
python tools/gen/glb_web.py tools/gen/src/teapot.glb public/models/teapot.glb --yaw 180 --ground --preview tools/gen/src/teapot_preview.png
python tools/gen/glb_web.py in.glb out.glb --tris 8000 --tex 512 --tex-format webp --quality 80
```

- Joins all meshes, decimates to at most `--tris` (default 20000), downsizes textures to at most
  `--tex` px (default 1024), recentres on the origin and scales so the largest dimension is `--size`
  (default 1.0, a unit box), exports GLB: Y up, **no Draco, no meshopt**, no animation.
- `--ground` rests the base on y = 0 instead of centring vertically. `--yaw DEG` turns the object
  about the vertical axis (Trellis output needs `--yaw 180` to face +Z). `--no-normalise` keeps
  position and scale.
- `--tex-format jpeg` (default) | `webp` (three.js reads it natively) | `png` (needed if the base colour has alpha).
- `--preview out.png` renders a 768 px three-quarter view **from the +Z (front) side**. Read it to
  check the result; it is unlit flat shading, so it looks darker than it will in the scene.
- Prints `in:` / `out:` lines (triangles, vertices, MB, bounding box, texture sizes) and a
  machine-readable `stats {json}` line.
- Vertex-colour GLBs (from `comfy_3d.py --vertex-colors`) keep their colours.
- Blender path: `C:\Program Files\Blender Foundation\Blender 5.0\blender.exe`, or the `BLENDER` env var.

Measured: 4 s. Teapot: 30000 tris / 15.2 MB -> 20000 tris, 1024 px JPEG textures, **1.2 MB**.

Failure modes: UV seams can show after heavy decimation (below ~5k tris); prefer asking
`comfy_3d.py` for fewer `--faces` so the bake happens on the final topology, and use this script
only for texture size, format and normalisation. Skinned or animated GLBs are flattened to a static mesh.

## Known limits of the whole toolchain

- No audio anywhere, by design.
- Background removal is BiRefNet only (salient-object matting). The MoGe depth model is not
  installed, so Pixal3D runs with a fixed field of view.
- `comfy_bust.py` decimates the raw mesh without the remesh step; that is fine at its 500k-face
  setting but tears thin parts at low face counts. Use `comfy_3d.py` for props.
- Files the scripts place in `C:\projects\ComfyUI\input` are named `site_gen_*` and removed when the
  job ends; ComfyUI's own copies of results stay in `C:\projects\ComfyUI\output` (`site_gen_*`,
  `video/site_gen_*`, `3d/site_gen_*`).
