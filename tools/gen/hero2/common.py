"""Shared helpers for the hero2 stage-1 scripts (Blender 5.0, headless)."""
import bpy, sys, time
import numpy as np

T0 = time.time()
def log(*a):
    print("[hero2 %6.1fs]" % (time.time() - T0), *a, flush=True)

def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    pos = [a for a in argv if "=" not in a]
    opt = dict(a.split("=", 1) for a in argv if "=" in a)
    return pos, opt

def coords(me):
    c = np.empty(len(me.vertices) * 3, np.float64); me.vertices.foreach_get("co", c)
    return c.reshape(-1, 3)

def tri_array(me):
    me.calc_loop_triangles()
    t = np.empty(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get("vertices", t)
    return t.reshape(-1, 3)

def edge_array(me):
    e = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", e)
    return e.reshape(-1, 2)

def components(nv, edges):
    """Connected components by label propagation with pointer jumping (numpy only). Returns labels 0..n-1, n."""
    lab = np.arange(nv, dtype=np.int64)
    a, b = edges[:, 0], edges[:, 1]
    while True:
        m = np.minimum(lab[a], lab[b])
        new = lab.copy()
        np.minimum.at(new, a, m); np.minimum.at(new, b, m)
        while True:                      # pointer jumping
            nn = new[new]
            if np.array_equal(nn, new): break
            new = nn
        if np.array_equal(new, lab): break
        lab = new
    uniq, inv = np.unique(lab, return_inverse=True)
    return inv, len(uniq)

def adjacency(nv, edges):
    """CSR neighbour lists."""
    both = np.concatenate([edges, edges[:, ::-1]])
    order = np.argsort(both[:, 0], kind="stable")
    nbr = both[order, 1]
    start = np.searchsorted(both[order, 0], np.arange(nv + 1))
    return nbr, start

def manifold_report(me):
    """Counts of boundary / non-manifold edges (edge used by 1 or >2 faces)."""
    t = tri_array(me)
    e = np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]])
    e.sort(1)
    key = e[:, 0] * (len(me.vertices) + 1) + e[:, 1]
    _, cnt = np.unique(key, return_counts=True)
    return {"edges": int(len(cnt)), "boundary": int((cnt == 1).sum()), "nonmanifold": int((cnt > 2).sum())}

def activate(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.hide_set(False); ob.hide_viewport = False
    ob.select_set(True); bpy.context.view_layer.objects.active = ob

# ---------------------------------------------------------------- regions (Blender coords: x, y = -glTF z, z = glTF y)
WRIST_X = 0.685      # |x| beyond which the mesh is hand (end of the jacket cuff), measured on the source
REG_BODY, REG_HEAD, REG_HAND_L, REG_HAND_R = 0, 1, 2, 3

def region_of(co):
    """0 body/clothes, 1 head (everything above the collar rim), 2 left hand (+x), 3 right hand (-x)."""
    x, zf, y = co[:, 0], -co[:, 1], co[:, 2]
    rim = 1.534 - 0.30 * np.clip(zf + 0.10, 0.0, 0.2)      # the collar rim slopes down towards the front
    reg = np.zeros(len(co), np.int8)
    reg[(y > rim) & (np.abs(x) < 0.13)] = REG_HEAD
    reg[x > WRIST_X] = REG_HAND_L
    reg[x < -WRIST_X] = REG_HAND_R
    return reg

# face feature boxes (glTF x, y; front half of the head only), used for extra density: (cx, cy, half width, half height)
FACE_BOX = (0.002, 1.575, 0.062, 0.075)
FEATURES = [(-0.031, 1.624, 0.028, 0.024), (0.035, 1.624, 0.028, 0.024), (0.002, 1.545, 0.040, 0.024)]   # eye+brow R, eye+brow L, mouth

def face_level(co):
    """0 elsewhere, 1 on the face front, 2 around eyelids / brows / mouth."""
    x, zf, y = co[:, 0], -co[:, 1], co[:, 2]
    lvl = np.zeros(len(co), np.int8)
    front = zf > 0.02
    cx, cy, hw, hh = FACE_BOX
    lvl[front & (np.abs(x - cx) < hw) & (np.abs(y - cy) < hh)] = 1
    for cx, cy, hw, hh in FEATURES:
        lvl[front & (np.abs(x - cx) < hw) & (np.abs(y - cy) < hh)] = 2
    return lvl

SUB_NAMES = ["rest", "hair", "head_skin", "face_feat", "hand_l", "hand_r"]

def subregion_of(me):
    """finer split used for the triangle budget: 0 rest, 1 hair, 2 head skin (face, ears, neck), 3 eyes/brows/mouth, 4 hand L, 5 hand R.
    Hair comes from the point attribute "hair" written by s2_hairmask.py (it is interpolated through decimation)."""
    co = coords(me); reg = region_of(co); fl = face_level(co)
    hair = np.zeros(len(co), np.float32)
    if "hair" in me.attributes: me.attributes["hair"].data.foreach_get("value", hair)
    sub = np.zeros(len(co), np.int8)
    head = reg == REG_HEAD
    sub[head] = 2
    sub[head & (hair > 0.5)] = 1
    sub[head & (hair <= 0.5) & (fl == 2)] = 3
    sub[reg == REG_HAND_L] = 4; sub[reg == REG_HAND_R] = 5
    return sub

def sub_tris(me):
    sub = subregion_of(me); t = tri_array(me)
    r = np.sort(sub[t], 1)[:, 1]
    d = {n: int((r == i).sum()) for i, n in enumerate(SUB_NAMES)}
    d["total"] = int(len(t)); d["head"] = d["hair"] + d["head_skin"] + d["face_feat"]
    return d

def region_tris(me):
    """triangle count per region (a triangle belongs to the region of the majority of its corners)"""
    reg = region_of(coords(me)); t = tri_array(me)
    r = np.sort(reg[t], 1)[:, 1]
    return {"total": int(len(t)), "head": int((r == 1).sum()), "hand_l": int((r == 2).sum()), "hand_r": int((r == 3).sum()), "rest": int((r == 0).sum())}
