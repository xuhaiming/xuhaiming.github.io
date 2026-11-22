#!/bin/sh
# usage: face_review.sh <atlas.png> <out_prefix>   -> <out>_a.jpg (face set), <out>_b.jpg (close-ups)
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
W=src/hero2
"$B" -b -P hero2/review.py -- $W/hero_mesh.blend $2_a.jpg set=face basecolor=$1 cell=800 cols=4 >/dev/null 2>&1
"$B" -b -P hero2/review.py -- $W/hero_mesh.blend $2_b.jpg basecolor=$1 cell=1000 cols=3 "shots=eyes:0,1.62,0.1,.12,0,0,1;mouth:0,1.55,0.1,.12,0,0,1;hair:0,1.68,0,.2,0.3,0.5,1" >/dev/null 2>&1
"$B" -b -P hero2/review.py -- $W/hero_mesh.blend $2_c.jpg basecolor=$1 cell=800 cols=4 set=head >/dev/null 2>&1
