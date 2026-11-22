"""Render rig_pose_tests sheets with a different base colour atlas (does not save the rig).
blender -b -P hero2/face_pose.py -- src/hero2/hero_rig.blend <outdir> basecolor=<png> only=face_blink [cell=..] [cols=..]"""
import sys, os, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig_pose_tests as R
_args = sys.argv[sys.argv.index("--") + 1:]
bc = [a.split("=", 1)[1] for a in _args if a.startswith("basecolor=")]
sys.argv = sys.argv[:sys.argv.index("--") + 1] + [a for a in _args if not a.startswith(("basecolor=", "name="))]
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
R.main()
