#!/bin/sh
# usage: head_compare.sh <before.blend> <after.blend> <out.jpg> [extra shots]  : before (top) / after (bottom), v3 texture
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
V3=src/hero2/face/hero_basecolor_v3.png
SH="${4:-front:0,1.60,0,.26,0,0,1;q:0,1.60,0,.26,.7,.05,.7;side:0,1.60,0,.26,1,0,0;qr:0,1.60,0,.26,-.7,.05,.7;back:0,1.60,0,.26,0,0,-1}"
"$B" -b -P hero2/review.py -- $1 $3.a.png basecolor=$V3 cell=520 cols=${COLS:-5} "shots=$SH" >/dev/null 2>&1
"$B" -b -P hero2/review.py -- $2 $3.b.png basecolor=$V3 cell=520 cols=${COLS:-5} "shots=$SH" >/dev/null 2>&1
python -c "
from PIL import Image
import sys
a=Image.open('$3.a.png');b=Image.open('$3.b.png')
s=Image.new('RGB',(a.width,a.height*2));s.paste(a,(0,0));s.paste(b,(0,a.height));s.save('$3',quality=90)
import os;os.remove('$3.a.png');os.remove('$3.b.png')"
