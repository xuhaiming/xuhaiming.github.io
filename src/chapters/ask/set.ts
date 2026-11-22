import * as THREE from 'three';
import type { Ctx } from '../../world/types';

/**
 * The room: a dark polished floor with a dial of dots around the figure, a curved wall that catches
 * a slow violet light (a generated loop; a shader stands in until it loads, and on phones a still),
 * and a little dust. Violet is only ever light on these surfaces.
 */

export interface StageSet {
  setTool(i: number, pos: THREE.Vector3, color: THREE.Color, heat: number): void;
  update(t: number, here: number, arrive: number, hero: THREE.Vector3, stage: number, lamp: THREE.PointLight, ctx: Ctx): void;
  pause(): void;
}

const LIGHT = /* glsl */ `
  // stand-in for the generated loop: shafts through slats with slow caustics inside them
  float slats(vec2 q, float t) {
    float bend = sin(q.y * 2.6 + t * 0.17) * 0.35;
    float s = sin(q.x * 7.5 - q.y * 2.4 + bend + t * 0.06) * 0.5 + 0.5;
    float shaft = smoothstep(0.8, 0.9, s);
    float c1 = sin(q.x * 31.0 + sin(q.y * 13.0 + t * 0.5) * 2.2 + t * 0.3);
    float c2 = sin(q.y * 27.0 + sin(q.x * 19.0 - t * 0.4) * 1.8);
    float ca = pow(0.5 + 0.25 * (c1 + c2), 2.0);
    return shaft * (0.3 + 0.9 * ca);
  }`;

