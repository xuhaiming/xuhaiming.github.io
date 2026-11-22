import * as THREE from 'three';
import type { Ctx, Frame } from '../../world/types';
import { clamp01, css, damp, flag, mix, seg, smooth } from '../../world/util';
import { Beams, fibre, LIME, outBack, outCubic, pin, prop, rng, Takeover } from './kit';

/**
 * Machine three: the knowledge base. Documents come down as sheets, split into chunks, and every
 * chunk becomes a point in embedding space. A question lands as a query point, its nearest chunks
 * light up and are pulled out into a cited answer. A daily sweep re-indexes the cloud, and a plug
 * carries it to the agent platform as an MCP server.
 */

const DOCS = [
  'ops/daily-refresh.md',
  'ingest/chunking.md',
  'ingest/embeddings.md',
  'mcp/server.md',
  'mcp/tools.md',
  'guides/agents.md',
  'guides/code-lookup.md',
  'product/behaviour.md',
  'code: source index',
];
export const QUESTIONS = [
  {
    chip: 'How fresh is it?',
    q: 'How fresh is the index?',
    a: 'It is rebuilt every day. A scheduled job re-reads the documents, then refreshes the chunks, the embeddings and the metadata.',
  },
  {
    chip: 'How do agents reach it?',
    q: 'How does an agent reach it?',
    a: 'As an MCP server. Any agent on the platform can call search as a tool and gets passages back with their sources.',
  },
  {
    chip: 'What if the docs are wrong?',
    q: 'What if the docs are out of date?',
    a: 'Code lookup. The answer is checked against the source, so it matches what the software really does.',
  },
];

const C = new THREE.Vector3(0.75, 2.85, -0.3);
const R = 1.45;
const ROWS = 7;
const COLS = 2;
const PER = ROWS * COLS;
const NH = DOCS.length * PER;
const K = 4;
const CW = 0.3;
const CH = 0.105;

const CARD = /* glsl */ `
  float cbox(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
  float chash(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  // a chunk of text: dark slip, lime edge, three lines of differing length
  vec4 card(vec2 uv, float seed, float glow) {
    vec2 p = (uv - 0.5) * vec2(2.86, 1.0);
    float d = cbox(p, vec2(1.43, 0.5), 0.14);
    float inside = smoothstep(0.0, -0.03, d);
    float edge = smoothstep(0.07, 0.0, abs(d + 0.04));
    float lines = 0.0;
    for (int i = 0; i < 3; i++) {
      float y = 0.74 - float(i) * 0.24;
      float len = 0.45 + chash(seed * 7.0 + float(i)) * 0.45;
      lines += smoothstep(0.055, 0.03, abs(uv.y - y)) * step(0.08, uv.x) * step(uv.x, 0.08 + len * 0.84);
    }
    vec3 lime = vec3(0.72, 1.0, 0.24);
    vec3 col = vec3(0.016, 0.024, 0.012) + lime * (edge * (0.35 + glow) + lines * (0.3 + glow * 0.7));
    return vec4(col, inside * 0.94);
  }`;

