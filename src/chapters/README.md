# Chapters

The site is one scroll-driven story. A rigged character (the "hero", a realistic likeness of the site
owner) walks through a sequence of worlds, one per chapter, and is taken apart into points and put
back together between them. Every chapter is a self-contained folder:

```
src/chapters/<id>/
  index.ts       the 3D world + all behaviour (default-exports a Chapter)
  section.html   the chapter's real content (one <section>), inlined into index.html at build
  style.css      the chapter's CSS, every selector scoped under #<id>
  *.ts           any local helpers
public/assets/<id>/   everything the chapter loads at runtime
tools/gen/src/<id>/   raw generations, prompts, working files (gitignored)
```

Order lives in `order.json`. Nothing outside your folder needs editing: the stylesheet and the module
are discovered by glob, the section is inlined by a Vite plugin. `origin/` is the reference
implementation; read it first.

## Scroll model

```html
<section id="range" class="chapter" style="--len: 8" aria-label="Range">
  <div class="pin"> ...overlay DOM... </div>
</section>
```

- The `<section>` is only a scroll spacer `--len` viewports tall. `.pin` is a fixed, full-viewport
  layer above the canvas; the director fades it with the chapter.
- The director calls `update(f, ctx)` every frame while your chapter owns the viewport.
  `f.p` is progress 0..1 through the chapter. `f.io` is presence: it ramps 0 to 1 over a short
  hand-over window at the top boundary and back to 0 at the bottom one (`f.side` says which). During
  hand-over the frame breaks into a dot screen automatically; your job is to take the hero apart:
  `hero.form = Math.max(yourForm, 1 - f.io); hero.scatter = Math.max(yourScatter, 1 - f.io);`
- Everything is a pure function of `f.p` (plus time for ambient motion and your own interaction
  state). Scrolling backwards must work. No one-way timelines tied to scroll.
- `.pin` and its children ignore the pointer so the 3D scene stays interactive; only real controls
  (`a, button, input, label, [data-hit]`) receive it. Put `data-hit` on a custom interactive element.
- All copy lives in `section.html` as real text, even if it is shown one beat at a time (use
  `show(el, amount)` from `world/util`). Without WebGL the pins become ordinary flowing sections, so
  check your chapter reads acceptably with the `.no-gl` class on `<html>`.

## The contract (`src/world/types.ts`)

```ts
const chapter: Chapter = { id, group, init(ctx, el), update(f, ctx), enter?, leave?, resize? };
export default chapter;
```

- Add every object, including lights, to your `group`. The director shows it only while you are active.
- Each frame, before `update`, the director resets: `ctx.bg` (black), `ctx.fog` (off), `ctx.post`
  (bloom 0.3, threshold 0.92, vignette 0.36, exposure 1; `grain` is ignored, there is no film grain), `scene.environmentIntensity`
  (0.55), camera fov (35) and the whole hero state. So set what you want every frame; nothing leaks.
- You own the camera while active: set `ctx.camera.position` and `lookAt` every frame.
- `init` may be async, but the chapter stays blacked out until it resolves: load only what the first
  beat needs there and lazy-load the rest. Use `ctx.tex`, `ctx.video`, `ctx.glb` (cached).
- Exceptions thrown in `init`/`update` disable only your chapter. Check the console.
- Tone mapping is ACES through an HDR pipeline with bloom. Emissive values above ~1 bloom.
  Additive materials should write alpha 1.
- `ctx.tier`: 0 phone, 1 laptop, 2 desktop. Scale particle counts, texture sizes and video use by it.
  `ctx.size.narrow` is true at 860 px and below; give the phone layout a real composition (usually the
  3D subject in the upper part, copy at the bottom).
- `ctx.still` (reduced motion): keep the scene, drop large automatic motion.
- `ctx.pointer` (eased NDC), `ctx.ray()` (raycaster from the pointer), `ctx.project(v)` (world to CSS
  pixels, for DOM labels pinned to 3D things), `ctx.goTo('work', 0.5)`.

## The hero (`src/world/Hero.ts`)

A realistic likeness of the site owner: 1.75 units tall, feet at y = 0, faces +Z, 82k triangles, 73 joints
(body, fingers, face, helpers). The head spans about y 1.51 to 1.75, the shoulders are wide (about 0.55
across in the jacket); at rest the wrists hang at about y 0.93, 0.24 out from the centre line, the
fingertips at about y 0.75. He wears a white and silver
jacket over black. All state is reset each frame.

