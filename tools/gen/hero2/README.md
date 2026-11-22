# Hero 2 pipeline

Second-generation protagonist: a realistic full-body scan-like mesh from an image-to-3D service, reduced to a
web-ready, riggable mesh. Four stages: **1 mesh** (this folder so far), 2 rig, 3 animation, 4 web integration.

Everything runs locally in Blender 5.0 headless. The model is a likeness of the site owner: never upload the
mesh, textures or renders. Working files live in `tools/gen/src/hero2/` (gitignored).

## Stage 1: mesh

Input: `src/hero2/raw.glb` (2,000,000 triangles, T-pose, 8192 base colour + metallic-roughness, no normals).
Output: `src/hero2/hero_mesh.blend` / `hero_mesh.glb` (object `Hero`, 82k triangles: head 30k, each hand 7k, rest 38k;
one material) plus 4096 PNG texture masters.

### Rerun

From `tools/gen/` in Git Bash (about 15 minutes in total, most of it the bake and the review renders):

```sh
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
W=src/hero2

# a. import, weld, drop floating bits, scale to 1.75 m, ground and centre           -> hero_hi.blend
"$B" -b -P hero2/s1_import.py   -- $W/raw.glb $W/hero_hi.blend
# b. hair mask + "hairfix" mask (skin-coloured patches on the hair), stored on the source mesh
"$B" -b -P hero2/s2_hairmask.py -- $W/hero_hi.blend
# c. region-budgeted decimation                                                       -> hero_low.blend
"$B" -b -P hero2/s3_lowpoly.py  -- $W/hero_hi.blend $W/hero_low.blend rest=38000 hair=12000 head_skin=13000 face_feat=5000 hand=7000
# d. UV atlas (face in one island at 4.5x the clothing texel density)               -> hero_uv.blend
"$B" -b -P hero2/s4_uv.py       -- $W/hero_low.blend $W/hero_uv.blend
# e. bake base colour / normal / MR from the source, hair fix, material, export       -> hero_mesh.blend, hero_mesh.glb, hero_*.png
"$B" -b -P hero2/s5_bake.py     -- $W/hero_hi.blend $W/hero_uv.blend $W res=4096 ss=2
# f. landmarks for the rigger                                                         -> landmarks.json
"$B" -b -P hero2/landmarks.py   -- $W/hero_mesh.blend $W/landmarks.json
# g. review sheets (raw on top / result below); look at them
sh hero2/sheets.sh $W
python hero2/verify_glb.py $W/hero_mesh.glb
```

### What each step does

| File | Step |
| --- | --- |
| `common.py` | helpers; **region definitions** (`region_of`, `face_level`, `WRIST_X`, face feature boxes) used by every step |
| `s1_import.py` | glTF import, weld, connected components (keeps the main shell), normalise to the GLB contract |
| `s2_hairmask.py` | samples the source texture at the vertices; hair = biggest dark connected region on the head; `hairfix` = light islands enclosed by hair + thin light peninsulas above the brows (strand tips) |
| `s3_lowpoly.py` | one quadric collapse pass per region. The Decimate modifier never collapses an edge whose two vertices have weight 0 in its vertex group, so each region is reduced to its own budget exactly |
| `s4_uv.py` | charts from Smart UV Project on a lightly smoothed copy of the shape, crumbs merged into neighbours, real shape unwrapped angle-based + minimise stretch; the face front is a single island; per-region texel density (face 4.5x, ears/neck 3.2x, collar 2x, hair 1.8x, hands 1.8x, clothes 1x); pack |
| `s5_bake.py` | closest-point transfer in numpy (BVH over the 2M source triangles) of colour, MR and the source normal into the atlas with 2x2 supersampling, MikkTSpace tangent-space normal map, hair fix (the `hairfix` patches, plus anything inside the hair mask still lighter than 1.5x the median hair luminance, is pulled to the median hair colour and hair MR), 24 px edge padding, final material, `.blend` + `.glb` |
| `landmarks.py` | measures rigging landmarks on the final mesh (see below) |
| `review.py` | orthographic review renders of a `.blend`/`.glb`: `set=head,hair,face,hands,body,parts`, `mode=diffuse|pbr|wire|clay`, `attr=` mask overlay, `marks=landmarks.json` |
| `uv_layout.py` | draws the atlas coloured by region and counts islands |
| `sheets.sh` | renders the raw-vs-result comparison sheets (`review_*.jpg`: raw on top, result below) |
| `verify_glb.py` | plain Python: prints node transform, counts, bounds and embedded texture sizes of a GLB |

### Result contract (input of the rig stage)

- `hero_mesh.blend`: one object `Hero`, no transform, one material `Hero` (Principled: base colour, G/B of the MR
  texture into roughness/metallic, tangent-space normal map), textures packed. Blender axes: Z up, **faces -Y**,
  character's left is +X. Exported glTF: 1 unit = 1 m, 1.75 tall, Y up, feet on y = 0, centred on x/z, facing +Z.
