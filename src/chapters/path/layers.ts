import * as THREE from 'three';

/** Shader materials for the diorama: painted depth layers, their reflections, sky, water, road, mist. */

const VERT = /* glsl */ `
  uniform float uSway, uTime;
  varying vec2 vUv; varying vec3 vW;
  void main() {
    vUv = uv;
    vec3 p = position;
    vec4 w = modelMatrix * vec4(p, 1.0);
    // trees lean a little in the wind: more at the top, a different phase for every tree
    w.x += sin(uTime * 0.7 + w.x * 0.9) * uSway * uv.y * uv.y;
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

export interface LayerUniforms {
  [k: string]: THREE.IUniform;
  uMap: { value: THREE.Texture | null };
  uTint: { value: THREE.Color };
  uHaze: { value: THREE.Color };
  uHazeAmt: { value: number };
  uA: { value: number };
  uLights: { value: number };
  uTime: { value: number };
  uRep: { value: number };
  uFeather: { value: number };
  uRefl: { value: number };
  uBlur: { value: number };
  uSway: { value: number };
  uLift: { value: number };
  uSat: { value: number };
}

/**
 * A painted cut-out layer. The picture is graded in the shader (tint, haze by depth), its warm lit
 * windows are found by colour and made to glow and flicker at night, and the same material draws
 * the mirrored copy in the water (uRefl = 1) with a ripple and a fade.
 */
export function layerMaterial(tex: THREE.Texture | null, o: { rep?: number; feather?: number; refl?: boolean; blur?: number; sway?: number; sat?: number } = {}) {
  const uniforms: LayerUniforms = {
    uMap: { value: tex },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uHaze: { value: new THREE.Color(0, 0, 0) },
    uHazeAmt: { value: 0 },
    uA: { value: 1 },
    uLights: { value: 0 },
    uTime: { value: 0 },
    uRep: { value: o.rep ?? 1 },
    uFeather: { value: o.feather ?? 0 },
    uRefl: { value: o.refl ? 1 : 0 },
    uBlur: { value: o.blur ?? 0 },
    uSway: { value: o.sway ?? 0 },
    uLift: { value: 0 },
    uSat: { value: o.sat ?? 1 },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uTint, uHaze;
      uniform float uHazeAmt, uA, uLights, uTime, uRep, uFeather, uRefl, uBlur, uLift, uSat;
      varying vec2 vUv; varying vec3 vW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main() {
        vec2 uv = vec2((vUv.x - 0.5) * uRep + 0.5, vUv.y);
        float depth = vUv.y;                       // for the reflection: distance below the waterline
        if (uRefl > 0.5) {
          float k = 0.3 + depth * 1.6;
          uv.x += (sin(depth * 70.0 + uTime * 1.3 + vW.x * 0.6) * 0.0016 + sin(depth * 23.0 - uTime * 0.8 + vW.x * 1.7) * 0.0022) * k;
          uv.y += sin(vW.x * 2.3 + uTime * 0.9 + depth * 31.0) * 0.006 * k;
        }
        vec4 c = texture2D(uMap, uv, uBlur);
        if (c.a < 0.004) discard;
        float lum = dot(c.rgb, vec3(0.3, 0.59, 0.11));
        // warm lit windows and lamps in the painting: red well above blue, and bright
        float warm = smoothstep(0.02, 0.16, c.r - c.b) * smoothstep(0.16, 0.42, lum);
        vec2 cell = floor(uv * vec2(260.0, 90.0));
        float tw = 0.72 + 0.28 * sin(uTime * (0.6 + hash(cell) * 2.2) + hash(cell + 7.0) * 6.283);
        vec3 base = mix(vec3(lum), c.rgb, uSat);
        vec3 col = base * uTint;
        col += base * uLift;
        float hz = clamp(uHazeAmt * (1.15 - 0.45 * vUv.y), 0.0, 1.0);
        col = mix(col, uHaze, hz);
        col += c.rgb * vec3(1.0, 0.74, 0.42) * warm * uLights * tw * (1.0 - hz * 0.6);
        float a = c.a * uA;
        if (uFeather > 0.0) a *= smoothstep(0.0, uFeather, vUv.x) * smoothstep(0.0, uFeather, 1.0 - vUv.x);
        if (uRefl > 0.5) {
          a *= (1.0 - smoothstep(0.05, 0.95, depth)) * 0.9;
        }
        gl_FragColor = vec4(col, a);
      }`,
  });
}