| | |
|---|---|
| `hero.root` | position / rotation / scale |
| `hero.visible` | hide him entirely |
| `hero.form` | 0 solid mesh … 1 points (converts in a noisy sweep from the feet up) |
| `hero.scatter` | 0 points on the body … 1 blown away |
| `hero.tint`, `hero.tintMix`, `hero.glow`, `hero.grain` | point colour, how much of it replaces his own colours, brightness, point size |
| `hero.push` | 0..1, the pointer shoves points aside |
| `hero.walkTo(distance)` | scroll-driven walking: pass the distance his root has travelled; the cycle follows it and relaxes to idle when it stops. Move `hero.root` yourself by the same distance, and rotate him to face where he is going |
| `hero.stride` | world units per full walk cycle (two steps). Leave it alone: the default is the clip's own stride (`WALK.stride` in Hero.ts, 1.246), which keeps the feet planted; root scale is applied automatically. His natural pace is about 1 unit per second |
| `hero.walkFree(amount)` | walk on the spot on its own clock (treadmill shots) |
| `hero.pose = 'wave' \| 'think'` | play a named clip. `wave` plays once and hands back to idle even if you keep asking; `think` holds its last frame for as long as you ask. A clip the file does not have is ignored (check `hero.clips`) |
| `hero.shadow` | soft contact shadow opacity, for when he stands on your floor |
| `hero.bone('Head' \| 'RightHand' \| 'Hips' …)` | world position of a joint, to attach effects. Any joint of the rig by its short name: the 22 Mixamo body joints, fingers (`LeftHandIndex1` …), face (`Jaw`, `LeftBrow` …) |

He is lit by your lights plus a dim neutral environment map. Give him a key light and a rim light in
your chapter's colour, and something to stand on. His material shapes its own response so that a key
light strong enough for the room does not burn the jacket out (`LOOK` in Hero.ts: the white of the jacket
is held to a light grey, his lit colour is compressed under the bloom threshold, the silver is kept from
mirror highlights). If he looks wrong in your chapter, change your lights only after checking those
numbers: they apply to every chapter. Do not pose his bones by hand without also setting the eight
helper joints (see `tools/gen/hero2/README.md`). The model may not exist yet while you start
(`hero.ready` false, nothing drawn); code against the API, he will appear.

The file comes from `tools/gen/hero2/` (stage 4, `web_export.mjs`): `public/assets/hero/hero.glb` for
laptops and desktops, `hero.m.glb` (smaller textures) for phones.

## Looking at your work

A dev server is already running at http://localhost:5173 (do not start another, do not run
`vite build`). Capture with a real headless browser:

```
.claude/skills/impeccable/scripts/impeccable shot "http://localhost:5173/?shot&only=<id>&c=<id>&p=0.35" --viewport 1440x900,390x844 --out .impeccable/review/<id>
```

- `shot` = capture mode (`ctx.shot`: skip intros, no typing delays). `c` + `p` freeze the story at
  progress p of chapter c. `only=<id>` removes the other chapters from the page so someone else's
  broken chapter cannot affect you. `tier=0|1|2` forces a quality tier.
- The capture is taken about a second after load. If your state needs an interaction, read your own
  query parameter (for example `&act=open-2`) and put the chapter in that state in capture mode.
- The output file is named after the viewport, so copy or rename between captures.
- Then Read the PNGs and judge them hard. Capture at several `p` values across the whole chapter, on
  both viewports, every time you change something that matters. Type-check with
  `npx tsc --noEmit 2>&1 | grep "chapters/<id>"`.

## Shared look

- Type: Archivo variable (already loaded). Display: `font-stretch: 70%; font-weight: 780`, tight
  leading. Body 400 at 100% stretch. `.eyebrow` and `.kit` classes exist. Use `var(--gut)` for page
  margins, `var(--ease)` for easing, `var(--ink)`, `--ink-2`, `--ink-3` for text, `--accent` for your
  chapter colour (set it on `#<id>` in your CSS; the top bar and progress rail pick it up).
- Every chapter is its own colour world: one dominant hue for light, haze and accents, on a dark
  stage, with physical-feeling light (key, rim, bounce, fog), film grain and bloom. Not a HUD. Avoid
  generic sci-fi clutter: no fake code rain, no meaningless hex readouts, no decorative gauges.
  Everything on screen should mean something from the content.
- Points are the recurring material: the hero is made of them, so data, people, documents and
  requests should be points too where it fits.
- Copy is plain, specific and short, written in first person where a person is speaking. No
  marketing voice. Use only the facts supplied in your brief; invent no numbers, clients, quotes or
  awards. Never name the owner's current employer and never use the words "Binance", "blockchain",
  "crypto", "web3" or "exchange" anywhere: copy, alt text, file names, comments, prompts, metadata.
- Generated assets are placeholders the owner will replace later, so keep each one a separate,
  clearly named file in `public/assets/<id>/` and list them, with the prompt that made them, in
  `public/assets/<id>/ASSETS.md`. Never bake generated text into images (it comes out as gibberish):
  render words, numbers and UI in DOM, canvas or SDF instead.
- Budgets per chapter: about 12 MB of assets in total; video loops 720p, 4 to 6 s, under 2.5 MB each,
  muted, with a poster; images WebP under 300 KB (under 120 KB when used as a texture on a small
  object); GLB props under 1.5 MB each. On tier 0 load stills instead of video.
