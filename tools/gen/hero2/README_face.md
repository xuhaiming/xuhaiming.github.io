# Hero 2: face / head texture v2

Goal: sharper, more natural base colour for face, head skin, ears, neck and hair, same geometry and UVs. Everything runs
locally (ComfyUI at 127.0.0.1, FLUX 3 Klein; nothing is uploaded). Work files are in `src/hero2/face/` (gitignored);
result `src/hero2/face/hero_basecolor_v2.png` (4096 sRGB, same atlas as `hero_basecolor.png`, which is not touched).
Only texels of uv_region 1 (hair), 2 and 3 (head skin, face island) change; clothes and hands are bit-identical.

## Pipeline (plain Python + Blender for export/review; `python` = system Python with numpy, scipy, PIL)

```sh
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"; W=src/hero2
"$B" -b -P hero2/face_export.py -- $W/hero_mesh.blend $W/face/mesh.npz       # tris (glTF space), uv, uv_region
python hero2/face_front.py                                                    # flat unlit front render 2048 px (orthographic, 0.26 m) -> face/front.png
python hero2/face_edit.py $W/face/crop_in.png $W/face/c_c.png 3 0.9 "<prompt>" 16 1280   # front crop (380,450)-(1680,1750) of front.png
python hero2/face_views.py 45 2 0.9 p45_s2 ; python hero2/face_views.py -45 2 0.9 m45_s2  # 3/4 views, auto crop, same prompt
python hero2/face_build.py $W/face/hero_basecolor_t9.png $W/face/c_c.png p45_s2 m45_s2    # back-projection into the atlas
python hero2/face_hair.py $W/face/hero_basecolor_t9.png $W/face/hero_basecolor_v2.png     # hair colour + strand variation
sh hero2/face_review.sh $W/face/hero_basecolor_v2.png $W/face/r_v2                          # review sheets (_a views, _b close-ups, _c head)
```

- `face_edit.py`: Klein img2img. The render is VAE-encoded as the start latent (denoise 0.9) and also given as the
  reference image, so layout and identity stay (no reference or lower denoise: either another face or no change).
  Seeds: front 3, +45 deg 2, -45 deg 2 (seed 1 drifted: eyes and brows moved, hair rewritten). Prompt (face_views.py `PROMPT`):
  same man, identical eye shape / nose / brows / ears / mouth in the same positions, flat even soft light, no shadows or
  specular highlights, crisp dark brown irises with pupils, brows of individual hairs, lashes, even skin with fine texture,
  relaxed very slight closed-mouth smile, short black hair.
- `face_build.py`: edit is pasted into the render, its low frequencies (sigma 70 px) are replaced by the original's (80 %), so no
  lighting is baked and only detail/colour of features changes. Catchlights inside the irises are inpainted. Hairline guard
  keeps hair colour off the skin. Each atlas texel of the skin regions is projected into the three views (z-buffer visibility,
  weight by facing angle); eyes, brows and mouth come from the front edit only, the three views are blended elsewhere, and
  the result is faded back into the old atlas by the weight (so island borders and 24 px padding behave as before).
  `blob_tris`: a hair-region sliver on the forehead is repainted as skin.
- `face_hair.py`: hair texels (not the eye-lash triangles) get a natural dark brown-black base with strand variation from the
  band-passed normal map plus noise (no skin-coloured patches), padding of the hair islands gets the same colour.
- Other files: `face_lib.py` (rasteriser, camera, ComfyUI client), `face_review.sh`.

## Weaknesses

- Face island texel density is only about 4400 px/m, 0.56 of the front render, so skin pores are soft at close range.
- The edit is front-only for eyes/mouth: the smile is very slight and the lids/eyes are static (painted), as before.
- Hair is a colour pass only (strands come from the geometry/normal map); the ragged hairline and bangs shape are unchanged.
- Side/back of the neck and ear backs are barely edited (low facing weight): slightly softer than the front.
- Forehead speck is mostly but not completely gone; eyes look slightly more open than the old texture (rig lid bones were tuned to the old one: re-check blink).
- Tone differences between views are only matched through the shared low-frequency (original) tone; no visible seams in the reviews.

## Round 2: v3 (`src/hero2/face/hero_basecolor_v3.png`; v2, `hero_basecolor.png`, public/ untouched; work files in `face/w3/`)

Same atlas, only uv_region 1-3 texels change (verified: clothes, hands, collar 0 changed texels). Run from `tools/gen/`, `python` = system Python:

