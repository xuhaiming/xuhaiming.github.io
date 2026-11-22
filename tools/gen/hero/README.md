# Hero character pipeline

> Superseded: the site now uses the realistic figure built by `tools/gen/hero2/` (see its README; stage 4 holds the current GLB contract). This folder is kept for reference only.

Builds the placeholder protagonist for the site: a stylised full-body character, rigged with
Mixamo bone names and four baked clips, exported as `public/assets/hero/hero.glb`.

Everything runs locally: ComfyUI at `http://127.0.0.1:8188` (FLUX 3 Klein for the concept, Trellis 2 for the mesh)
and Blender 5.0 headless. The owner photo never leaves the machine. Working files go to
`tools/gen/src/hero/` (gitignored).

## Rerun

From `tools/gen/` in Git Bash:

```sh
PY=/c/projects/ComfyUI/.venv/Scripts/python.exe
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
W=src/hero

# 1. concept image (photo as identity reference). Try several seeds, look at them, keep one as concept.png
$PY hero/comfy_concept.py src/profile.png hero/concept_prompt.txt $W/concept_b66.png 66
cp $W/concept_b66.png $W/concept.png

# 2. image -> 3D (Trellis 2, solid remesh, 600k faces, vertex colours). Third argument is the seed
$PY hero/comfy_hero3d.py $W/concept.png $W/raw.glb 101

# 3. clean, decimate to 40k triangles, UV, bake one 2048 base-colour texture, orient and scale
"$B" -b -P hero/mesh_prep.py -- $W/raw.glb $W/hero_mesh.blend $W/hero_basecolor.png tris=40000 tex=2048
"$B" -b -P hero/render_views.py -- $W/hero_mesh.glb $W/mesh_views.png views=front,side,back,q   # look at it

# 4. fit the armature and skin
"$B" -b -P hero/rig.py -- $W/hero_mesh.blend $W/hero_rig.blend

# 5-7. clips + export, then the review sheets, preview and checks
"$B" -b -P hero/animate_export.py -- $W/hero_rig.blend ../../public/assets/hero/hero.glb blend=$W/hero_anim.blend
sh hero/sheets.sh ../../public/assets/hero/hero.glb $W
"$B" -b -P hero/render_views.py -- ../../public/assets/hero/hero.glb $W/preview.png views=front cell=1024x1024 fit=1.75
$PY hero/verify_glb.py ../../public/assets/hero/hero.glb
ffmpeg -y -i $W/concept.png -vf "scale=-2:'min(1400,ih)'" -q:v 3 ../../public/assets/hero/concept.jpg
```

Current build: concept seed 66 (second prompt), Trellis seed 101. Seeds 56 and 202 gave a lump at the
back of the jacket and stray texture patches, which is why renders are checked before rigging.

Useful switches: `mesh_prep.py ... yaw=180` if Trellis returns the figure facing away,
`animate_export.py ... test=1 clips=test` exports a clip of single-joint poses to check sign conventions,
`render_views.py ... clip=walk frames=0,8,16 views=side,front` for any contact sheet.

## Files

| File | Stage |
| --- | --- |
| `comfy_concept.py`, `concept_prompt.txt` | 1. concept image |
| `comfy_hero3d.py` | 2. Trellis 2 image to mesh |
| `mesh_prep.py` | 3. clean up, decimate, bake, normalise |
| `rig.py` | 4. joint fitting from mesh slices, bone-heat skinning with fallbacks |
| `animate_export.py` | 6-7. procedural clips, GLB export |
| `render_views.py`, `sheets.sh` | review renders and contact sheets |
| `verify_glb.py` | reads the GLB back and prints the contract facts |

## GLB contract

The site code may rely on exactly this, and a replacement file must keep it.

- One file, `public/assets/hero/hero.glb`, under 5 MB. No cameras, no lights.
- One skinned mesh (`Hero`), one material, one embedded base-colour texture (JPEG, 2048), 4 influences per vertex.
- Units and axes: 1 unit = 1 m, **1.75 tall**, Y up, feet on y = 0, centred on x and z,
  **facing +Z** (toward a default three.js camera), the character's left is +X. Root node has no transform.
- Bind pose: relaxed A-pose.
- Skeleton, 22 joints, exact names:
  `mixamorig:Hips`, `mixamorig:Spine`, `mixamorig:Spine1`, `mixamorig:Spine2`, `mixamorig:Neck`, `mixamorig:Head`,
  `mixamorig:LeftShoulder`, `mixamorig:LeftArm`, `mixamorig:LeftForeArm`, `mixamorig:LeftHand`,
  `mixamorig:RightShoulder`, `mixamorig:RightArm`, `mixamorig:RightForeArm`, `mixamorig:RightHand`,
  `mixamorig:LeftUpLeg`, `mixamorig:LeftLeg`, `mixamorig:LeftFoot`, `mixamorig:LeftToeBase`,
  `mixamorig:RightUpLeg`, `mixamorig:RightLeg`, `mixamorig:RightFoot`, `mixamorig:RightToeBase`.
  No finger bones. (three.js strips the colon when it sanitises names: look bones up as `mixamorigHips` there.)
- Clips, 30 fps, all in place (the hips only bob and sway a centimetre or two, never travel):

  | Name | Length | Use |
  | --- | --- | --- |
  | `idle` | 4.0 s | loop. Arms at the sides, breathing, slow weight shift |
  | `walk` | 1.1 s | loop, one full cycle, starts on the left heel strike |
  | `wave` | 2.6 s | one-shot, right hand. Starts and ends on the first idle frame |
  | `think` | 3.0 s | one-shot. Reaches hand-on-chin by 0.8 s and holds: clamp on the last frame |

  The site moves the character itself; at 1.1 s per cycle the planted feet cover about 0.60 units of ground per cycle
  (0.55 units per second), so match that speed to avoid foot sliding.

## Swapping in a better model

Any Mixamo-style file works as long as it meets the contract above.

1. Rig the new character on Mixamo (or any tool that keeps the `mixamorig:` names). Download the character
   with skin, and each animation as "in place".
2. In Blender, import them into one armature, name the actions `idle`, `walk`, `wave`, `think`, and put each
   on its own NLA track with the same name.
3. Scale the armature so the figure is 1.75 tall, feet on the ground plane, facing -Y in Blender. Mixamo FBX
   files come in at 0.01 scale: apply the scale to armature and mesh (and rescale the hips location curves)
   rather than leaving it on the root.
4. Export glTF binary: +Y up, animation mode "NLA Tracks", images as JPEG, no cameras or lights.
5. Run `verify_glb.py` on the result and compare with the contract. Extra finger bones are fine; missing or
   renamed bones, a different height, a different facing or root motion in `walk` are not.

To keep this mesh but improve only the motion, edit the pose functions in `animate_export.py` and rerun the
last block. To keep the motion on a new mesh from this pipeline, rerun from stage 2 or 3: joints are refitted
automatically.
