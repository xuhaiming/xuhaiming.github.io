import * as THREE from 'three';
import type { Ctx } from '../../world/types';
import { COBALT, FONT, glowMat, hazeLoop, paint, prop } from './kit';

/**
 * The workshop hall: a long nave of portal frames with a light bar on every column, a floor that
 * takes the station lights, a far wall that is a slow generated video (the hall's moving light),
 * dust in the air, and a few generated props standing in the dark between the benches.
 */

export const HALL = {
  z0: 6,
  z1: -48,
  half: 5.5,
  rib: 4.75,
};

export interface Hall {
  group: THREE.Group;
  /** exit: how far the rift at the end of the hall has opened (0..1) */
  update(t: number, ctx: Ctx, heroPos: THREE.Vector3, focus: number[], exit: number, pre: number): void;
}

export const NEXT = new THREE.Color('#b8ff3c'); // the next chapter's light

export function buildHall(ctx: Ctx, stations: { z: number; side: number }[], names: string[]): Hall {
  const group = new THREE.Group();

  // ---- floor ----
  const fg = new THREE.PlaneGeometry(HALL.half * 2 + 2, 70);
  fg.rotateX(-Math.PI / 2);
  const fu = {
    uHero: { value: new THREE.Vector3() },
    uSt: { value: stations.map((s) => new THREE.Vector3(s.side * 2.9, s.z, 0)) },
    uOn: { value: [0, 0, 0, 0] },
    uCol: { value: COBALT.clone() },
    uEnd: { value: 0.5 },
    uNext: { value: NEXT.clone() },
    uExit: { value: 0 },
  };
  const fm = new THREE.MeshStandardMaterial({ color: '#05070c', roughness: 0.5, metalness: 0.25, envMapIntensity: 0.35 });
  fm.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, fu);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform vec3 uHero, uCol, uNext; uniform vec3 uSt[4]; uniform float uOn[4]; uniform float uEnd, uExit;')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // poured floor: big slabs with a seam, a little wear
        vec2 slab = abs(fract(vW.xz / vec2(2.75, 4.75) + vec2(0.5, 0.0)) - 0.5);
        float seam = smoothstep(0.492, 0.499, max(slab.x, slab.y));
        roughnessFactor = clamp(roughnessFactor + seam * 0.4 + sin(vW.x * 3.1) * sin(vW.z * 1.7) * 0.06, 0.05, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec2 g = abs(fract(vW.xz * 1.6) - 0.5);
        float dotv = smoothstep(0.07, 0.02, length(g));
        float nearH = exp(-length(vW.xz - uHero.xz) * 0.3);
        float aisle = smoothstep(1.3, 0.7, abs(vW.x));
        vec3 e = vec3(0.75, 0.86, 1.0) * dotv * nearH * aisle * 0.3;
        for (int i = 0; i < 4; i++) {
          vec2 d = vW.xz - uSt[i].xy;
          e += uCol * exp(-dot(d, d) * 0.3) * (0.02 + uOn[i] * 0.16);
        }
        // the far wall lays a long streak down the middle of the hall
        float streak = exp(-abs(vW.x) * 0.55) * smoothstep(8.0, -46.0, vW.z);
        e += mix(uCol, uNext, uExit * 0.6) * streak * (0.012 + 0.03 * uEnd + 0.04 * uExit);
        totalEmissiveRadiance += e;`,
      );
  };
  const floor = new THREE.Mesh(fg, fm);
  floor.position.z = -23;
  group.add(floor);

  // ---- walls ----
  const wm = new THREE.MeshStandardMaterial({ color: '#05070d', roughness: 0.75, metalness: 0.2 });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(70, 6.2), wm);
    w.rotation.y = -sx * (Math.PI / 2);
    w.position.set(sx * (HALL.half + 0.35), 3.1, -23);
    group.add(w);
  }

  // ---- portal frames ----
  const nRib = Math.floor((HALL.z0 - HALL.z1) / HALL.rib) + 1;
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#04060b', roughness: 0.62, metalness: 0.4, envMapIntensity: 0.4 }), nRib * 3);
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 3.6, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff' }), nRib * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  for (let i = 0; i < nRib; i++) {
    const z = HALL.z0 - i * HALL.rib;
    for (const sx of [-1, 1]) {
      m.compose(p.set(sx * (HALL.half + 0.05), 2.9, z), q, sc.set(0.42, 5.8, 0.55));
      ribs.setMatrixAt(i * 3 + (sx < 0 ? 0 : 1), m);
      m.makeTranslation(sx * (HALL.half - 0.18), 2.5, z);
      bars.setMatrixAt(i * 2 + (sx < 0 ? 0 : 1), m);
    }
    m.compose(p.set(0, 5.75, z), q, sc.set(HALL.half * 2 + 0.52, 0.42, 0.55));
    ribs.setMatrixAt(i * 3 + 2, m);
  }
  bars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nRib * 2 * 3), 3);
  group.add(ribs, bars);

  // two rails of light under the roof
  const rail = new THREE.MeshBasicMaterial({ color: COBALT.clone().multiplyScalar(0.35) });
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 56), rail);
    r.position.set(sx * 2.1, 5.5, -22);
    group.add(r);
  }

  // ---- far wall: the video loop, lit from the front by the rift when it opens ----
  const endMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null }, uHas: { value: 0 }, uA: { value: 1 }, uExit: { value: 0 }, uNext: { value: NEXT.clone() }, uCol: { value: COBALT.clone() }, uT: { value: 0 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uHas, uA, uExit, uT, uFade; uniform vec3 uNext, uCol; varying vec2 vUv;
      void main() {
        vec3 t = uHas > 0.5 ? texture2D(uMap, vUv).rgb : uCol * (0.25 + 0.2 * sin(vUv.x * 9.0 + uT * 0.3));
        float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x) * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
        // the rift stands a few metres in front: its light falls on the wall as a tall soft wash
        vec2 w = vec2((vUv.x - 0.5) * 11.0, vUv.y * 6.2);
        float spill = exp(-w.x * w.x / (0.9 + uExit * 2.2)) * exp(-pow((w.y - 1.4) / 2.2, 2.0));
        vec3 c = (t * 0.9 * edge * uA * (1.0 - 0.45 * uExit) + uNext * spill * (0.03 + 0.22 * uExit)) * uFade;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const end = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.2), endMat);
  end.position.set(0, 3.1, HALL.z1);
  group.add(end);
  const endGlow = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), glowMat());
  endGlow.position.set(0, 3, HALL.z1 + 0.2);
  group.add(endGlow);
  const setEnd = (t: THREE.Texture) => {
    endMat.uniforms.uMap.value = t;
    endMat.uniforms.uHas.value = 1;
  };
  // the still first, the loop when it has buffered
  ctx.tex('/assets/range/haze.jpg').then(setEnd).catch(() => {});
  hazeLoop(ctx, setEnd);
  const endLight = new THREE.PointLight(COBALT, 60, 30, 2);
  endLight.position.set(0, 3.2, HALL.z1 + 3);
  group.add(endLight);

  // ---- shafts of light over the benches and down the aisle ----
  const coneGeo = new THREE.CylinderGeometry(0.1, 1.9, 5.4, 40, 1, true);
  const cones: THREE.ShaderMaterial[] = [];
  const cone = (x: number, z: number, lean: number) => {
    const cm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uA: { value: 0.05 }, uCol: { value: new THREE.Color('#6f8fff') } },
      vertexShader: 'varying vec3 vN, vV; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uA; uniform vec3 uCol; varying vec3 vN, vV; varying float vH; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float hh = clamp(vH, 0.0, 1.0); float h = pow(hh, 1.7) * smoothstep(0.0, 0.12, hh); gl_FragColor = vec4(uCol * f * h * uA, 1.0); }',
    });
    const m = new THREE.Mesh(coneGeo, cm);
    m.position.set(x, 2.75, z);
    m.rotation.z = lean;
    m.renderOrder = -3;
    group.add(m);
    cones.push(cm);
  };
  stations.forEach((s) => cone(s.side * 2.6, s.z + 0.2, s.side * 0.07));
  for (let z = 2; z > HALL.z1 + 6; z -= HALL.rib * 2) cone(0, z - 2.4, 0);

  // ---- floor markings: the bench numbers, painted ----
  stations.forEach((s, i) => {
    const pt = paint(512, 128, ctx);
    const g = pt.g;
    const draw = () => {
      g.clearRect(0, 0, 512, 128);
      g.fillStyle = '#cfe0ff';
      g.textBaseline = 'middle';
      g.font = FONT(96, 780);
      g.fillText(`0${i + 1}`, 6, 68);
      g.font = FONT(30, 640);
      g.fillText(names[i].toUpperCase(), 150, 46);
      g.fillStyle = 'rgba(207,224,255,0.55)';
      g.fillRect(150, 76, 340, 4);
      pt.done();
    };
    draw();
    document.fonts?.load(FONT(96, 780)).then(draw);
    const mk = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.6),
      new THREE.MeshBasicMaterial({ map: pt.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }),
    );
    mk.rotation.x = -Math.PI / 2;
    mk.rotation.z = s.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    mk.position.set(s.side * 1.05, 0.012, s.z + 0.2);
    group.add(mk);
  });

  // ---- dust ----
  const n = [300, 700, 1200][ctx.tier];
  const P = new Float32Array(n * 3);
  const S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    P[i * 3] = (Math.random() - 0.5) * HALL.half * 2;
    P[i * 3 + 1] = Math.random() * 5.5;
    P[i * 3 + 2] = HALL.z0 + 4 - Math.random() * 60;
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
      uniforms: { uTime: { value: 0 }, uS: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uS; attribute float aSeed; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.02 + aSeed * 0.04), 5.5);
          p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (1.0 + aSeed * 2.4) * (6.0 / -mv.z);
          vA = (0.2 + 0.8 * aSeed) * smoothstep(0.0, 0.6, p.y) * smoothstep(5.5, 4.4, p.y) * smoothstep(0.3, 2.0, -mv.z);
        }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.55, 0.7, 1.0) * smoothstep(0.5, 0.0, d) * vA * 0.42, 1.0); }',
    }),
  );
  dust.frustumCulled = false;
  group.add(dust);

  // ---- props in the dark (generated, lazy) ----
  const place = (url: string, at: [number, number, number, number, number][], dim: number) =>
    ctx
      .glb(url)
      .then((g) => {
        for (const [x, y, z, ry, s] of at) {
          const o = prop(g.scene, dim);
          o.position.set(x, y, z);
          o.rotation.y = ry;
          o.scale.setScalar(s);
          group.add(o);
        }
      })
      .catch(() => {});
  const H = HALL.half - 0.75;
  // benches against the wall opposite each exhibit, racks behind the service graph
  place('/assets/range/bench.glb', [
    [-H, 0, stations[0].z - 0.4, Math.PI / 2, 2.3],
    [H, 0, stations[1].z + 3.6, -Math.PI / 2, 2.3],
    [-H, 0, stations[2].z + 1.2, Math.PI / 2, 2.3],
    [H, 0, stations[3].z + 0.6, -Math.PI / 2, 2.3],
  ], 0.9);
  place('/assets/range/rack.glb', [
    [-H - 0.1, 0, stations[1].z - 3.2, Math.PI / 2 + 0.2, 2.3],
    [-H - 0.1, 0, stations[1].z - 4.3, Math.PI / 2, 2.3],
    [-H - 0.1, 0, stations[1].z - 5.4, Math.PI / 2 - 0.15, 2.3],
  ], 0.8);

  const col = new THREE.Color();
  return {
    group,
    update(t, c, heroPos, focus, exit, pre) {
      fu.uHero.value.copy(heroPos);
      for (let i = 0; i < 4; i++) fu.uOn.value[i] = focus[i];
      fu.uExit.value = exit;
      const flick = 0.82 + 0.18 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1.3);
      fu.uEnd.value = flick;
      endMat.uniforms.uExit.value = exit;
      // the last bench stands close to the wall: hold the wall down so the copy stays readable
      endMat.uniforms.uA.value = 1 - 0.7 * focus[3] * (1 - exit);
      endMat.uniforms.uT.value = t;
      const dEnd = (c.camera.position.z - HALL.z1) * 0.036;
      endMat.uniforms.uFade.value = Math.max(Math.exp(-dEnd * dEnd), exit, 0.35 * pre);
      endLight.intensity = 16 * flick * (1 - exit * 0.6);
      const eg = (endGlow.material as THREE.ShaderMaterial).uniforms;
      eg.uA.value = 0.035 * flick * (1 - exit * 0.5) + 0.02 * exit;
      eg.uCol.value.copy(COBALT).lerp(NEXT, exit * 0.6);
      (dust.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (dust.material as THREE.ShaderMaterial).uniforms.uS.value = c.size.dpr * (c.size.h / 900);
      for (let i = 0; i < cones.length; i++) cones[i].uniforms.uA.value = i < 4 ? 0.035 + focus[i] * 0.12 + pre * 0.06 : 0.03 + 0.012 * Math.sin(t * 0.5 + i);
      // light bars: brightest around the hero, a slow pulse running down the hall
      for (let i = 0; i < nRib; i++) {
        const z = HALL.z0 - i * HALL.rib;
        const near = Math.exp(-Math.pow((z - heroPos.z + 2) / 7, 2));
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 0.9);
        const k = 0.1 + near * 0.7 + pulse * 0.06;
        col.copy(COBALT).multiplyScalar(k);
        bars.setColorAt(i * 2, col);
        bars.setColorAt(i * 2 + 1, col);
      }
      bars.instanceColor!.needsUpdate = true;
    },
  };
}
