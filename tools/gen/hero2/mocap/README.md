# Mocap for the hero character

Real motion capture for the site's four clips, cleaned and ready to bake onto the rig. Scripts live here;
data and renders go to `tools/gen/src/hero2/mocap/` (gitignored).

| Clip | Source take | Prepared | Notes |
| --- | --- | --- | --- |
| `walk` | CMU 136_21 "Normal Walk", raw frames 89-383 | 2 cycles, 2.433 s, loop, starts on the left heel strike | runner-up 81_17, then 35_29 |
| `idle` | CMU 82_08 "stand still; casual walk forward", raw frames 65-797 | 6.1 s loop | runner-up 113_21 |
| `wave` | CMU 113_27 "Wave" (upper body), raw frames 22-322 | 2.5 s one-shot on the first idle frame | runner-up 141_16 |
| `think` | none | not produced | CMU has no standing chin-in-hand take (74_12 "thinker" is seated): keyframe it on the first idle frame |

Exact frame ranges, timings, stride and what was cleaned are in `clips/manifest.json`, written by `prepare.py`.

## Source and licence

CMU Graphics Lab Motion Capture Database, <http://mocap.cs.cmu.edu>. Their terms: "This data is free for use in
research and commercial projects worldwide." They ask for this acknowledgement where results are published:
"The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from
NSF EIA-0196217."

The files used are the BVH conversion by Bruce Hahne (cgspeed.com, 2010 release, same terms), fetched from the
mirror <https://github.com/una-dinosauria/cmu-mocap> (`data/<subject>/<take>.bvh`). Its `READMEFIRST.txt` and
the take index are kept next to the raw files in `src/hero2/mocap/raw/cmu/`. Nothing else was downloaded;
Bandai Namco, LAFAN1 and 100STYLE (all non-commercial licences) were not needed.

## Rerun

From `tools/gen/` in Git Bash:

```sh
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
W=src/hero2/mocap
R=https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master

# 0. fetch the takes (only motion files and the readme)
mkdir -p $W/raw/cmu
curl -sfL -o $W/raw/cmu/READMEFIRST.txt $R/READMEFIRST.txt
for t in 136/136_21 082/82_08 113/113_27; do curl -sfL -o $W/raw/cmu/${t#*/}.bvh $R/data/$t.bvh; done

# 1. (shortlisting only) measure walks, look at a take
python -I hero2/mocap/scan_walks.py $W/raw/cmu
"$B" -b -P hero2/mocap/sheet.py -- $W/raw/cmu/136_21.bvh $W/preview/walk_136_21.png cycle=-1 n=12 title=136_21

# 2. clean the chosen takes -> $W/clips/{idle,walk,wave}.bvh + manifest.json
python -I hero2/mocap/prepare.py $W/raw/cmu $W/clips            # walk=81_17 etc. swaps a take

# 3. bake onto a rig
"$B" -b <rig.blend> -P hero2/mocap/retarget.py -- clips=$W/clips out=<rig_anim.blend> report=<report.json>

# 4. look at the result
"$B" -b -P hero2/mocap/sheet.py -- <rig_anim.blend> $W/proof/walk.png action=walk frames=0,3,6,9,12,15,18,21,24,27,30,33,36
```

The stand-in used to prove step 3 before the real rig exists:

```sh
"$B" -b -P hero2/mocap/make_standin.py -- $W/standin/standin_T.blend rolls=odd     # or pose=A
"$B" -b $W/standin/standin_T.blend -P hero2/mocap/retarget.py -- clips=$W/clips \
    out=$W/standin/standin_T_anim.blend report=$W/standin/standin_T_report.json
```

## Files