- T-pose kept exactly as generated (bind pose for the rigger). Arms run along x at about y = 1.32.
- One closed manifold shell: 1 connected component, 0 boundary edges, 0 non-manifold edges (genus 86: hair strands
  and straps form handles; the source had 3 components, two floating bits of 390 and 3 vertices were dropped).
- Mesh data kept for later stages: point attribute `hair` (1 on hair, float), face attribute `uv_region`
  (0 clothes/body, 1 hair, 2 head skin, 3 face island, 4 left hand, 5 right hand, 6 collar and shoulder tops). The glTF exporter ignores them.
- Texture masters (4096 PNG, same atlas): `hero_basecolor.png` (sRGB), `hero_normal.png` (tangent space, OpenGL +Y,
  MikkTSpace), `hero_mr.png` (linear; G roughness, B metallic, glTF packing). `hero_mesh.glb` embeds JPEG copies at the
  web target (base colour 2048, normal 2048, MR 1024) and **exports tangents** so three.js shades the normal map with
  the frame it was baked in. Atlas: 719 islands, pack margin 0.0028 of the atlas (about 11 px at 4096), edge padding 24 px.
- `hero_basecolor_nofix.png` and `hero_hairfix_mask.png` document the hair fix (before, and where).
- `landmarks.json`: glTF-space points, each tagged `measured` or `estimated` (joints hidden under clothing).

### Tuning

- Triangle budget: the `rest= hair= head_skin= face_feat= hand=` arguments of `s3_lowpoly.py`.
- Where the head / hands / eye-brow-mouth boxes are: constants at the bottom of `common.py` (measured on this scan;
  a new scan needs new numbers).
- Texel density: `face= skin= hair= hand= collar=` of `s4_uv.py` (multiples of the clothing density). The hair is a flat
  black, so it gets less than the face; `smooth=` / `min_chart=` trade the number of islands against stretched charts. Atlas size and supersampling: `res= ss=` of `s5_bake.py`.
- Hair mask: `dark=` (luminance threshold), `open=` (half-width in metres of the light peninsulas treated as hair)
  of `s2_hairmask.py`. Check with `review.py ... obj=HeroHi attr=hairfix set=hair`.

## Stage 1b: proportions (`body_slim.py`)

The scan has a bulky jacket: shoulders 0.61 m wide once the arms hang, arms 14 cm short, hands 25 % small. `body_slim.py`
(smooth, masked deformation of the T-pose; topology, UVs, attributes and textures untouched) narrows the chest sides by
14-16 %, shifts everything outboard inward, thins the sleeves toward the arm axis (28-30 %, back to 1 at the elbow),
lengthens the arms (x1.14 shoulder to wrist) and scales the hands (x1.2). It maps `landmarks.json` through the same
function, so landmarks.py does not need a rerun. Originals: `src/hero2/backup/hero_mesh_orig.blend`, `landmarks_orig.json`.

```sh
"$B" -b -P hero2/body_slim.py -- $W/backup/hero_mesh_orig.blend $W/hero_mesh.blend CH=0.16 EXTRA=0.02 ARM=0.30   # -> hero_mesh.blend, landmarks.json
```

It prints the new joint constants (Arm x 0.1936, ForeArm x 0.4575, wrist x 0.7003) that are now at the top of
`rig_build.py`. `measure_width.py` prints posed widths (bideltoid 0.609 m before, 0.487 m after, idle).

## Stage 1c: head sculpt (`head_sculpt.py`)

Texture alone cannot make the round, heavy head handsome, so the head geometry is reshaped after `body_slim.py` (smooth, masked,
analytic deformation of the T-pose; topology, UVs, attributes and the texture atlas untouched). The chain from the scan is now:

```sh
"$B" -b -P hero2/body_slim.py   -- $W/backup/hero_mesh_orig.blend $W/hero_mesh_body.blend CH=0.16 EXTRA=0.02 ARM=0.30   # -> hero_mesh_body.blend, landmarks.json + landmarks_body.json
"$B" -b -P hero2/head_sculpt.py -- $W/hero_mesh_body.blend $W/hero_mesh.blend                                          # -> hero_mesh.blend, landmarks.json
```