```sh
python hero2/face_masks.py                        # atlas masks (region id, front-view coords per texel, 3D pos) -> face/w3/masks.npz
python hero2/face_front.py face/hero_basecolor_v2.png face/w3/front_v2r 0          # v2 front render (face_cand.py reads it)
python hero2/face_cand.py q1_0.85                 # front beautify: Qwen Image Edit 2.1 turbo, seed 1, denoise 0.85 -> face/w3/cand_q1_0.85.png
python hero2/face_views3.py 45 1 0.85 p45 ; ... -45 1 0.85 m45 ; 90 1 0.8 p90 ; -90 1 0.8 m90   # views of v2, same prompt
#   back/neck/ear views (BACK prompt, denoise 0.7, seed 1): yaw 180 b180, 135 b135, -135 bm135 (run via python -c face_views3.run(..., prompt=BACK))
python hero2/face_build3.py face/w3/b1.png face/w3/cand_q1_0.85.png p45 m45 p90 m90 b135 bm135 b180   # back-projection onto v2 (face_build.py machinery)
python hero2/face_eyes3.py face/w3/b1.png face/w3/b2.png      # eyes registered to the ORIGINAL eye shape, dark irises
python hero2/face_post3.py face/w3/b2.png face/w3/b3.png      # retouch + tone + sculpt + micro detail + stubble
python hero2/face_hair.py face/w3/b3.png face/hero_basecolor_v3.png amp=0.9 base=0.082,0.067,0.058   # hair
sh hero2/face_review.sh src/hero2/face/hero_basecolor_v3.png src/hero2/face/r_v3
blender -b -P hero2/face_pose.py -- src/hero2/hero_rig.blend <outdir> basecolor=<png> only=face_blink,face_mouth cell=480 cols=4   # rig poses with another atlas, rig not saved
```

- Beautify prompt (`face_cand.HANDSOME`): professional-portrait retouch of the same man, identical face shape / eye shape and openness / nose / ears /
  mouth / hairline, groomed thicker brows, bright clear eyes, healthy even warm skin, no dark circles / redness, softened bags and nasolabial folds,
  very soft cheekbone / jaw / nose-bridge tone, defined natural lips, tidy stubble, flat light, no shadows or speculars. Candidates tried
  (`face/w3/cand_*.png`): Klein 0.7 / 0.85 / 1.0 (no visible change / blotchy artefacts / drift), Qwen 1.0 (very handsome but a different, narrower face: rejected),
  Qwen 0.55-0.9 with seeds 1-4: 0.85 seed 1 kept the face aligned and the identity best (seed 4 / 0.9 is more polished but shinier nose, wider eyes). Qwen at
  denoise < 1 needs the VAE-encoded image as start latent (the third output of TextEncodeQwenImage21 is not the image).
- Eyes: the beautified eyes are registered to the original front render with an ECC affine fit per eye (corr 0.94-0.95), so the opening, lid line and iris
  position follow the old shape that the lid bones were tuned to; irises darkened 28 % (no blue reflection). Blink (EyelidUpper 10), half blink, wink and
  smile poses were rendered with v3 (`face/w3/pose_v3/`): the closed eye reads closed, no open-eye paint on the lid.
- `face_post3.py` (atlas space, skin only): dodge of under-eye bags, nasolabial folds and chin by frequency separation, chroma evened (sigma 22 texels,
  outside eyes / brows / lips), warm shift (+1.2 L, +0.8 a, +1.2 b), symmetric sculpt tone of at most +-2.5 L (cheekbones, nose bridge, jaw, chin), micro detail
  (sparse pore dots, grain and fine lines at <= 2 L, none on eyes / brows / lips), grey stubble dots on chin / jaw / upper lip. Hair: `face_hair.py` again with
  warmer dark base and more strand variation, no baked specular. Normal map not changed (a v3 normal was not needed).
- `compare_v3.jpg`: original / v2 / v3 (front, 3/4, profile, eyes close-up).

Remaining weaknesses (v3): pores are limited by the 4400 px/m face density (detail is deliberately faint); the lips / mouth shape and the straight mouth
line are geometry (no smile in the texture); hair is still flat-shaded strands from the normal map, ragged hairline shape unchanged; a thin light line along
the ear rim in pure profile comes from the scan texture; the dark chin dimple is the normal-map shading, not paint.