export function createKnowledge(ctx: Ctx, el: HTMLElement, X: number, mcpPort: THREE.Vector3) {
  const group = new THREE.Group();
  group.position.x = X;
  const take = new Takeover();
  const r = rng(1337);
  const gauss = () => (r() + r() + r() + r() - 2) * 0.9;
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s);
  let question = 0;

  const lamp = new THREE.PointLight(LIME, 0, 11, 1.6);
  lamp.position.copy(C);
  group.add(lamp);

  /* ----- pedestal, projector cone ----- */
  const metal = new THREE.MeshStandardMaterial({ color: '#0d100c', roughness: 0.42, metalness: 0.88 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 0.14, 48), metal);
  plinth.position.set(C.x, 0.07, C.z);
  group.add(plinth);
  ctx.glb('/assets/systems/prop-pedestal.glb').then(
    (g) => {
      const o = prop(g.scene);
      o.scale.setScalar(1.9);
      o.position.set(C.x, 0.14, C.z);
      group.add(o);
    },
    () => {},
  );
  ctx.glb('/assets/systems/prop-console.glb').then(
    (g) => {
      const o = prop(g.scene);
      o.scale.setScalar(1.25);
      o.position.set(-1.5, 0, 0.85);
      o.rotation.y = -Math.PI / 2 + 0.5;
      group.add(o);
    },
    () => {},
  );
  const coneU = { uA: { value: 0 }, uTime: { value: 0 } };
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.9, 0.34, C.y - R * 0.3 - 1.15, 40, 1, true),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: coneU,
      vertexShader:
        'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        uniform float uA, uTime; varying vec2 vUv; varying vec3 vN, vV;
        void main() {
          float side = pow(abs(dot(vN, vV)), 1.6);
          float streak = 0.75 + 0.25 * sin(vUv.x * 80.0 + uTime * 0.6);
          float fall = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.5);
          gl_FragColor = vec4(vec3(0.72, 1.0, 0.24) * side * streak * fall * 0.16 * uA, 1.0);
        }`,
    }),
  );
  cone.position.set(C.x, 1.15 + (C.y - R * 0.3 - 1.15) / 2, C.z);
  group.add(cone);

  /* ----- embedding space ----- */
  const orb = new THREE.Group();
  orb.position.copy(C);
  group.add(orb);
  const centres: THREE.Vector3[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.283 + 0.4;
    centres.push(new THREE.Vector3(Math.cos(a) * 0.82, (i % 3) * 0.55 - 0.55 + (r() - 0.5) * 0.2, Math.sin(a) * 0.82));
  }
  const docCluster = [0, 0, 0, 2, 2, 2, 4, 4, 4];
  const spread = (c: THREE.Vector3, s: number, out: THREE.Vector3) => {
    out.set(c.x + gauss() * s, c.y + gauss() * s, c.z + gauss() * s);
    if (out.length() > R * 0.96) out.setLength(R * (0.8 + r() * 0.16));
    return out;
  };
  const heroEmb: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < NH; i++) heroEmb.push(spread(centres[docCluster[Math.floor(i / PER)]], 0.26, new THREE.Vector3()));
  const queries = [0, 2, 4].map((c) => centres[c].clone().multiplyScalar(0.92).add(new THREE.Vector3(0.05, 0.08, 0.1)));
  const nearest = queries.map((qp) =>
    heroEmb
      .map((e, i) => ({ i, d: e.distanceTo(qp) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, K),
  );

  // chunk slips
  const base = new THREE.PlaneGeometry(1, 1);
  const cg = new THREE.InstancedBufferGeometry();
  cg.index = base.index;
  cg.setAttribute('position', base.attributes.position);
  cg.setAttribute('uv', base.attributes.uv);
  const aHover = new Float32Array(NH * 3);
  const aYaw = new Float32Array(NH);
  const aCell = new Float32Array(NH * 2);
  const aEmb = new Float32Array(NH * 3);
  const aSeed = new Float32Array(NH * 2);
  for (let d = 0; d < DOCS.length; d++) {
    const ang = (d / DOCS.length) * 6.283;
    const hy = ((d * 5) % 3) * 0.5 - 0.35;
    for (let k = 0; k < PER; k++) {
      const i = d * PER + k;
      aHover.set([Math.sin(ang) * 2.2, hy, Math.cos(ang) * 2.2], i * 3);
      aYaw[i] = ang;
      aCell.set([((k % COLS) - (COLS - 1) / 2) * (CW + 0.012), ((ROWS - 1) / 2 - Math.floor(k / COLS)) * (CH + 0.012)], i * 2);
      aEmb.set([heroEmb[i].x, heroEmb[i].y, heroEmb[i].z], i * 3);
      aSeed.set([r(), d / DOCS.length], i * 2);
    }
  }
  cg.setAttribute('aHover', new THREE.InstancedBufferAttribute(aHover, 3));
  cg.setAttribute('aYaw', new THREE.InstancedBufferAttribute(aYaw, 1));
  cg.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2));
  cg.setAttribute('aEmb', new THREE.InstancedBufferAttribute(aEmb, 3));
  cg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 2));
  cg.instanceCount = NH;
  const cu = { uM: { value: 0 }, uTime: { value: 0 }, uSize: { value: new THREE.Vector2(CW, CH) } };
  const slips = new THREE.Mesh(
    cg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: cu,
      vertexShader: /* glsl */ `
        uniform float uM, uTime; uniform vec2 uSize;
        attribute vec3 aHover, aEmb; attribute float aYaw; attribute vec2 aCell, aSeed;
        varying vec2 vUv; varying float vSeed, vGo, vA;
        mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
        void main() {
          float dt = clamp(uM / 0.34 - aSeed.y * 0.55, 0.0, 1.0);
          float drop = 1.0 - pow(1.0 - dt, 3.0);
          float split = smoothstep(0.3, 0.56, uM);
          float go = clamp((uM - 0.52 - aSeed.x * 0.26) / 0.2, 0.0, 1.0);
          go = go * go * (3.0 - 2.0 * go);
          vec2 cell = aCell * (1.0 + split * 0.7) + vec2(sin(aSeed.x * 40.0), cos(aSeed.x * 23.0)) * split * 0.05;
          float yaw = aYaw + (1.0 - drop) * 2.2;
          vec3 local = vec3(cell, split * (aSeed.x - 0.5) * 0.3);
          local.xz = rot(-yaw) * local.xz;
          vec3 centre = aHover + vec3(0.0, (1.0 - drop) * 5.0, 0.0);
          centre.y += sin(uTime * 0.7 + aSeed.y * 30.0) * 0.04;
          vec3 from = centre + local;
          vec3 q = vec3(position.xy * uSize * (1.0 - go * 0.96), 0.0);
          float tw = yaw + split * (aSeed.x - 0.5) * 1.2 * (1.0 - go);
          q.xz = rot(-tw) * q.xz;
          vec3 pos = mix(from, aEmb, go) + q;
          pos += normalize(from) * sin(go * 3.14159) * 0.35;
          vUv = uv; vSeed = aSeed.x; vGo = go; vA = smoothstep(0.0, 0.15, dt) * (1.0 - smoothstep(0.9, 1.0, go));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vSeed, vGo, vA;
        ${CARD}
        void main() {
          vec4 c = card(vUv, vSeed, vGo * 2.0);
          c.rgb += vec3(0.72, 1.0, 0.24) * vGo * 1.4;
          gl_FragColor = vec4(c.rgb, c.a * vA);
        }`,
    }),
  );
  slips.frustumCulled = false;
  slips.renderOrder = 2;
  orb.add(slips);

  // the cloud
  const NP = [1100, 2000, 2800][ctx.tier];
  const pP = new Float32Array(NP * 3);
  const pS = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) {
    let cl = 0;
    if (i < NH) {
      v.copy(heroEmb[i]);
      cl = docCluster[Math.floor(i / PER)];
    } else {
      cl = Math.floor(r() * 7);
      const kind = r();
      if (kind < 0.24) {
        // a thin outer shell gives the space its round outline
        const a2 = r() * 6.283;
        const y2 = r() * 2 - 1;
        const s2 = Math.sqrt(1 - y2 * y2);
        v.set(Math.cos(a2) * s2, y2, Math.sin(a2) * s2).multiplyScalar(R * (0.93 + r() * 0.07));
      } else spread(centres[cl], kind < 0.4 ? 0.7 : 0.3, v);
    }
    pP.set([v.x, v.y, v.z], i * 3);
    pS.set([r(), cl / 7, i < NH ? 1 : 0], i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pP, 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(pS, 3));
  const pu = {
    uM: { value: 0 },
    uTime: { value: 0 },
    uS: { value: 1 },
    uProbe: { value: new THREE.Vector3() },
    uProbeA: { value: 0 },
    uQuery: { value: new THREE.Vector3() },
    uQR: { value: 0 },
    uQA: { value: 0 },
    uSweepY: { value: -9 },
    uSweepA: { value: 0 },
    uA: { value: 1 },
  };
  const cloud = new THREE.Points(
    pg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: pu,
      vertexShader: /* glsl */ `
        uniform float uM, uTime, uS, uProbeA, uQR, uQA, uSweepY, uSweepA, uA; uniform vec3 uProbe, uQuery;
        attribute vec3 aSeed; varying vec3 vCol; varying float vA;
        void main() {
          vec3 p = position;
          p += vec3(sin(uTime * 0.5 + aSeed.x * 60.0), cos(uTime * 0.43 + aSeed.x * 33.0), sin(uTime * 0.37 + aSeed.x * 91.0)) * 0.014;
          float appear = aSeed.z > 0.5 ? smoothstep(0.66 + aSeed.x * 0.26, 0.72 + aSeed.x * 0.26, uM) : smoothstep(0.5 + aSeed.x * 0.4, 0.6 + aSeed.x * 0.4, uM);
          float sw = smoothstep(0.2, 0.0, abs(p.y - uSweepY)) * uSweepA;
          p.xz *= 1.0 + sw * 0.1;
          float pb = smoothstep(0.42, 0.0, distance(p, uProbe)) * uProbeA;
          float qn = smoothstep(uQR, uQR - 0.08, distance(p, uQuery)) * uQA;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float big = aSeed.z > 0.5 ? 1.35 : 1.0;
          gl_PointSize = uS * big * (3.6 + aSeed.x * 4.6) * (1.0 + pb * 1.3 + qn * 1.5 + sw * 1.2) * (5.0 / -mv.z);
          vec3 lime = vec3(0.72, 1.0, 0.24);
          // clusters differ a little in hue, all inside the lime family
          vec3 cc = mix(vec3(0.5, 0.95, 0.3), vec3(0.95, 1.0, 0.45), fract(aSeed.y * 3.7));
          vCol = mix(cc, vec3(1.0), clamp(pb * 0.6 + qn * 0.55 + sw * 0.6, 0.0, 1.0)) * (0.85 + pb * 1.6 + qn * 1.9 + sw * 1.6);
          vCol *= mix(1.0, 0.55, uQA * (1.0 - qn));
          vA = appear * uA * (0.7 + 0.3 * aSeed.x);
        }`,
      fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; if (a < 0.004) discard; gl_FragColor = vec4(vCol * a, 1.0); }',
    }),
  );
  cloud.frustumCulled = false;
  orb.add(cloud);

  // query marker and neighbourhood shell
  const shellU = { uA: { value: 0 }, uTime: { value: 0 } };
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 28),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: shellU,
      vertexShader: 'varying vec3 vN, vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uA; varying vec3 vN, vV; void main(){ float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 3.0); gl_FragColor = vec4(vec3(0.72, 1.0, 0.24) * f * uA, 1.0); }',
    }),
  );
  orb.add(shell);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.2, 0.5) }));
  orb.add(dot);

  // the picked chunks, pulled out as slips again
  const picks: { mesh: THREE.Mesh; u: { uSeed: { value: number }; uA: { value: number }; uGlow: { value: number } } }[] = [];
  for (let k = 0; k < K; k++) {
    const u = { uSeed: { value: r() }, uA: { value: 0 }, uGlow: { value: 0 } };
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CW * 2.1, CH * 2.1),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: u,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float uSeed, uA, uGlow; varying vec2 vUv; ${CARD} void main(){ vec4 c = card(vUv, uSeed, uGlow); gl_FragColor = vec4(c.rgb, c.a * uA); }`,
      }),
    );
    m.renderOrder = 4;
    group.add(m);
    picks.push({ mesh: m, u });
  }
  const beams = new Beams(K + 1);
  group.add(beams.mesh);

  /* ----- the day dial around the pedestal ----- */
  const dialU = { uPhase: { value: 0 }, uA: { value: 0 }, uRun: { value: 0 } };
  const dial = new THREE.Mesh(
    new THREE.RingGeometry(1.62, 1.84, 96, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: dialU,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uPhase, uA, uRun; varying vec2 vP;
        void main() {
          float a = atan(vP.y, vP.x) / 6.28318 + 0.5;
          float rr = (length(vP) - 1.62) / 0.22;
          float tick = smoothstep(0.42, 0.5, abs(fract(a * 24.0) - 0.5)) * step(0.35, rr);
          float d = fract(a - uPhase + 0.5) - 0.5;
          float marker = smoothstep(0.02, 0.0, abs(d));
          float tail = smoothstep(-0.25, 0.0, d) * step(d, 0.0) * 0.5;
          // night half of the day is darker
          float day = smoothstep(0.2, 0.3, fract(a + 0.25)) * smoothstep(0.8, 0.7, fract(a + 0.25));
          float run = smoothstep(0.03, 0.0, abs(fract(a) - 0.5) - 0.012) * step(rr, 0.4);
          vec3 lime = vec3(0.72, 1.0, 0.24);
          vec3 c = lime * (tick * (0.1 + day * 0.22) + marker * 2.2 + tail * 0.5 * rr + run * (0.5 + uRun * 2.0));
          gl_FragColor = vec4(c * uA, 1.0);
        }`,
    }),
  );
  dial.rotation.x = -Math.PI / 2;
  dial.position.set(C.x, 0.155, C.z);
  group.add(dial);
  const sweepU = { uA: { value: 0 } };
  const sweep = new THREE.Mesh(
    new THREE.RingGeometry(0.02, R * 1.08, 64, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: sweepU,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uA; varying vec2 vP; void main(){ float d = length(vP) / ${(R * 1.08).toFixed(3)}; float ring = smoothstep(0.9, 1.0, d) * smoothstep(1.0, 0.97, d); gl_FragColor = vec4(vec3(0.72, 1.0, 0.24) * (ring * 1.4 + 0.035 * d) * uA, 1.0); }`,
    }),
  );
  sweep.rotation.x = -Math.PI / 2;
  group.add(sweep);

  /* ----- MCP plug and the cable back to the agent platform ----- */
  const link = new THREE.Group();
  group.add(link);
  const sock = new THREE.Vector3(C.x - 0.72, 0.55, C.z + 0.78);
  const port = mcpPort.clone();
  port.x -= X;
  const cablePts = [
    sock.clone().add(new THREE.Vector3(-0.5, -0.05, 0.42)),
    new THREE.Vector3(-0.9, 0.05, 2.2),
    new THREE.Vector3(-4.5, 0.05, 2.25),
    new THREE.Vector3(port.x + 2.2, 0.05, 2.1),
    new THREE.Vector3(port.x + 0.5, 0.06, 1.5),
    new THREE.Vector3(port.x, 0.44, port.z),
  ];
  const curve = new THREE.CatmullRomCurve3(cablePts, false, 'catmullrom', 0.5);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.032, 8, false), new THREE.MeshStandardMaterial({ color: '#070807', roughness: 0.6, metalness: 0.2 }));
  link.add(cable);
  const live = fibre(cablePts, 0.037);
  live.mat.uniforms.uCol.value.multiplyScalar(0.45);
  link.add(live.mesh);
  const plugBody = new THREE.Group();
  plugBody.position.copy(sock).add(new THREE.Vector3(-0.24, 0, 0.2));
  plugBody.rotation.y = 0.7;
  link.add(plugBody);
  const fallback = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 20), metal);
  fallback.rotation.z = Math.PI / 2;
  plugBody.add(fallback);
  const plugGlow = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 8, 32), new THREE.MeshBasicMaterial({ color: LIME.clone() }));
  plugGlow.rotation.y = Math.PI / 2;
  plugGlow.position.x = 0.2;
  plugBody.add(plugGlow);
  ctx.glb('/assets/systems/prop-plug.glb').then(
    (g) => {
      const o = prop(g.scene);
      o.scale.setScalar(0.62);
      plugBody.remove(fallback);
      plugBody.add(o);
    },
    () => {},
  );

  /* ----- DOM ----- */
  const chips = Array.from(el.querySelectorAll<HTMLButtonElement>('.s-c3 .s-chip'));
  const ansEl = q('.s-answer');
  const ansQ = q('.s-answer-q');
  const ansA = q('.s-answer-a');
  const ansC = q('.s-answer-cites');
  const probeEl = q('.s-probe');
  const dialEl = q('.s-dial');
  const dialState = q('.s-dial-state');
  const mcpEl = q('.s-mcp');
  const qEl = q('.s-qtag');
  const docEls = Array.from(el.querySelectorAll<HTMLElement>('.s-doc'));
  let shownQ = -1;
  chips.forEach((c, i) =>
    c.addEventListener('click', () => {
      question = i;
      take.play(5.2);
    }),
  );
  const showQ = (i: number) => {
    shownQ = i;
    const Q = QUESTIONS[i];
    if (ansQ) ansQ.textContent = Q.q;
    if (ansA) ansA.textContent = Q.a;
    if (ansC) {
      ansC.textContent = '';
      nearest[i].forEach((n) => {
        const li = document.createElement('li');
        li.textContent = `${DOCS[Math.floor(n.i / PER)]} · chunk ${String((n.i % PER) + 1).padStart(2, '0')}`;
        ansC.appendChild(li);
      });
    }
    chips.forEach((c, k) => {
      flag(c, 'on', k === i);
      c.setAttribute('aria-pressed', String(k === i));
    });
    picks.forEach((pk, k) => (pk.u.uSeed.value = aSeed[nearest[i][k].i * 2]));
  };
  const act = new URLSearchParams(location.search).get('act') ?? '';
  if (ctx.shot && act.startsWith('q-')) question = Math.min(2, Math.max(0, Number(act.slice(2)) || 0));

  const wp = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const probe = new THREE.Vector3();
  let probeA = 0;
  let probeDoc = '';
  let dialText = '';
  let spin = 0;

  /** ui: extra fade for the DOM labels only (the rift exit clears them before the machine goes) */
  function update(f: Frame, near: number, ui = 1) {
    const nu = near * ui;
    const { p, t, dt } = f;
    const narrow = ctx.size.narrow;
    const sz = ctx.size.dpr * (ctx.size.h / 900);
    if (shownQ !== question) showQ(question);

    const m = seg(p, 0.695, 0.8);
    const qv = take.resolve(seg(p, 0.8, 0.868) * (1 - seg(p, 0.9, 0.915)), p, t, dt, ctx.shot);
    const scrollSweep = seg(p, 0.9, 0.935);
    const plug = seg(p, 0.93, 0.962);

    if (!ctx.still) spin += dt * 0.07 * (1 - smooth(seg(qv, 0.02, 0.2)) * (1 - smooth(seg(qv, 0.98, 1))) * 0.85);
    orb.rotation.y = spin;
    orb.updateMatrixWorld();
    inv.copy(orb.matrixWorld).invert();

    cu.uM.value = m;
    cu.uTime.value = t;
    pu.uM.value = m;
    pu.uTime.value = t;
    pu.uS.value = sz;
    pu.uA.value = near;
    coneU.uA.value = near * smooth(seg(m, 0.5, 0.9));
    coneU.uTime.value = t;

    /* document names ride on the sheets while they are still sheets */
    const sheetA = smooth(seg(m, 0.12, 0.28)) * (1 - smooth(seg(m, 0.36, 0.5)));
    docEls.forEach((d, i) => {
      const k = i * 3;
      const ang = (k / DOCS.length) * 6.283;
      wp.set(Math.sin(ang) * 2.2, (((k * 5) % 3) * 0.5 - 0.35) + 0.5, Math.cos(ang) * 2.2).applyMatrix4(orb.matrixWorld);
      pin(ctx, d, wp, nu * sheetA, 0.5, narrow ? 80 : 0);
    });

    /* daily sweep: scroll-driven in its beat, otherwise once per idle "day" */
    const day = ctx.still || ctx.shot ? 0.5 : (t / 14) % 1;
    const idle = m >= 1 && qv <= 0.001 && scrollSweep <= 0 ? clamp01(day / 0.16) : 0;
    const sw = scrollSweep > 0 && scrollSweep < 1 ? scrollSweep : idle > 0 && idle < 1 ? idle : 0;
    pu.uSweepY.value = mix(-R, R, sw);
    pu.uSweepA.value = sw > 0 ? Math.sin(sw * Math.PI) : 0;
    sweep.position.set(C.x, C.y + mix(-R, R, sw), C.z);
    sweep.scale.setScalar(Math.sqrt(Math.max(0.02, 1 - Math.pow(mix(-1, 1, sw), 2))));
    sweepU.uA.value = near * pu.uSweepA.value;
    dialU.uPhase.value = scrollSweep > 0 && scrollSweep < 1 ? 0.5 + scrollSweep * 0.16 : day + 0.5;
    dialU.uA.value = near * smooth(seg(m, 0.7, 1));
    dialU.uRun.value = pu.uSweepA.value;
    const dtxt = sw > 0 ? 'Refreshing chunks, embeddings, metadata' : 'Index is current';
    if (dtxt !== dialText && dialState) {
      dialText = dtxt;
      dialState.textContent = dtxt;
    }
    flag(dialEl, 'on', sw > 0);
    pin(ctx, dialEl, wp.set(X + C.x + (narrow ? 0 : 1.2), 0.2, C.z + 1.75), nu * smooth(seg(p, 0.79, 0.81)) * (narrow ? 1 - smooth(seg(p, 0.9, 0.92)) : 1), 0.6, narrow ? 130 : 0);

    /* pointer probe: move through the space, the neighbourhood lights up */
    const ray = ctx.ray().ray;
    const dC = ray.distanceToPoint(wp.set(X + C.x, C.y, C.z));
    const canProbe = near > 0.5 && m >= 1 && ctx.pointer.seen && dC < R * 1.02 && qv < 0.02;
    if (canProbe) {
      ray.closestPointToPoint(wp, probe);
      probe.applyMatrix4(inv);
    }
    if (ctx.shot && act === 'probe') {
      probe.copy(centres[1]).multiplyScalar(0.9);
      probeA = 1;
    } else probeA += ((canProbe ? 1 : 0) - probeA) * damp(8, dt);
    pu.uProbe.value.copy(probe);
    pu.uProbeA.value = probeA;
    if (probeA > 0.3) {
      let best = -1;
      let bd = 0.5;
      for (let i = 0; i < NH; i++) {
        const d = heroEmb[i].distanceTo(probe);
        if (d < bd) (bd = d), (best = i);
      }
      const name = best >= 0 ? `${DOCS[Math.floor(best / PER)]} · chunk ${String((best % PER) + 1).padStart(2, '0')}` : 'no named chunk nearby';
      if (name !== probeDoc && probeEl) {
        probeDoc = name;
        probeEl.textContent = name;
      }
      wp.copy(best >= 0 ? heroEmb[best] : probe).applyMatrix4(orb.matrixWorld);
      wp.y += 0.14;
    }
    pin(ctx, probeEl, wp, nu * probeA, 0.3, narrow ? 110 : 0);

    /* query */
    const Qp = queries[question];
    const arrive = outCubic(seg(qv, 0.02, 0.2));
    const grow = smooth(seg(qv, 0.18, 0.44));
    const pull = seg(qv, 0.42, 0.78);
    const done = smooth(seg(qv, 0.76, 0.92));
    const rk = nearest[question][K - 1].d + 0.06;
    pu.uQuery.value.copy(Qp);
    pu.uQR.value = grow * rk + 0.02;
    pu.uQA.value = smooth(seg(qv, 0.1, 0.25));
    shell.position.copy(Qp);
    shell.scale.setScalar(Math.max(0.001, grow * rk));
    shellU.uA.value = near * grow * (1 - done * 0.7) * 0.5;
    dot.position.copy(Qp);
    dot.scale.setScalar(arrive > 0.9 ? 1 + Math.sin(t * 5) * 0.15 : 0.001);
    a.set(-1.5, 1.32, 0.85);
    b.copy(Qp).applyMatrix4(orb.matrixWorld);
    b.x -= X;
    wp.lerpVectors(a, b, arrive);
    if (qv > 0.01) beams.set(K, a, wp, 0.04, (1 - done * 0.8) * 0.9);
    else beams.off(K);
    wp.copy(b);
    wp.x += X;
    wp.y += 0.18;
    pin(ctx, qEl, wp, nu * smooth(seg(qv, 0.16, 0.24)) * (1 - done), 0.4, narrow ? 80 : 0);

    for (let k = 0; k < K; k++) {
      const pk = picks[k];
      const e = smooth(clamp01(pull * 1.5 - k * 0.16));
      a.copy(heroEmb[nearest[question][k].i]).applyMatrix4(orb.matrixWorld);
      a.x -= X;
      if (narrow) wp.set(C.x - 0.36 + (k % 2) * 0.72, 0.98 - Math.floor(k / 2) * 0.27, 1.5);
      else wp.set(C.x + 1.72 + (k % 2) * 0.7, 4.42 - Math.floor(k / 2) * 0.29, 0.6);
      pk.mesh.position.lerpVectors(a, wp, e);
      pk.mesh.position.z += Math.sin(e * Math.PI) * 0.5;
      pk.mesh.scale.setScalar(mix(0.12, 1, e));
      pk.mesh.quaternion.copy(ctx.camera.quaternion);
      pk.u.uA.value = near * smooth(seg(e, 0.0, 0.15));
      pk.u.uGlow.value = 0.5 + (1 - e) * 1.5;
      if (e > 0.02) beams.set(k, b, pk.mesh.position, 0.028, 0.7 * (1 - done * 0.7));
      else beams.off(k);
    }
    beams.commit(t);
    flag(ansEl, 'on', done > 0.5);
    if (narrow) wp.set(X + C.x, 6.5, 0);
    else wp.set(X + C.x + 1.38, 3.9, 0.6);
    pin(ctx, ansEl, wp, nu * done, 0.9, narrow ? ctx.size.w / 2 : 0);

    /* MCP */
    const pl = outBack(plug);
    link.position.set(-(1 - pl) * 0.34, 0, (1 - pl) * 0.28);
    live.mat.uniforms.uDraw.value = smooth(seg(p, 0.945, 0.985));
    live.mat.uniforms.uFlow.value = 1;
    live.mat.uniforms.uTime.value = t;
    (plugGlow.material as THREE.MeshBasicMaterial).color.copy(LIME).multiplyScalar(0.2 + smooth(seg(plug, 0.8, 1)) * 2.4);
    flag(mcpEl, 'on', plug >= 1);
    pin(ctx, mcpEl, wp.set(X + sock.x - 0.5, 0.75, sock.z + 0.1), nu * smooth(seg(p, 0.915, 0.935)), 0.8, narrow ? 120 : 0);

    lamp.intensity = near * (1.5 + smooth(seg(m, 0.5, 1)) * 6 + pu.uSweepA.value * 5);
    return { m, qv, sweep: sw, plug, hot: canProbe };
  }

  return { group, update, take };
}