/** The sky: a painted backdrop per place, a drifting cloud loop over it, stars at night. */
export function skyMaterial(tex: THREE.Texture | null) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: tex },
      uClouds: { value: null as THREE.Texture | null },
      uCloudAmt: { value: 0 },
      uCloudCol: { value: new THREE.Color('#7fe3cf') },
      uA: { value: 1 },
      uGain: { value: 1 },
      uTime: { value: 0 },
      uShift: { value: 0 },
      uStars: { value: 0 },
      uGlow: { value: new THREE.Color(0, 0, 0) },
      uHorizon: { value: 0.25 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap, uClouds; uniform vec3 uCloudCol, uGlow;
      uniform float uCloudAmt, uA, uGain, uTime, uShift, uStars, uHorizon;
      varying vec2 vUv;
      float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main() {
        vec2 uv = vec2(vUv.x + uShift, vUv.y);
        vec3 col = texture2D(uMap, uv).rgb * uGain;
        float up = smoothstep(uHorizon, uHorizon + 0.5, vUv.y);
        // the cloud loop: only its bright edges are used, drifting slowly against the painting
        vec2 cuv = vec2(vUv.x * 2.6 + uShift * 3.0 + uTime * 0.004, (vUv.y - uHorizon) * 1.9 + 0.05);
        float cl = dot(texture2D(uClouds, cuv).rgb, vec3(0.3, 0.59, 0.11));
        col += uCloudCol * smoothstep(0.1, 0.75, cl) * uCloudAmt * smoothstep(uHorizon - 0.02, uHorizon + 0.16, vUv.y) * (1.0 - up * 0.6);
        // stars: sparse, each with its own slow twinkle
        vec2 g = vUv * vec2(520.0, 195.0);
        vec2 id = floor(g);
        float h = hash(id);
        float d = length(fract(g) - 0.5 - (vec2(hash(id + 3.1), hash(id + 9.7)) - 0.5) * 0.6);
        float star = step(0.986, h) * smoothstep(0.16, 0.0, d) * (0.55 + 0.45 * sin(uTime * (0.8 + h * 3.0) + h * 90.0));
        col += vec3(0.75, 0.95, 0.9) * star * uStars * up * 2.2;
        // a glow along the horizon (dawn, city light, the next chapter's colour at the very end)
        col += uGlow * exp(-abs(vUv.y - uHorizon) * 9.0);
        gl_FragColor = vec4(col, uA);
      }`,
  });
}

/** Water: dark, tinted by the sky, with moving highlights sampled from the water loop. Drawn over the mirrored layers. */
export function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uRip: { value: null as THREE.Texture | null },
      uHasRip: { value: 0 },
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#031316') },
      uSky: { value: new THREE.Color('#1f6d68') },
      uSpark: { value: new THREE.Color('#9ff5e0') },
      uCam: { value: new THREE.Vector3() },
      uLamp: { value: 0 },
      uLampStep: { value: 7 },
      uLamp0: { value: 0.5 },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uRip; uniform float uTime, uLamp, uLampStep, uLamp0, uHasRip; uniform vec3 uDeep, uSky, uSpark, uCam;
      varying vec3 vW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float dist = length(vW.xz - uCam.xz);
        float far = smoothstep(6.0, 60.0, dist);
        // two scrolling samples of the loop, squashed in depth so the ripples lie flat
        vec2 a = vec2(vW.x * 0.085 + uTime * 0.006, vW.z * 0.19 - uTime * 0.01);
        vec2 b = vec2(vW.x * 0.21 - uTime * 0.012, vW.z * 0.52 + uTime * 0.016) + 0.37;
        float r1 = dot(texture2D(uRip, a).rgb, vec3(0.34));
        float r2 = dot(texture2D(uRip, b).rgb, vec3(0.34));
        float vid = smoothstep(0.02, 0.3, r1 * 0.6 + r2 * 0.4);
        // a procedural ripple under the loop, so the surface is alive before the video arrives
        float n = noise(vec2(vW.x * 1.1 + uTime * 0.18, vW.z * 3.6 - uTime * 0.42)) * 0.6 + noise(vec2(vW.x * 2.7 - uTime * 0.25, vW.z * 8.0 + uTime * 0.3)) * 0.4;
        float rip = mix(n, vid * 0.65 + n * 0.35, uHasRip);
        float glint = smoothstep(0.52, 0.9, rip) * (1.0 - far * 0.75);
        vec3 col = mix(uDeep, uSky, far * 0.8 + rip * 0.06);
        col += uSpark * glint * 0.42;
        // the street lamps on the quay drop long warm streaks into the near water
        float dx = mod(vW.x - uLamp0 + uLampStep * 0.5, uLampStep) - uLampStep * 0.5;
        float streak = exp(-dx * dx * (2.2 - rip * 1.6)) * smoothstep(-13.0, -2.2, vW.z) * (0.35 + rip * 1.3);
        col += vec3(1.0, 0.72, 0.4) * streak * uLamp * 0.5 * step(uLamp0 + uLampStep * 0.5, vW.x);
        float alpha = mix(0.2, 0.92, smoothstep(12.0, 75.0, dist)) + glint * 0.25;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }`,
  });
}

export const MAX_MARK = 7;