export function buildSet(ctx: Ctx, group: THREE.Group): StageSet {
  const bg = new THREE.Color('#040309');
  const toolPos = Array.from({ length: 6 }, () => new THREE.Vector3());
  const toolCol = Array.from({ length: 6 }, () => new THREE.Color());
  const toolHeat = new Float32Array(6);
  const shared = {
    uTime: { value: 0 },
    uMap: { value: null as THREE.Texture | null },
    uHas: { value: 0 },
    uBg: { value: bg },
    uLampP: { value: new THREE.Vector3() },
    uLampC: { value: new THREE.Color() },
    uA: { value: 0 },
    // the console stands in front of the left of the room on wide screens: keep the light off that part
    uShade: { value: new THREE.Vector2(0, 1) },
  };

  /* ---- wall ---- */
  const R = 10.5;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, 10, 64, 1, true, Math.PI - 1.25, 2.5),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      uniforms: shared,
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        uniform float uTime, uHas, uA; uniform vec2 uShade; uniform sampler2D uMap; uniform vec3 uBg, uLampP, uLampC; varying vec2 vUv; varying vec3 vW;
        ${LIGHT}
        void main() {
          vec2 uv = vec2(1.0 - vUv.x, vUv.y);
          vec3 lit = vec3(0.61, 0.48, 1.0) * slats(vec2(uv.x * 2.6, uv.y), uTime);
          if (uHas > 0.5) {
            vec3 v = texture2D(uMap, vec2((uv.x - 0.5) * 3.2 + 0.5, uv.y * 1.25 - 0.02)).rgb;
            lit = mix(v, vec3(dot(v, vec3(0.33))) * vec3(0.72, 0.6, 1.0), 0.45) * v * 2.4;
          }
          // the light falls off toward the ceiling, the floor line and the ends of the wall
          float m = smoothstep(0.0, 0.16, uv.y) * smoothstep(1.0, 0.45, uv.y) * smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.8, uv.x);
          m *= mix(0.1, 1.0, smoothstep(uShade.x - 0.06, uShade.x + 0.05, gl_FragCoord.x / uShade.y));
          vec3 col = lit * m * 0.62 * uA;
          // whatever is carrying the question throws its colour on the wall too
          float d = distance(vW, uLampP);
          col += uLampC * (0.07 / (1.0 + d * d * 0.2)) * (0.15 + 1.6 * dot(lit, vec3(0.33))) * m;
          gl_FragColor = vec4(uBg * 0.6 + col, 1.0);
        }`,
    }),
  );
  wall.position.y = 4.4;
  group.add(wall);

  /* ---- floor ---- */
  const fg = new THREE.PlaneGeometry(90, 90);
  fg.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(
    fg,
    new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        ...shared,
        uHero: { value: new THREE.Vector3() },
        uTool: { value: toolPos },
        uToolC: { value: toolCol },
        uHeat: { value: toolHeat },
        uStage: { value: 0 },
        uFog: { value: 0.02 },
        uR: { value: R },
      },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        uniform float uTime, uHas, uA, uStage, uFog, uR, uHeat[6]; uniform vec2 uShade;
        uniform sampler2D uMap; uniform vec3 uBg, uHero, uLampP, uLampC, uTool[6], uToolC[6];
        varying vec3 vW;
        ${LIGHT}
        void main() {
          vec2 p = vW.xz - uHero.xz;
          float d = length(p);
          vec3 col = vec3(0.013, 0.011, 0.022);

          // a dial of dots around him: rings every half unit, more dots on the outer rings
          float ri = floor(d / 0.5 + 0.5);
          float fr = d - ri * 0.5;
          float n = max(1.0, ri * 10.0);
          float ang = atan(p.y, p.x) / 6.2831853 + uTime * 0.004 * (mod(ri, 2.0) * 2.0 - 1.0);
          float fa = (fract(ang * n + 0.5) - 0.5) / n * 6.2831853 * d;
          float dotv = smoothstep(0.02, 0.007, length(vec2(fr, fa))) * step(0.5, ri);
          float near = exp(-d * 0.33);
          col += vec3(0.62, 0.52, 1.0) * dotv * near * 0.5 * uA;
          col += vec3(0.42, 0.3, 1.0) * exp(-d * d * 0.42) * 0.085 * uA;

          // inspect_page: the floor itself answers, a ring runs outward from under his feet
          float sr = 0.5 + uStage * 1.7;
          col += vec3(0.61, 0.48, 1.0) * (smoothstep(0.09, 0.0, abs(d - sr)) * 1.4 + dotv * smoothstep(sr + 0.2, sr - 0.6, d) * 1.6) * uStage;

          // each instrument throws a pool of its own colour
          for (int i = 0; i < 6; i++) {
            vec2 q = vW.xz - uTool[i].xz;
            float h = uTool[i].y;
            float fall = 1.0 / (1.0 + dot(q, q) * 1.6 + h * h * 0.5);
            col += uToolC[i] * fall * fall * uHeat[i] * 0.34;
          }
          vec3 lp = vW - uLampP;
          col += uLampC * 0.1 / (1.0 + dot(lp, lp) * 1.4);

          // polished: the lit wall shows up as a long soft streak toward the camera
          float back = clamp((-vW.z + 1.0) / (uR + 1.0), 0.0, 1.0);
          float th = atan(vW.x, -vW.z + uR * 0.25) / 2.5 + 0.5;
          vec2 uv = vec2(clamp(th, 0.0, 1.0), 0.12 + (1.0 - back) * 0.3);
          vec3 lit = vec3(0.61, 0.48, 1.0) * slats(vec2(uv.x * 2.6, uv.y), uTime);
          if (uHas > 0.5) { vec3 v = texture2D(uMap, vec2((uv.x - 0.5) * 3.2 + 0.5, uv.y * 1.25 - 0.02)).rgb; lit = v * v * 2.6; }
          float edge = smoothstep(0.0, 0.2, th) * smoothstep(1.0, 0.8, th) * mix(0.15, 1.0, smoothstep(uShade.x - 0.1, uShade.x + 0.08, gl_FragCoord.x / uShade.y));
          col += lit * edge * (0.03 + 0.2 * back * back) * uA;

          float fog = 1.0 - exp(-distance(vW, cameraPosition) * uFog * 0.8);
          gl_FragColor = vec4(mix(col, uBg * 0.6, clamp(fog, 0.0, 1.0)), 1.0);
        }`,
    }),
  );
  floor.renderOrder = -3;
  group.add(floor);

  /* ---- dust ---- */
  const n = [140, 280, 460][ctx.tier];
  const P = new Float32Array(n * 3);
  const S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    P[i * 3] = (Math.random() - 0.5) * 14;
    P[i * 3 + 1] = Math.random() * 5;
    P[i * 3 + 2] = 4 - Math.random() * 12;
    S[i] = Math.random();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(P, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
  const dust = new THREE.Points(
    dg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.uTime, uA: shared.uA, uS: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uS; attribute float aSeed; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.02 + aSeed * 0.035), 5.0);
          p.x += sin(uTime * 0.17 + aSeed * 30.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (0.8 + aSeed * 2.0) * (6.0 / -mv.z);
          vA = (0.2 + 0.8 * aSeed) * smoothstep(0.0, 0.7, p.y) * smoothstep(5.0, 3.8, p.y);
        }`,
      fragmentShader: 'uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.66, 0.56, 1.0) * smoothstep(0.5, 0.0, d) * vA * uA * 0.42, 1.0); }',
    }),
  );
  dust.frustumCulled = false;
  group.add(dust);

  /* ---- the generated light: a loop on laptops and desktops, its poster on phones ---- */
  let video: HTMLVideoElement | null = null;
  let on = false;
  const use = (tex: THREE.Texture) => {
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    shared.uMap.value = tex;
    shared.uHas.value = 1;
  };
  const still = () =>
    ctx
      .tex('/assets/ask/light-loop.jpg')
      .then(use)
      .catch(() => {});
  if (ctx.tier === 0 || ctx.still || ctx.shot) still();
  else
    ctx
      .video('/assets/ask/light-loop.mp4', { poster: '/assets/ask/light-loop.jpg' })
      .then(({ el, tex }) => {
        if (!el.videoWidth) return still();
        use(tex);
        // decode one frame so the texture is not empty, then hold it until the chapter is here
        el.play()
          .then(
            () =>
              new Promise<void>((res) => {
                if (!('requestVideoFrameCallback' in el)) return res();
                el.requestVideoFrameCallback(() => res());
                setTimeout(res, 1500);
              }),
          )
          .then(() => {
            video = el;
            if (!on) el.pause();
          })
          .catch(() => (video = el));
      })
      .catch(still);

  return {
    setTool(i, pos, color, heat) {
      toolPos[i].copy(pos);
      toolCol[i].copy(color);
      toolHeat[i] = heat;
    },
    update(t, here, arrive, hero, stage, lamp, c) {
      shared.uTime.value = t;
      shared.uShade.value.set(c.size.narrow ? -1 : 0.43, c.size.w * c.renderer.getPixelRatio());
      shared.uA.value = here * (0.35 + 0.65 * arrive);
      shared.uLampP.value.copy(lamp.position);
      shared.uLampC.value.copy(lamp.color).multiplyScalar(lamp.intensity * 0.2);
      const fu = (floor.material as THREE.ShaderMaterial).uniforms;
      fu.uHero.value.copy(hero);
      fu.uStage.value = stage;
      (dust.material as THREE.ShaderMaterial).uniforms.uS.value = c.size.dpr * (c.size.h / 900);
      on = here > 0.05;
      if (video && video.paused && on) video.play().catch(() => {});
    },
    pause() {
      on = false;
      video?.pause();
    },
  };
}
