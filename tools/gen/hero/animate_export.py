"""Stages 6-7 (Blender): author the clips procedurally and export the web GLB.
usage: blender -b -P animate_export.py -- <hero_rig.blend> <out.glb> [jpeg=85] [blend=<save.blend>]

Clips (30 fps, all in place, one NLA track each -> one glTF animation each):
  idle  4.0 s  loop      arms relaxed at the sides, breathing, slow weight shift
  walk  1.1 s  loop      treadmill walk: planted feet via 2-bone IK in the sagittal plane, hip bob,
                         pelvis/chest counter-twist, arm counter-swing
  wave  2.6 s  one-shot  starts and ends in the idle pose, right hand
  think 3.0 s  one-shot  moves into hand-on-chin over 0.8 s and holds (clamp on the last frame)

Poses are written in a "canonical" space where every arm bone hangs straight down and rotations are
about the character's own axes (X = its left, -Y = forward, Z = up), carried down the hierarchy.
That keeps the animation code independent of bone rolls and of the A-pose angle of the bind pose."""
import bpy, sys, math, os
from mathutils import Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], os.path.abspath(argv[1])
opt = dict(a.split("=", 1) for a in argv[2:])
FPS = 30
PRE = "mixamorig:"

bpy.ops.wm.open_mainfile(filepath=src)
scene = bpy.context.scene
scene.render.fps = FPS
arm = bpy.data.objects["Armature"]; mesh = bpy.data.objects["Hero"]
bones = arm.data.bones
ORDER = []
def walk_tree(b):
    ORDER.append(b.name)
    for c in b.children: walk_tree(c)
walk_tree(bones[PRE + "Hips"])
REST = {n: bones[n].matrix_local.to_quaternion() for n in ORDER}
PARENT = {n: (bones[n].parent.name if bones[n].parent else None) for n in ORDER}
DOWN = Vector((0, 0, -1))
F = {}
for n in ORDER:
    short = n[len(PRE):]
    if short.endswith(("Arm", "ForeArm", "Hand")):
        F[n] = DOWN.rotation_difference((bones[n].tail_local - bones[n].head_local).normalized())
    else:
        F[n] = Quaternion()

def rx(d): return Quaternion((1, 0, 0), math.radians(d))
def ry(d): return Quaternion((0, 1, 0), math.radians(d))
def rz(d): return Quaternion((0, 0, 1), math.radians(d))

# ---- leg geometry for the IK
def P(n): return bones[PRE + n].head_local
hipL, kneeL, ankL = P("LeftUpLeg"), P("LeftLeg"), P("LeftFoot")
L1 = math.hypot(kneeL.y - hipL.y, kneeL.z - hipL.z); L2 = math.hypot(ankL.y - kneeL.y, ankL.z - kneeL.z)
TH1_REST = math.atan2(-(kneeL.y - hipL.y), hipL.z - kneeL.z)
TH2_REST = math.atan2(-(ankL.y - kneeL.y), kneeL.z - ankL.z)
F0 = -(ankL.y - hipL.y); H0 = hipL.z - ankL.z
LEG = H0

def leg_ik(f, h):
    """Ankle target f forward / h below the hip -> canonical (thigh, shin, shin-world) pitch deltas in degrees."""
    d = min(math.hypot(f, h), (L1 + L2) * 0.9995)
    a = math.atan2(f, h)
    K = math.acos(max(-1, min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))))
    b = math.acos(max(-1, min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))))
    th1 = a + b; th2 = th1 - (math.pi - K)
    d1 = math.degrees(th1 - TH1_REST); d2 = math.degrees(th2 - TH2_REST)
    return d1, d2

def new_pose():
    p = {n[len(PRE):]: Quaternion() for n in ORDER}
    p["loc"] = Vector((0, 0, 0))
    return p

def set_leg(p, side, f, h, foot_pitch=0.0, toe=0.0, roll=0.0, yaw=0.0):
    """roll > 0 moves the foot toward the character's right (-X); yaw about the up axis."""
    d1, d2 = leg_ik(f, h)
    p[side + "UpLeg"] = rz(yaw) @ ry(roll) @ rx(-d1)
    p[side + "Leg"] = rx(-(d2 - d1))
    p[side + "Foot"] = rx(foot_pitch + d2) @ ry(-roll)
    p[side + "ToeBase"] = rx(toe)

