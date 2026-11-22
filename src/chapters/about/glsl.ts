/** GLSL shared by the x-ray overlays. They all skin themselves from the hero's bone texture in world space. */

export const NOISE = /* glsl */ `
float hash31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

/** the lens: a disc in framebuffer pixels whose rim breaks into a dot screen */
export const LENS = /* glsl */ `
uniform vec4 uLens; // centre xy (px), radius (px), dot cell (px)
float lensMask(vec2 fc) {
  if (uLens.z < 1.0) return 0.0;
  vec2 cell = fc / uLens.w;
  float dc = length((floor(cell) + 0.5) * uLens.w - uLens.xy) / uLens.z;
  float r = smoothstep(1.03, 0.8, dc) * 0.76;
  return step(length(fract(cell) - 0.5), r);
}`;

/** visibility of an overlay fragment: only inside the lens, and only if this overlay is the lens view */
export const GATE = /* glsl */ `
uniform float uLensOn;
float gate(vec2 fc) {
  return uLensOn > 0.5 ? lensMask(fc) : 0.0;
}`;

export const SKIN = /* glsl */ `
uniform highp sampler2D uBones;
uniform mat4 uBind;
mat4 boneM(float i) {
  int size = textureSize(uBones, 0).x;
  int j = int(i) * 4;
  int x = j % size;
  int y = j / size;
  return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0), texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0));
}
mat4 skinM(vec4 I, vec4 W) {
  return boneM(I.x) * W.x + boneM(I.y) * W.y + boneM(I.z) * W.z + boneM(I.w) * W.w;
}`;

/** vertex side of the lens: what is inside it is drawn slightly magnified, like real glass (the rim stays put) */
export const BULGE = /* glsl */ `
uniform vec4 uLens;
uniform vec2 uRes;
uniform float uBulge, uLensOn;
vec4 bulge(vec4 clip) {
  if (uLensOn < 0.5 || uLens.z < 1.0 || clip.w <= 0.0) return clip;
  vec2 px = (clip.xy / clip.w * 0.5 + 0.5) * uRes;
  vec2 o = px - uLens.xy;
  float d = length(o) / uLens.z;
  if (d >= 1.0) return clip;
  vec2 np = uLens.xy + o * (1.0 + uBulge * (1.0 - d * d));
  clip.xy = (np / uRes * 2.0 - 1.0) * clip.w;
  return clip;
}`;
