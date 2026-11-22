#!/bin/sh
# Review sheets for hero2 stage 1: the raw source on top, the low-poly result below, same cameras.
# usage (from tools/gen): sh hero2/sheets.sh src/hero2
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.0/blender.exe}"
W="$1"
D="$(dirname "$0")"
for S in body head hair face hands parts; do
  case $S in body|parts) CELL=900 ;; *) CELL=800 ;; esac
  "$B" -b -P "$D/review.py" -- "$W/hero_hi.blend"  "$W/_raw_$S.png" obj=HeroHi set=$S cell=$CELL cols=4 mode=diffuse | grep wrote
  "$B" -b -P "$D/review.py" -- "$W/hero_mesh.glb"  "$W/_new_$S.png" set=$S cell=$CELL cols=4 mode=diffuse | grep wrote
  ffmpeg -y -loglevel error -i "$W/_raw_$S.png" -i "$W/_new_$S.png" -filter_complex "[0]pad=iw:ih+24:0:0:black[a];[a][1]vstack" -q:v 2 "$W/review_$S.jpg"
  rm -f "$W/_raw_$S.png" "$W/_new_$S.png"
done
# lit with metallic / roughness / normal map, and the triangle layout
"$B" -b -P "$D/review.py" -- "$W/hero_mesh.glb" "$W/review_pbr.jpg" set=body,head cell=800 cols=4 mode=pbr | grep wrote
"$B" -b -P "$D/review.py" -- "$W/hero_mesh.glb" "$W/review_wire.jpg" cell=1100 cols=4 mode=wire \
  shots="face:0,1.585,0,.24,0,0,1;q_left:0,1.615,0,.34,.7,.1,.7;left:0,1.615,0,.34,1,0,0;top:0,1.65,0,.34,0,1,.001;handL_top:.755,1.31,-.01,.2,0,1,.001;handL_palm:.755,1.31,-.01,.2,0,-1,.001;torso:0,1.2,0,.7,0,0,1;legs:0,.45,0,.95,0,0,1" | grep wrote
"$B" -b -P "$D/uv_layout.py" -- "$W/hero_mesh.blend" "$W/review_uv.png" size=2048 | grep islands
# landmarks (red = measured, yellow = estimated): face and hands on the textured mesh, body as x-ray
"$B" -b -P "$D/review.py" -- "$W/hero_mesh.glb" "$W/review_landmarks_detail.jpg" marks="$W/landmarks.json" mark_r=0.0016 cell=1000 cols=3 mode=diffuse   shots="face:0,1.585,0,.2,0,0,1;face_q:0,1.585,0,.2,.6,0,.8;face_side:0,1.585,0.03,.2,1,0,0;handL_top:.755,1.31,-.01,.2,0,1,.001;handR_top:-.755,1.31,-.01,.2,0,1,.001;handL_front:.755,1.31,-.01,.2,0,.2,1" | grep wrote
"$B" -b -P "$D/review.py" -- "$W/hero_mesh.glb" "$W/review_landmarks_body.jpg" marks="$W/landmarks.json" mark_r=0.009 cell=1100 cols=3 mode=clay xray=1   shots="front:0,.875,0,1.9,0,0,1;side:0,.875,0,1.9,1,0,0;top:0,1.3,0,1.9,0,1,.001" | grep wrote
