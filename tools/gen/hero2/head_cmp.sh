#!/bin/sh
# usage: head_cmp.sh <mesh.blend> <out_prefix>  -> <out>_a.jpg (front, q, side, back...) <out>_b.jpg close
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
V3=src/hero2/face/hero_basecolor_v3.png
"$B" -b -P hero2/review.py -- $1 $2_a.jpg basecolor=$V3 cell=700 cols=4 set=head >/dev/null 2>&1
"$B" -b -P hero2/review.py -- $1 $2_b.jpg basecolor=$V3 cell=700 cols=3 "shots=front:0,1.60,0,.24,0,0,1;q:0,1.60,0,.24,.7,.05,.7;side:0,1.60,0,.24,1,0,0" >/dev/null 2>&1