| File | What it does |
| --- | --- |
| `bvh.py` | BVH read / write / forward kinematics, quaternion helpers. numpy only |
| `motion.py` | re-rest, two-bone IK, foot planting, reach fixes. Shared by prepare and retarget |
| `scan_walks.py` | one row of gait numbers per walk take (speed, cycle, bob, lean, arm swing, symmetry) |
| `sheet.py` | Blender: contact sheet of a BVH (stick figure) or of an action on a rig (its meshes) |
| `prepare.py` | raw takes to clean 30 fps in-place clips plus `manifest.json` |
| `make_standin.py` | Blender: Mixamo-named test rig with a blocky body |
| `retarget.py` | Blender: bake the clips onto a rig as actions `idle`, `walk`, `wave` |

## What prepare.py does

- drops the T-pose frame the cgspeed files start with and uses it as the reference: output BVHs are re-rested
  so **zero rotation = T-pose**, with feet flat and pointing ahead;
- low-pass at the native 120 fps (walk about 8 Hz, wave 5 Hz, idle 2.3 Hz), resample to 30 fps;
- turns the motion to face +Z, converts to metres;
- walk: picks the best-matching one or two cycles between left heel strikes, stretches the loop to a whole
  number of frames, removes forward travel as a constant speed (bob, sway and the small fore-aft pulse of the
  hips stay), spreads the loop gap over the clip, pins the ball of each planted foot to the moving ground and
  re-solves the legs with IK, keeps the toes flat while the ball is down;
- idle: searches the standing part for the best 4.5-7.5 s loop, locks both feet, tames the subject's
  look-around (head keeps 15 %, spine 60 %), and corrects the stance (pelvis back 6 cm and up 2 cm: the CMU
  skeleton fit leaves the knees bent 20-28 degrees);
- wave: right arm from the wave take, spine / head / left arm as changes from that take's settled pose, faded
  onto the first idle frame; hips and legs are the first idle frame. Starts and ends exactly on it;
- both legs are made the same length (CMU fits each side separately).

## What retarget.py needs from the rig

- Bone names: the Mixamo set with any prefix (`mixamorig:Hips` or `Hips`): Hips, Spine, Spine1, Spine2, Neck,
  Head, and Left/Right Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase. Missing ones stop the script.
  Finger chains `LeftHandThumb1..3`, `Index`, `Middle`, `Ring`, `Pinky` are optional. Anything else under the
  hips (face bones, twist bones) is left untouched and simply follows its parent.
- Rest pose: T-pose, figure upright along world Z, facing -Y, left side on +X, soles on z = 0, feet flat and
  pointing straight ahead. Arms and legs that are off (A-pose, bent knees) are corrected by direction; a foot
  that is turned out or tilted in the rest pose is not.
- Bone rolls: any. The rotation is computed in world space and converted into each bone's rest frame.
- Armature object: any location / rotation / uniform scale (world-space rest positions are used). Bones must
  inherit rotation (the default). The hips bone should be a root or have an unanimated parent.
- Size: any; hips travel and stride scale with (rig thigh + shin) / (source thigh + shin).

The script prints `RETARGET WARNING:` lines when these do not hold, and writes per clip into the report:
stride and ground speed **on that rig** (use these in the site, not the numbers in the manifest), how far a
flat foot drifts, lowest toe height, knee direction, hips bob, seam continuity.

Output: actions `idle`, `walk`, `wave` (fake user, quaternion keys on every frame, hips location), one NLA
track per action with the same name, pose reset to rest. Frame 0 is the first frame; loops have N + 1 frames
with the last equal to the first.

## Known limits

- `think` is missing (see the table). The first frame of `idle` is the pose to build it on.
- No finger capture in CMU: fingers get a static relaxed curl; the waving hand opens while it is up.
- No face motion.
- The idle is one performer's 6 s of standing with the look-around turned down; it is calm, and its breathing
  is whatever the spine markers caught (little).
- Wave is a composite across two performers, checked only on the stand-in. On a rig with a different
  shoulder width or arm length the hand ends up at a slightly different height.
- Arms are not IK-corrected: on a wide torso the hanging arms may brush the body in walk or idle. Check a
  front-view sheet on the real mesh.
- The retarget was proved on generated rigs (T-pose with odd rolls, and a 40 degree A-pose), not on a real
  Mixamo export, and the glTF export of the result was not exercised.