def set_arm(p, side, flex=0.0, abd=0.0, twist=0.0, elbow=0.0, fore_twist=0.0, wrist=0.0, wrist_side=0.0):
    """flex: forward +. abd: away from the body +. twist: internal rotation + (a bent forearm swings across the body)."""
    s = 1 if side == "Left" else -1
    p[side + "Arm"] = ry(-s * abd) @ rx(-flex) @ rz(-s * twist)
    p[side + "ForeArm"] = rx(-elbow) @ rz(-s * fore_twist)
    p[side + "Hand"] = rx(-wrist) @ ry(-s * wrist_side)

def smooth(x):
    x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

# ---------------------------------------------------------------- clips
ARM_ABD = 8.0   # how far the relaxed arms stay off the jacket

def idle_pose(t, T=4.0):
    w = 2 * math.pi * t / T
    breath = math.sin(w); sway = math.sin(w - 1.1); slow = math.sin(w + 0.6)
    p = new_pose()
    dx = 0.010 * sway                                   # hips drift sideways over planted feet
    p["loc"] = Vector((dx, 0, -0.004 - 0.002 * breath))
    hip_roll = -1.2 * sway
    p["Hips"] = ry(hip_roll) @ rz(0.8 * slow)
    comp = math.degrees(math.atan2(dx, LEG))            # legs lean back so the feet stay put
    for side in ("Left", "Right"):
        set_leg(p, side, F0, H0 - 0.004 - 0.002 * breath, roll=comp - hip_roll, yaw=-0.8 * slow)
    p["Spine"] = ry(-hip_roll * 0.6) @ rx(0.6 + 0.5 * breath)
    p["Spine1"] = ry(-hip_roll * 0.4) @ rx(-0.9 * breath) @ rz(-0.5 * slow)
    p["Spine2"] = rx(-0.7 * breath) @ rz(-0.3 * slow)
    p["Neck"] = rx(0.5 * breath) @ rz(0.6 * math.sin(w + 2.0))
    p["Head"] = rx(0.8 * breath + 0.3) @ rz(1.0 * math.sin(w + 2.0)) @ ry(0.5 * sway)
    for side, ph in (("Left", 0.0), ("Right", 0.9)):
        s = 1 if side == "Left" else -1
        p[side + "Shoulder"] = ry(s * (0.8 + 0.9 * breath))   # shoulders rise a touch on the in-breath
        set_arm(p, side, flex=1.5 + 0.8 * math.sin(w + ph), abd=ARM_ABD + 0.7 * breath, twist=-15,
                elbow=13 + 1.5 * math.sin(w + ph + 0.5), wrist=4)
    return p

