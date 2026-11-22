#!/bin/sh
# Render the review contact sheets for a hero GLB.  usage: sheets.sh <hero.glb> <out dir>
B="/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
D="$(cd "$(dirname "$0")" && pwd)"
r() { "$B" -b -P "$D/render_views.py" -- "$@" 2>&1 | grep -E "wrote|Error|no clip"; }
r "$1" "$2/sheet_walk.png"  views=side,front clip=walk  frames=0,4,8,12,16,20,24,28,32 cell=256x400 fit=1.75
r "$1" "$2/sheet_idle.png"  views=front,side,back,q clip=idle frames=0,60 cell=384x576 fit=1.75
r "$1" "$2/sheet_wave.png"  views=front,q clip=wave  frames=0,10,20,28,36,44,60,78 cell=256x400 fit=1.75
r "$1" "$2/sheet_think.png" views=front,q clip=think frames=0,10,24,60,90 cell=320x480 fit=1.75
