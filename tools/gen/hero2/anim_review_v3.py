"""anim_review.py with another base colour atlas: blender -b -P hero2/anim_review_v3.py -- <same args as anim_review.py> basecolor=<png>"""
import sys, os, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig_pose_tests as R
import anim_review as AR
_a = sys.argv[sys.argv.index("--") + 1:]
bc = [a.split("=", 1)[1] for a in _a if a.startswith("basecolor=")]
sys.argv = sys.argv[:sys.argv.index("--") + 1] + [a for a in _a if not a.startswith("basecolor=")]
_setup = R.setup
def setup(mode):
    cam = _setup(mode)
    if bc:
        new = bpy.data.images.load(os.path.abspath(bc[0]))
        for m in bpy.data.objects["Hero"].data.materials:
            b = m.node_tree.nodes.get("Principled BSDF")
            if b and b.inputs["Base Color"].links: b.inputs["Base Color"].links[0].from_node.image = new
    return cam
R.setup = setup
AR.main()