def walk_pose(ph):
    """ph in [0,1): 0 = left heel strike."""
    w = 2 * math.pi * ph
    step = 0.52 * LEG
    LEAD = 0.40                                  # heel strikes 0.40 step ahead of the hip, toe leaves 0.60 behind
    # hips are lowest at heel strike, where the leading leg is almost straight, and rise 2 cm over mid-stance
    bob = 0.022 * LEG / 0.70
    strike = H0 - math.sqrt((0.994 * (L1 + L2)) ** 2 - (F0 + LEAD * step) ** 2)
    drop = strike - bob * (0.5 - 0.5 * math.cos(2 * w))
    p = new_pose()
    pel_yaw = -5.0 * math.cos(w)                 # left hip forward at left heel strike
    pel_roll = -2.5 * math.sin(w)                # swing-side hip drops
    sway = 0.012 * math.sin(w - 0.5)             # body over the stance foot
    p["loc"] = Vector((sway, 0, -drop))
    p["Hips"] = rz(pel_yaw) @ ry(pel_roll) @ rx(5.0)
    for side, off in (("Left", 0.0), ("Right", 0.5)):
        s = 1 if side == "Left" else -1
        q = (ph + off) % 1.0
        if q < 0.6:                              # stance: foot travels straight back at ground speed
            fwd = step * (LEAD - q / 0.6)
            if q < 0.12: pitch = -16 * (1 - q / 0.12)
            elif q < 0.40: pitch = 0.0
            else: pitch = 40 * smooth((q - 0.40) / 0.20)
            lift = 0.105 * math.sin(math.radians(max(pitch, 0)))
            toe = -max(pitch, 0) * 0.9
        else:                                    # swing
            u = (q - 0.6) / 0.4
            e = smooth(u)
            fwd = step * (LEAD - 1 + e)
            pitch = 40 + (-16 - 40) * smooth(u * 1.25)
            lift = 0.105 * math.sin(math.radians(40)) * (1 - u) ** 2 + 0.075 * LEG / 0.71 * math.sin(math.pi * u) ** 1.3
            toe = -36 * (1 - smooth(u * 4))
        narrow = 2.5                             # feet track closer to the midline than the A-pose stance
        comp = math.degrees(math.atan2(sway, LEG))
        set_leg(p, side, F0 + fwd, H0 - drop - lift, foot_pitch=pitch, toe=toe,
                roll=s * narrow + comp - pel_roll, yaw=-pel_yaw)
    chest_yaw = 4.5 * math.cos(w)                # chest counter-rotates against the pelvis
    dyaw = chest_yaw - pel_yaw
    p["Spine"] = rz(dyaw * 0.3) @ ry(-pel_roll * 0.5) @ rx(2.0)
    p["Spine1"] = rz(dyaw * 0.35) @ ry(-pel_roll * 0.4) @ rx(2.0)
    p["Spine2"] = rz(dyaw * 0.35) @ ry(-pel_roll * 0.2) @ rx(1.0)
    p["Neck"] = rz(-chest_yaw * 0.5) @ rx(-2.0)
    p["Head"] = rz(-chest_yaw * 0.5) @ rx(-2.5 + 0.8 * math.cos(2 * w))
    for side, off in (("Left", 0.5), ("Right", 0.0)):   # arm forward with the opposite leg
        s = 1 if side == "Left" else -1
        c = math.cos(2 * math.pi * (ph + off) - 0.25)   # +1 = arm fully forward, slightly late
        p[side + "Shoulder"] = rz(s * 1.5 * c)
        set_arm(p, side, flex=-2 + 18 * c, abd=ARM_ABD + 1.0 * c, twist=-18 + 8 * c,
                elbow=14 + 16 * (0.5 + 0.5 * c), wrist=4)
    return p

def blend(a, b, w):
    out = {}
    for k in a:
        out[k] = a[k].lerp(b[k], w) if k == "loc" else a[k].slerp(b[k], w)
    return out

def wave_pose(t, T=2.6):
    base = idle_pose(t * 4.0 / T * 0.0)           # hold the idle start pose underneath
    p = dict(base)
    up = smooth(t / 0.45) * (1 - smooth((t - (T - 0.6)) / 0.55))
    k = math.sin(2 * math.pi * (t - 0.35) / 0.52) * smooth((t - 0.3) / 0.25) * (1 - smooth((t - (T - 0.75)) / 0.3))
    target = dict(base)
    set_arm(target, "Right", flex=62, abd=58, twist=-38 + 4 * k, elbow=92 + 20 * k, fore_twist=-55, wrist=-6, wrist_side=10 * k)
    target["RightShoulder"] = ry(-9)
    target["Spine2"] = base["Spine2"] @ ry(1.5) @ rz(-2)
    target["Head"] = base["Head"] @ rz(-5) @ ry(2.5)
    return blend(base, target, up)

def think_pose(t, T=3.0):
    base = idle_pose(0.0)
    hold = idle_pose(max(0.0, t - 0.8) * 0.9)     # slow breathing continues under the held pose
    w = smooth(t / 0.8)
    target = dict(hold)
    set_arm(target, "Right", flex=54, abd=2, twist=42, elbow=142, fore_twist=-50, wrist=10, wrist_side=0)
    set_arm(target, "Left", flex=8, abd=10, twist=55, elbow=84, fore_twist=10, wrist=0)
    target["RightShoulder"] = ry(-3)
    target["Spine1"] = hold["Spine1"] @ rx(1.5)
    target["Neck"] = hold["Neck"] @ rx(3) @ ry(-2)
    target["Head"] = hold["Head"] @ rx(5) @ ry(-4) @ rz(-6)
    return blend(base, target, w)