Skin (`deform_skin`, one analytic function of position): jaw / cheek x-narrowing (`JAW` 12 %, `CHEEK` 8.5 %, faded in beyond |x| 0.03 so
mouth / nose / eyes stay, off at the ears, damped within 8 mm of the collar), cheekbone bump (`BONE` 1.8 mm), chin 4.5 mm longer,
3 mm forward and 7 % narrower, under-chin fullness tucked up / back (`SUBM`), neck 8 % slimmer (`NECK`), head scale 0.93 about
z = 1.50 blended out toward the collar (`HS`). Hair (vertex based, `hair` attribute): Taubin smoothing of the fringe zone (40 iterations),
the lower edge raised onto a clean line (z 1.672, a little higher on the character's left = slight side sweep), the crown's forward tufts pulled
back, crown volume +7 mm, sides tighter 5 %, light overall smoothing; hair vertices that touch skin stay on the skin. Same
mesh topology, 0 boundary / non-manifold edges. `landmarks.json` is `landmarks_body.json` with the head landmarks pushed through `map_pts()`
(head_top and hair bounds re-measured; mapped eye / nose / mouth points equal what `landmarks.py` measures on the new mesh within 0-3 mm).

`rig_face.py` carries its eye / brow / mouth / cheek / jaw constants through the same `map_pts()` at import (they were read off the texture
on the body-slimmed mesh; the painted features move exactly with the map), so the face bones still sit on the features (blink, smile, brow
renders in `src/hero2/geo/pose/`). The character is now 1.738 m tall (hair top; the contract's 1.75 was the old head): `Hero.ts` normalises
the height, or scale in the web stage. Head height chin to crown 0.2405 m = 1 / 7.28 of the body (was 1 / 7.0).

Tools: `head_measure.py` (widths and head ratio of a `.blend`), `head_compare.sh <before.blend> <after.blend> <out.jpg> [shots]` (before on top,
after below, v3 texture swapped in), `anim_review_v3.py` (anim_review with `basecolor=`), `head_dump.py`. Review: `src/hero2/face/compare_geo.jpg`.
Backups of the state before this stage: `src/hero2/backup3/`.

## Stage 2: rig

Input: `src/hero2/hero_mesh.blend` + `landmarks.json`. Output: `src/hero2/hero_rig.blend` (object `Hero` skinned to
the armature object `Armature`, identity transform, 73 bones / glTF joints, at most 4 influences per vertex,
weights normalised) plus review sheets `src/hero2/rig_*.jpg`.

### Rerun

From `tools/gen/` in Git Bash (build 10 s, all pose sheets about 4 minutes):

```sh
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
W=src/hero2

# a. armature + weights                                             -> hero_rig.blend, hero_rig_report.json
"$B" -b -P hero2/rig_build.py -- $W/hero_mesh.blend $W/landmarks.json $W/hero_rig.blend
# b. test poses, contact sheets (look at them)                      -> rig_<sheet>.jpg
"$B" -b -P hero2/rig_pose_tests.py -- $W/hero_rig.blend $W                       # only=shoulders,face_blink  mode=clay  cell=640
# c. mocap on the real mesh                                         -> hero_rig_mocaptest.blend / .json
"$B" -b $W/hero_rig.blend -P hero2/mocap/retarget.py -- clips=$W/mocap/clips out=$W/hero_rig_mocaptest.blend report=$W/hero_rig_mocaptest.json
"$B" -b -P hero2/rig_pose_tests.py -- $W/hero_rig_mocaptest.blend $W action=walk frames=0,5,9,14,18,23,27,32 views=front,side,qb cell=448
"$B" -b -P hero2/rig_pose_tests.py -- $W/hero_rig_mocaptest.blend $W action=idle frames=0,45,90,135 views=front,side,qb
"$B" -b -P hero2/rig_pose_tests.py -- $W/hero_rig_mocaptest.blend $W action=wave frames=0,16,26,34,42,56 views=front,q,back size=1.3 cz=1.25
# d. weight checks + test GLB (with the three clips) and what survived the export -> hero_rig_test.glb, .glb.json
"$B" -b -P hero2/rig_export_test.py -- $W/hero_rig_mocaptest.blend $W/hero_rig_test.glb
```

| File | What it does |
| --- | --- |
| `rig_build.py` | joints (constants at the top + landmarks), armature, rolls, helper constraints, body and finger weights, smoothing, 4-influence limit |
| `rig_face.py` | face bones and their weights; the eye / brow / mouth constants read off close-ups of the baked texture |
| `rig_pose_tests.py` | named test poses (local Euler angles = the conventions below) rendered as contact sheets; also frames of a baked action |
| `rig_export_test.py` | numeric weight checks (sides, fingers, hair, ears, collar), GLB export, joint / influence / name / animation check |

### How the weights are made

No bone heat. The T-pose separates the limbs, so every weight is a function of the rest position, masked by the
stage-1 attributes: the limb a vertex belongs to (arm by |x|, leg by height against the groin crease and the sign
of x, hand by `uv_region`), then blends along the limb across each joint. Hair and ears are 100 % Head; the collar
and all clothes are pinned off Neck / Head; only skin leaves the chest, fading in over 4 cm of surface distance from
the clothes so the neck turns inside the collar. Fingers: each hand vertex is labelled with the nearest finger ray,
so smoothing (which follows mesh edges) cannot leak across the gaps. Light Laplacian smoothing, more around the
shoulders, none on the head.

Joint placement notes (after stage 1b the joint is at |x| = 0.194, torso wall 0.160; before it was 0.24 / 0.19, because the jacket was
bulky): with the joint further in, hanging arms cut into the jacket and the hands into the thigh pouch. Hip joints
at z = 0.83 (the trouser crotch hangs low, 0.737). Feet keep their 6 degree toe-out.

### Bones (73)

Hierarchy is standard Mixamo; `mixamorig:` prefix on everything; Hips is the only root.

- Body (22): Hips > Spine > Spine1 > Spine2 > Neck > Head; Spine2 > Left/RightShoulder > Arm > ForeArm > Hand;
  Hips > Left/RightUpLeg > Leg > Foot > ToeBase.
- Fingers (30): `Left/RightHand{Thumb,Index,Middle,Ring,Pinky}{1,2,3}` under the Hand. Thumb1 is the metacarpal.
- Face (13): under Head: `Jaw` (> `LipLower`), `LipUpper`, `Left/RightEyelidUpper`, `Left/RightEyelidLower`,
  `Left/RightBrow`, `Left/RightMouthCorner`, `Left/RightCheek`.
- Helpers (8), driven by a Copy Rotation constraint (local space, influence 0.5), never keyed by hand:
  `Left/RightArmHalf` (child of Shoulder, half of Arm), `Left/RightElbowHalf` (child of Arm, half of ForeArm),
  `Left/RightKneeHalf` (child of UpLeg, half of Leg), `Left/RightForeArmTwist` (child of ForeArm, half of the
  Hand's twist about its length). They carry the skin around the joint so that linear skinning does not collapse
  it. **They must be baked on export**: the glTF exporter does that when it samples animations (the default;
  `rig_export_test.py` shows 8 helper bones with real motion in every clip). Code that poses bones at run time
  without a clip (procedural look-at, IK) has to set the helpers itself: half of the driving bone's local rotation.

The retarget script leaves face and helper bones alone (no bone other than the fingers has `Hand` plus a digit in its name).

### Axis conventions

Bone Y runs along the bone. Rest pose = the T-pose as modelled. Angles are local rotations from rest; left and
right are mirrored, so **X has the same meaning on both sides, Y and Z flip sign on the right**.

| Bones | local axes in the rest pose | +X | +Y | +Z |
| --- | --- | --- | --- | --- |
| Hips, Spine*, Neck, Head, all face bones | X = character's left, Y = up, Z = forward | bend / nod forward (down) | turn to the character's left | lean to the character's right |
| Shoulder, Arm, ForeArm, Hand, arm helpers | Y outward along the arm, Z down; X = back (left) / front (right) | lower the arm (Arm 78 = arms at the sides, -70 = overhead) | twist; Hand: left -80 turns the palm forward, +80 back (right: opposite) | left: swing forward, **elbow flexes with ForeArm +Z** (right: -Z) |
| Fingers 1-3, thumb 2-3 | as the hand | **curl** (fist about 80 / 95 / 70) | twist (do not use) | left: spread toward the thumb side (right: -Z) |
| Thumb1 | X = flexion axis of the thumb | toward the palm | - | left +Z (right -Z) carries it across the palm (opposition: X 35, Z 35) |
| UpLeg, Leg, KneeHalf | Y down, X = character's left, Z = back | UpLeg: thigh back (-X = forward); **knee flexes with Leg +X** | twist | UpLeg left: -Z abducts (right: +Z) |
| Foot, ToeBase | Y toward the toes, X = character's left | toes down (ToeBase -X = toes up) | - | - |

Hinges: elbow = ForeArm Z only, knee = Leg X only, finger joints 2 and 3 = X only.

### Face controls

All face bones have the Head's orientation; the pivot sits behind the feature, so a small rotation slides the skin
over the skull: **+X moves the feature down, -X up, +Y toward the character's left, +Z rolls it (its left end up)**.
Degrees; "safe" is what was rendered and looks like the same person. Keep to it: this is a likeness.

| Bone | Meaning | Safe range |
| --- | --- | --- |
| `EyelidUpper` | X +10 = eye closed (linear: +5 is half shut), negative widens | X -2 .. +10 |
| `EyelidLower` | X negative raises the lower lid (squint, smile) | X -3 .. 0; with the upper lid past +8 keep it above -1.5 |
| `Brow` | X -3.5 = raised 5 mm, +2 = lowered; Z rolls (left brow +Z, right -Z = inner end down); Y slides (left -Y, right +Y = inward) | X -3.5 .. +2, Y +-1.5, Z +-5. Frown = X 2, Y inward 1.5, Z inner-down 5 |
| `MouthCorner` | X negative = up; left +Y / right -Y = outward | X -2 .. +1.5, Y 0 .. 2.5 outward |
| `Cheek` | X negative lifts the cheek (goes with a smile) | X -2 .. 0 |
| `Jaw` | X positive drops the jaw about the hinge in front of the ear | X 0 .. +2 (3 is the limit) |
| `LipUpper`, `LipLower` | X negative / positive moves the lip up / down | X +-1.5 |

Tested combinations (`rig_pose_tests.py`): blink = EyelidUpper 10; smile = MouthCorner (-2, +-2.5, 0) + Cheek -1.5 +
EyelidLower -1.2; brow raise = Brow -3.5; frown as above; jaw = Jaw 2-3.

What the face cannot do, by construction of the mesh:
- The eyes are painted on one continuous surface: no eye rotation, and none is faked. A blink collapses the painted
  eye onto the lower lid line and stretches the lid skin over it; it reads as a closed eye from the front and
  three-quarter views. In pure profile the scan's lash ledge still sticks out like a small visor.
- The mouth is sealed: `Jaw` cannot open it. It stretches a 2 mm band of lip at the seam, which reads as slightly
  parted lips up to about 2 degrees and as a fuller lower lip beyond that. No teeth, no speech shapes.

### Review sheets (`src/hero2/`)

`rig_shoulders.jpg`, `rig_armpit.jpg` (+ `_clay`), `rig_elbows.jpg` (+ `_clay`; elbow 90 / 120, forearm twist +-80),
`rig_legs.jpg` (+ `_clay`; stride +-35, knee 90 / 120, side step, tiptoe), `rig_torso.jpg`, `rig_head.jpg` (turn +-60,
nod +-25, tilt), `rig_hands.jpg` (relaxed, fist, point, spread, thumb opposition), `rig_fingers.jpg` (one finger at a
time), `rig_face_blink.jpg`, `rig_face_brow.jpg`, `rig_face_mouth.jpg`, `rig_mocap_{walk,idle,wave}.jpg` and
`rig_mocap_{walk,idle}_torso.jpg` (the retargeted clips on the real mesh). Cell order is printed by the script.

### Known weaknesses

1. Armpits: with the arms down, the underside of the sleeve bunches into a small rough knot at the front and back
   of the armpit (visible in `rig_armpit_clay.jpg`, mostly hidden by the black panel in the texture).
2. (fixed by stage 1b) hanging bideltoid width 0.487 m; the hands still flare to |x| 0.29 beside the thigh pouches.
3. Jaw / lips: see above. Eyelids in pure profile: see above.
4. Elbow and knee at 120 degrees keep their volume, but the inside of the fold self-intersects (hidden in the crease).
5. Web between neighbouring fingers: about 100 vertices carry more than 20 % of two fingers; curling one finger
   pulls the web slightly, neighbours stay put (`rig_fingers.jpg`).
6. three.js strips the colon from node names (`mixamorig:Hips` becomes `mixamorigHips`) when it loads the GLB.

## Stage 3: animation

Input: `src/hero2/hero_rig_mocaptest.blend` (the rig with the retargeted CMU takes, stage 2 step c) and its
`.json`. Output: `src/hero2/hero_anim.blend` (four actions, one NLA track each), `hero_anim.json` (numbers and
checks), `hero_anim.glb` (+ `.glb.json`). Review renders go to `src/hero2/anim/`.

### Rerun

From `tools/gen/` in Git Bash (build 40 s, export 15 s, each review call 20-60 s):

```sh
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
W=src/hero2

# a. the four clips                                        -> hero_anim.blend, hero_anim.json
"$B" -b -P hero2/anim_build.py  -- $W/hero_rig_mocaptest.blend $W/hero_anim.blend
# b. GLB + verification against the .blend                  -> hero_anim.glb, hero_anim.glb.json   (fails loudly if a check fails)
"$B" -b -P hero2/anim_export.py -- $W/hero_anim.blend $W/hero_anim.glb
# c. look at it: contact sheets, videos (ffmpeg), mesh checks (floor, hands against body)
r() { "$B" -b -P hero2/anim_review.py -- $W/hero_anim.blend $W/anim "$@"; }
r sheet action=walk  frames=0:15:3 views=front,side,q cell=330 tag=_a
r sheet action=walk  frames=18:33:3 views=front,side,back cell=330 tag=_b
r sheet action=idle  frames=0,80,160 views=front,side,q cell=440
r sheet action=wave  frames=4,8,12,16,20,24 views=front,q,qr shot=torso cell=330 tag=_a
r sheet action=wave  frames=22,26,30,34,38,44,52,60,66,72,78,84 views=front,qr shot=torso cell=330 cols=6 tag=_b
r sheet action=think frames=6,9,12,15,18,22 views=front,q,side shot=torso cell=330 tag=_a
r sheet action=think frames=90 views=front,fq,fqr,right,low,side shot=-0.03,-0.1,1.45,0.3 cell=640 cols=3 tag=_chin
r sheet action=think frames=90 views=front,q,qr,right,side,top shot=-0.02,-0.1,1.25,0.7 cell=640 cols=3 tag=_elbow
r sheet action=idle  frames=0,44,46,48,50,53 views=front,fq shot=face cell=330 tag=_face
r sheet action=wave  frames=0,14,24,40,62,66 views=front,fq shot=face cell=330 tag=_face
r sheet action=think frames=0,14,17,30,61,90 views=front,fq shot=0.0,-0.05,1.57,0.24 cell=330 tag=_face
r sheet action=walk  frames=0:30:6 views=side,hq follow=LeftHand shot=hand cell=330 tag=_handL
r sheet action=idle  frames=0,120 views=front,side,back,hq follow=LeftHand shot=hand cell=400 cols=4 tag=_handL
r video action=walk  views=front,side,q cell=400 repeat=3
r video action=idle  views=front,q cell=400 step=2 repeat=2
r video action=wave  views=front,qr shot=torso cell=440 repeat=1 loop=0
r video action=think views=front,q shot=torso cell=440 repeat=1 loop=0
for a in idle walk wave think; do r check action=$a; done
```

| File | What it does |
| --- | --- |
| `anim_lib.py` | numpy model of the rig (FK in "world delta" rotations, hinge-knee leg solve, hinge-elbow arm solve), rotation / easing helpers, reading and writing actions, `MeshProbe` (deformed mesh: lowest sole vertex, how deep one body part sits in another) |
| `anim_build.py` | `build_idle`, `build_walk`, the measurements, the two mesh-in-the-loop passes (walk soles, think contacts), writes the `.blend` and the report |
| `anim_oneshots.py` | `build_wave`, `build_think` |
| `anim_review.py` | `sheet` / `video` / `check` |
| `anim_export.py` | glTF export, drops constant translation / scale channels, reads the GLB back and compares it with the `.blend` |

### Clips

30 fps, in place (the hips keep their sway and bob, no travel), quaternion keys on every frame for bones that move,
two keys for bones that do not. Frame 0 of a loop equals its last frame.

| Clip | Frames | Seconds | Kind | Source |
| --- | --- | --- | --- | --- |
| `idle` | 241 | 8.000 | loop | designed stance + the mocap performer's motion around his own mean (CMU 82_08, stretched from 6.1 s); breathing, blinks, fingers, face keyed |
| `walk` | 74 | 2.4333 | loop, 2 gait cycles of 1.2167 s, starts on the left heel strike | CMU 136_21: feet and timing as retargeted; pelvis, trunk, head, arms reworked (below); hands, blink, face keyed |
| `wave` | 85 | 2.800 | one-shot, first and last frame = idle frame 0 | right arm hand-keyed (IK targets), body = idle life under an envelope |
| `think` | 91 | 3.000 | one-shot, starts on idle frame 0, pose reached at 0.9 s, then held with life; clamp on the last frame | both arms hand-keyed (IK targets, contacts solved on the mesh) |

**Walk numbers for the site**: stride 1.2461 m per gait cycle, cycle 1.2167 s, so ground speed 1.0242 m/s at
playback rate 1 (the planted foot measures 1.023-1.031 m/s). Loop = 2 cycles = 2.4922 m. Flat-foot slide 1.0 mm.
Head travel 23 mm vertical, 20 mm lateral; head pitch within +-1 degree.

What was changed from the mocap pass and why:

- **idle**: the take stood with the pelvis tipped 6 degrees, knees bent 13, the head looking up 12 and the arms
  uneven. The stance is now set by hand (ankles +-0.118, 10 degrees toe-out, pelvis 1 degree, chest upright, head level,
  arms 77 degrees down = 18 mm clear of the thigh pouches) and only the performer's deviations from his own mean are
  layered on (weight shift 17 mm, chest and head sway, arm drift), with the look-around scaled to +-4.5 degrees.
  The loop starts where he is closest to that mean. Breathing: two breaths of 4 s (chest 1.3 degrees, collar bones
  1.1 degrees, arms hanging freely). Blinks at 1.45 / 4.30 / 6.55 s.
- **walk**: the take walks crouched (knee 35 degrees at heel strike), on a line, with the pelvis listing 10 degrees
  and the head 9 degrees up. Kept: ankle paths, foot roll and timing (so stride and speed are the retarget's).
  Changed: feet 4 cm further apart each; pelvis as high at every double support as the legs allow (a leg never passes
  99.7 % of its length, eased, so no lock and no pop: knee 11-16 degrees at heel strike, 23 at mid-stance) with 78 %
  of a straight-leg arc in between (bob 23 mm); sway 58 %, list 50 %, the take's slow fore-aft drift removed; a designed
  +-3 degree pelvis rotation with the leading leg and the chest turning against it (+-5); chest 1.8 degrees forward,
  head level and facing forward; arms pulled 65 % toward a common left / right swing, moved 8.5 degrees out and 6 back,
  elbows as pure hinges (9-28 degrees, more on the forward swing); wrists damped; relaxed fingers that close a little
  on the forward swing. Soles: a first pass measures the lowest shoe vertex per frame on the deformed mesh and the
  ankles are corrected (floor error within 1 mm).
- **wave**: raise 0.10-0.74 s, 2.5 waves at 2.15 Hz from 0.70 s (wrist +-5 cm, the hand rocking 12 degrees at the
  wrist and trailing the forearm), down from 1.98 s, settled at 2.66 s. Hand at eye-to-crown height, palm forward,
  fingers together and slightly bent. Small nod, head inclined, smile and brows up while it lasts.
- **think**: wrists travel on arcs about the shoulders (always within reach, round the front of the jacket). The
  right index knuckle goes to a point under the chin that is attached to the head, the left palm to a point under the
  right elbow; `land_contacts` then measures the gap on the deformed mesh at the held pose and moves both targets
  until hand and chin, palm and sleeve are 0.8 mm apart with nothing inside (5 rounds). Because the targets ride on
  the head and the elbow, the contacts hold while the body breathes.

### Face and finger layers

Authored as local Euler angles in the conventions above (`face()`, `fingers()` in `anim_build.py`), always inside
the documented safe ranges:

- held in every clip: 22 % of the rig's tested smile (mouth corners -0.44 / 0.55, cheeks -0.33, lower lids -0.26).
- blink: upper lid to 10 degrees in 0.12 s, 0.035 s shut, open in 0.18 s; lower lid to -1.
- wave: smile to 78 %, brows 42 % of the full raise. think: frown 36 %, smile down to 30 % of the held one, upper
  lids 1.3 degrees lower. Jaw and lips are never moved.
- fingers: relaxed curl (index 16/24/15 ... little finger 28/35/21 degrees, thumb swung in 22 degrees beside the
  index); idle: every finger drifts a few percent on its own rhythm; walk: 3-33 % more curl with the swing.

### For the web stage

- `hero_anim.glb`: +Y up, one skin, 73 joints, 4 animations of 74 channels each (73 rotations incl. the 8 baked
  helpers + hips translation), linear, keys every 1/30 s. Textures as in the stage-2 test file (three 4096 JPEGs).
- Crossfades are joint-space blends, so feet slide a little while two clips are mixed. idle <-> walk: 0.3-0.4 s.
  Entering the walk at clip time 0.30 s (or 0.91 s), a mid-stance where the feet pass each other, is the pose
  closest to the idle; time 0 is a full stride. idle <-> wave / think: 0.15-0.25 s is enough since they start on
  idle frame 0. Leaving `think` (clamped on its last frame) back to idle: 0.5-0.6 s, the arms have far to go.
- Idle and walk share facing (+Z); the hips are centred in both. Idle ankles are at x = +-0.118, the walk's track is
  +-0.07 to 0.10.

### Known weaknesses

1. The trousers hide it, but the stance knee still flexes 23 degrees at mid-stance; straightening it further means
   either more bob or changing the take's foot paths.
2. The two gait cycles differ slightly (it is one take, not a mirrored cycle): arms and step height are not identical
   left and right.
3. think: the left forearm presses 6-7 mm into the jacket front (bulky jacket, short arms), the right upper arm rests
   against the chest (0.8 mm in). The left wrist is twisted 65 degrees to turn the palm up.
4. wave / think use the idle's first 3 s as body life: played right after each other they repeat the same sway.
5. Toe bones snap up 17 degrees in one frame at toe-off (from the take); invisible inside the shoe.
6. Arms hang wide (rig weakness 2) and the walk's arm swing is modest (wrist 17-19 cm fore-aft).

## Stage 4: web export

Input: `src/hero2/hero_anim.glb` (stage 3) and the 4096 PNG texture masters next to it. Output: the two files the
site loads, `public/assets/hero/hero.glb` (laptops and desktops) and `public/assets/hero/hero.m.glb` (phones).

### Rerun

From the repo root, plain Node (4 s; `@gltf-transform/*`, `meshoptimizer` and `sharp` come with `npm install`):

```sh
node tools/gen/hero2/web_export.mjs                                   # source = tools/gen/src/hero2/hero_anim.glb
node tools/gen/hero2/web_export.mjs tools/gen/src/hero2/other.glb     # any other source with the same rig
node tools/gen/hero2/web_export.mjs --check-only                      # only read the two files back and print the report
```

Options: `--out <dir>`, `--tex <dir with hero_basecolor.png, hero_normal.png, hero_mr.png>` (default: next to the
source; without the masters the images embedded in the source are used), `--base 2048,1024 --normal 2048,1024
--mr 1024,512` (desktop,phone sizes), `--q-base 94 --q-normal 90 --q-mr 88` (WebP quality), `--no-phone`.

The script prints the size breakdown and reads both files back against the source (worst position, UV, normal and
weight error, clip lengths). Current build:

| | `hero.glb` | `hero.m.glb` |
| --- | --- | --- |
| total | 2.11 MiB | 1.42 MiB |
| geometry (53,450 vertices, 81,998 triangles) | 820 KiB | 820 KiB |
| animation (4 clips) | 44 KiB | 44 KiB |
| skin + JSON | 96 KiB | 96 KiB |
| base colour | 2048, 434 KiB | 1024, 195 KiB |
| normal | 2048, 604 KiB | 1024, 230 KiB |
| metallic-roughness | 1024, 165 KiB | 512, 69 KiB |

Worst errors against the source: position 0.05 mm, UV 0.17 texel of the 4096 atlas, normal 1.1 degrees, skin weight
0.005 (sums exact).

### What it does

| Part | Treatment | Why |
| --- | --- | --- |
| positions | float32, metres, snapped to 1/16384 m | the site reads mesh space directly (bounds, dissolve sweep, point sampling), so no `KHR_mesh_quantization` transform on the mesh; the snap makes the floats pack well |
| normals, tangents | 10 bit | tangents are kept: the normal map is MikkTSpace and three.js shades it with the vertex tangents |
| UVs | 14 bit | a quarter of a texel of the 4096 master |
| skin weights / joints | 8 bit, renormalised / 8 bit | 73 joints; sums stay exactly 1 |
| vertex order | meshopt `reorder` for size; nothing welded, simplified or dropped | |
| animation | channels that never leave the rest pose dropped (three falls back to the rest pose), `resample` (tolerance 1e-4), rotations as 16 bit quaternions (meshopt filter) | |
| container | `EXT_meshopt_compression` (required), `EXT_texture_webp` (required) | the decoder is already registered in `src/world/World.ts` |
| textures | WebP from the PNG masters, Lanczos; the normal map is renormalised after scaling | the atlas gives the face 4.5x the texel density of the clothes, so one uniform size already favours the head |

Texture sizes were chosen by looking at the About portrait (the closest the camera gets) with the 4096 source, the
2048 set and the 1024 set side by side (`?hero=<url>` on the dev server loads any file in place of the hero): on a
1440x900 screen the 2048 base colour cannot be told from the 4096 source; the 1024 set is slightly softer around the
eyes at desktop size and matches a phone screen (the face spans about a third of the atlas, 340 texels at 1024,
against a face about 250 device pixels wide in the phone portrait).

### Site rules for these files (`src/world/World.ts`, `src/world/Hero.ts`)

- Tier 0 (phones) loads `hero.m.glb`, every other tier `hero.glb`. The hero is exempt from the site's "512 on
  phones" rule for GLB textures. GPU memory with mipmaps: desktop 22 + 22 + 5.6 = 50 MB, phone 5.6 + 5.6 + 1.4 =
  12.6 MB.
- Walking is driven by the distance travelled. The one constant to change when the walk clip changes is `WALK` at
  the top of `Hero.ts` (`cycles: 2, stride: 1.2461, enter: [0.3, 0.91]`, from stage 3's "Walk numbers for the site").
  To check it against a new clip, open the dev server, paste `tools/gen/hero2/web_stride.js` into the console and
  read the foot slide per metre for a few stride values: the smallest is the stride to use (0.05 now, most of it
  the heel-to-toe roll of the planted foot).
- Blend times: `FADE` and `ONE_SHOT` in `Hero.ts`. `wave` plays once and hands back to idle; `think` clamps on its
  last frame for as long as a chapter asks for it. A clip missing from the file is ignored (idle / walk go on).
- Look: `LOOK` in `Hero.ts` (white roll-off for the jacket, highlight compression under the bloom threshold,
  roughness floor and metalness scale for the silver, environment gain).

### GLB contract

The site code relies on exactly this; a replacement file must keep it. (It replaces the contract in
`tools/gen/hero/README.md`, which describes the first, stylised figure.)

- Two files in `public/assets/hero/`, `hero.glb` and `hero.m.glb`, identical except for texture sizes. Under 5 MB
  each. No cameras, no lights.
- One skinned mesh (`Hero`), one material with base colour, tangent-space normal map (+Y, MikkTSpace; the mesh
  carries tangents) and metallic-roughness (G roughness, B metallic). 4 influences per vertex.
- Units and axes: 1 unit = 1 m, **1.75 tall**, Y up, feet on y = 0, centred on x and z, **facing +Z**, the
  character's left is +X. No transform on the mesh or the armature; vertex positions are plain metres.
- Bind pose: T-pose (arms along x at about y = 1.32).
- Skeleton: 73 joints, `mixamorig:` names (three.js drops the colon: `mixamorigHips`), listed in stage 2: 22 body,
  30 fingers, 13 face, 8 helpers (`ArmHalf`, `ElbowHalf`, `KneeHalf`, `ForeArmTwist`, baked into every clip; the
  About skeleton view hides them by these names). The site looks joints up by name with the prefix removed and
  treats everything under `Head` and under `LeftHand` / `RightHand` as head and hands (point density).
- Clips, in place, 30 fps:

  | Name | Length | Use |
  | --- | --- | --- |
  | `idle` | 8.0 s | loop |
  | `walk` | 2.4333 s | loop of 2 gait cycles, stride 1.2461 m per cycle (`WALK` in `Hero.ts` must match) |
  | `wave` | 2.8 s | one-shot, starts and ends on idle frame 0 |
  | `think` | 3.0 s | one-shot, pose reached at 0.9 s; the site clamps it on the last frame |