/** The road: wet paving under lamp pools, with a ring of light where each milestone stands. */
export function roadMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color('#16302f') },
      uFog: { value: new THREE.Color('#020809') },
      uAccent: { value: new THREE.Color('#2fe0c2') },
      uLampCol: { value: new THREE.Color('#ffb46a') },
      uLamp: { value: 0 },
      uLampStep: { value: 7 },
      uLamp0: { value: 0.5 },
      uCam: { value: new THREE.Vector3() },
      uHero: { value: new THREE.Vector3() },
      uMarkX: { value: new Float32Array(MAX_MARK) },
      uMarkA: { value: new Float32Array(MAX_MARK) },
      uMarkZ: { value: -1.15 },
      uSheen: { value: new THREE.Color('#2a6f69') },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uTime, uLamp, uLampStep, uLamp0, uMarkZ;
      uniform vec3 uTint, uFog, uAccent, uLampCol, uCam, uHero, uSheen;
      uniform float uMarkX[${MAX_MARK}]; uniform float uMarkA[${MAX_MARK}];
      varying vec3 vW;
      void main() {
        vec3 t = texture2D(uMap, vW.xz * 0.36).rgb;
        float lum = dot(t, vec3(0.3, 0.59, 0.11));
        vec3 col = t * uTint * 4.2 + uTint * 0.05;
        // wet sheen: the paving picks up the sky where the stones are smooth
        float wet = smoothstep(0.25, 0.7, lum);
        col += uSheen * wet * 0.22 * smoothstep(3.5, -1.5, vW.z);
        // lamp pools, one under every lamp, warm, with a streak pulled toward the camera
        float dx = mod(vW.x - uLamp0 + uLampStep * 0.5, uLampStep) - uLampStep * 0.5;
        float dz = vW.z + 1.25;
        float pool = exp(-(dx * dx * 0.55 + dz * dz * 0.42));
        float streak = exp(-dx * dx * 5.0) * smoothstep(3.6, -1.0, vW.z) * wet;
        col += uLampCol * (pool * (0.12 + lum * 0.75) + streak * 0.3) * uLamp * step(uLamp0 + uLampStep * 0.5, vW.x);
        // milestones: a ring on the ground and a soft pool in the chapter colour
        for (int i = 0; i < ${MAX_MARK}; i++) {
          vec2 d = vW.xz - vec2(uMarkX[i], uMarkZ);
          float r = length(d);
          float a = uMarkA[i];
          float ring = smoothstep(0.035, 0.0, abs(r - (0.34 + 0.22 * a))) + smoothstep(0.02, 0.0, abs(r - 0.92 * a)) * 0.35;
          col += uAccent * (ring * 1.6 + exp(-r * r * 0.9) * 0.34 * (0.5 + lum)) * a;
        }
        // the path so far: a dotted line on the paving from the start to where he stands, brightest at his heels
        float behind = step(vW.x, uHero.x + 0.1) * step(0.0, vW.x);
        vec2 dd = vec2(mod(vW.x, 0.3) - 0.15, vW.z - 0.62);
        float trail = smoothstep(0.034, 0.014, length(dd)) * behind;
        col += uAccent * trail * (0.22 + 1.5 * exp(-(uHero.x - vW.x) * 0.45));
        // a little light travels with him
        vec2 hd = vW.xz - uHero.xz;
        col += uSheen * exp(-dot(hd, hd) * 0.5) * 0.22 * (0.4 + lum);
        // edges: the kerb line, the dark toward the lens, distance into the mist
        col *= smoothstep(-1.82, -1.62, vW.z) * 0.6 + 0.4;
        col *= smoothstep(4.6, 2.2, vW.z);
        float f = smoothstep(7.0, 22.0, abs(vW.x - uCam.x));
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** A sheet of drifting mist between two depth layers. Thickens when he crosses from one place to the next. */
export function mistMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color('#2a6f69') }, uA: { value: 0.2 }, uShift: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime, uA, uShift, uSeed; uniform vec3 uCol; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
      void main() {
        vec2 p = vec2(vUv.x * 9.0 + uShift + uSeed, vUv.y * 2.2);
        float n = fbm(p + vec2(uTime * 0.03, 0.0) + fbm(p * 0.7 - uTime * 0.02) * 0.8);
        float low = smoothstep(1.0, 0.0, vUv.y);            // mist hugs the water
        float a = smoothstep(0.28, 0.85, n) * low * low * uA;
        a *= smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.0, 0.1, vUv.x) * smoothstep(0.0, 0.1, 1.0 - vUv.x);
        gl_FragColor = vec4(uCol, clamp(a, 0.0, 1.0));
      }`,
  });
}

/** Soft additive glow card (lamp heads, beacons). Size in world units, always faces the camera through Points. */
export function glowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uA: { value: 1 }, uPx: { value: 1 }, uCol: { value: new THREE.Color('#ffc27a') } },
    vertexShader: /* glsl */ `
      uniform float uTime, uPx; attribute float aSize; attribute float aSeed; varying float vF;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPx / -mv.z;
        // sodium lamps never burn quite evenly
        vF = 0.86 + 0.1 * sin(uTime * 3.1 + aSeed * 50.0) + 0.04 * sin(uTime * 17.0 + aSeed * 13.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uA; uniform vec3 uCol; varying float vF;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(0.16, 0.0, d);
        float halo = pow(max(0.0, 1.0 - d), 2.6);
        gl_FragColor = vec4(uCol * (core * 2.4 + halo * 0.5) * uA * vF, 1.0);
      }`,
  });
}