CLIPS = [  # name, frames, pose(frame)
    ("idle", 120, lambda f: idle_pose(f / FPS)),
    ("walk", 33, lambda f: walk_pose((f % 33) / 33.0)),
    ("wave", 78, lambda f: wave_pose(f / FPS)),
    ("think", 90, lambda f: think_pose(f / FPS)),
]
def test_pose(f):
    """Convention check (test=1): 0 canonical zero, 1 left arm flex 45, 2 left arm abduct 45, 3 left elbow 90,
    4 right arm twist 45 + elbow 90, 5 left foot 0.2 forward, 6 left foot lifted 0.15, 7 spine yaw 30."""
    p = new_pose()
    for side in ("Left", "Right"): set_leg(p, side, F0, H0)
    if f == 1: set_arm(p, "Left", flex=45)
    if f == 2: set_arm(p, "Left", abd=45)
    if f == 3: set_arm(p, "Left", elbow=90)
    if f == 4: set_arm(p, "Right", twist=45, elbow=90)
    if f == 5: set_leg(p, "Left", F0 + 0.2, H0 - 0.03)
    if f == 6: set_leg(p, "Left", F0, H0 - 0.15)
    if f == 7: p["Spine1"] = rz(30)
    return p
if opt.get("test"):
    CLIPS.append(("test", 7, test_pose))
if "clips" in opt:
    CLIPS = [c for c in CLIPS if c[0] in opt["clips"].split(",")]

# ---------------------------------------------------------------- bake to actions
bpy.context.view_layer.objects.active = arm
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
arm.animation_data_create()
last = {}

def apply(pose, frame):
    Wd = {}
    C = {}
    for n in ORDER:
        short = n[len(PRE):]; par = PARENT[n]
        C[n] = (C[par] @ pose[short]) if par else pose[short]
        Wd[n] = C[n] @ F[n].inverted()
        local = (Wd[par].inverted() @ Wd[n]) if par else Wd[n]
        q = REST[n].inverted() @ local @ REST[n]
        if n in last and last[n].dot(q) < 0: q.negate()
        last[n] = q.copy()
        pb = arm.pose.bones[n]
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    hips = arm.pose.bones[PRE + "Hips"]
    hips.location = REST[PRE + "Hips"].inverted() @ pose["loc"]
    hips.keyframe_insert("location", frame=frame)

for name, nframes, fn in CLIPS:
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    last.clear()
    for f in range(nframes + 1):
        apply(fn(f), f)
    arm.animation_data.action = None
    track = arm.animation_data.nla_tracks.new(); track.name = name
    strip = track.strips.new(name, 0, act); strip.name = name
    try:
        if strip.action_slot is None: strip.action_slot = act.slots[0]
    except Exception:
        pass
    strip.action_frame_start, strip.action_frame_end = 0, nframes
    track.mute = True
    print("[anim] clip", name, nframes, "frames", round(nframes / FPS, 3), "s")
for pb in arm.pose.bones:
    pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)
for t in arm.animation_data.nla_tracks:
    t.mute = False
scene.frame_start, scene.frame_end = 0, 120
scene.frame_set(0)

if "blend" in opt:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt["blend"]))

# ---------------------------------------------------------------- export
for o in list(scene.objects):
    if o not in (arm, mesh):
        bpy.data.objects.remove(o)
for k in list(arm.keys()):
    del arm[k]
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", use_selection=False,
    export_yup=True, export_apply=False, export_extras=False,
    export_cameras=False, export_lights=False,
    export_materials="EXPORT", export_image_format="JPEG", export_jpeg_quality=int(opt.get("jpeg", 85)),
    export_texcoords=True, export_normals=True, export_tangents=False, export_vertex_color="NONE",
    export_skins=True, export_all_influences=False, export_def_bones=False,
    export_animations=True, export_animation_mode="NLA_TRACKS", export_frame_range=False,
    export_force_sampling=True, export_frame_step=1, export_anim_slide_to_zero=True,
    export_optimize_animation_size=False, export_morph=False,
)
print("[anim] wrote", out, os.path.getsize(out), "bytes")
