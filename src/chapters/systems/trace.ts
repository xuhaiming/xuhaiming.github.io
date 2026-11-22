import * as THREE from 'three';
import type { Ctx, Frame } from '../../world/types';
import { clamp01, css, damp, flag, mix, seg, smooth } from '../../world/util';
import { Beams, LIME, PALE, pin, prop, rng, STOP, Takeover } from './kit';

/**
 * Machine two: the agent platform, shown as one traced run laid out on a three-lane rack.
 * Requests arrive from a crowd of 130+ points, the run unfolds span by span under a playhead the
 * visitor can drag, a guardrail gate stops one call, and an eval board flips to pass at the end.
 */

interface Span {
  lane: 0 | 1 | 2;
  t0: number;
  t1: number;
  kind: 'model' | 'tool' | 'obs' | 'block';
  name: string;
  text: string;
  tok?: number;
  port?: 0 | 1 | 2;
}

export const SPANS: Span[] = [
  { lane: 0, t0: 0, t1: 0.8, kind: 'model', name: 'Plan', tok: 1900, text: 'The model reads the request and the skills this team has shared, then decides what to look up first.' },
  { lane: 1, t0: 0.8, t1: 1.55, kind: 'tool', name: 'search_issues', port: 0, text: "A call into an internal tool: last week's bug reports, filtered by status." },
  { lane: 2, t0: 1.55, t1: 1.8, kind: 'obs', name: 'Observation', text: 'The result comes back as structured data and is added to the context.' },
  { lane: 0, t0: 1.8, t1: 2.35, kind: 'model', name: 'Think', tok: 1200, text: 'It needs to know what shipped, so it asks the knowledge base.' },
  { lane: 1, t0: 2.35, t1: 3.15, kind: 'tool', name: 'knowledge.search', port: 1, text: 'A call to an MCP server: the knowledge base in the next room, with code lookup.' },
  { lane: 2, t0: 3.15, t1: 3.4, kind: 'obs', name: 'Observation', text: 'Cited passages come back. Every one keeps its source.' },
  { lane: 0, t0: 3.4, t1: 3.9, kind: 'model', name: 'Decide', tok: 900, text: 'It decides to post the update to the whole channel.' },
  { lane: 1, t0: 3.9, t1: 4.15, kind: 'block', name: 'post_to_everyone', text: 'Stopped at the gate. This run has no permission to message everyone, so the call never leaves the platform. The refusal goes back to the model.' },
  { lane: 0, t0: 4.15, t1: 4.75, kind: 'model', name: 'Re-plan', tok: 1100, text: 'It changes course: write a draft and ask the person to confirm before anything is sent.' },
  { lane: 1, t0: 4.75, t1: 5.45, kind: 'tool', name: 'skill: weekly update', port: 2, text: 'A shared team skill: the format this team already uses for its updates.' },
  { lane: 2, t0: 5.45, t1: 5.7, kind: 'obs', name: 'Observation', text: 'The draft, in the team format.' },
  { lane: 0, t0: 5.7, t1: 6.4, kind: 'model', name: 'Answer', tok: 1400, text: 'The draft goes back to the person who asked, in the web app or the chat bot.' },
];
const T = 6.4;
const X0 = -1.7;
const LEN = 4.8;
const LY = [1.25, 1.8, 2.35];
const LZ = [0.3, -0.3, -0.9];
const tx = (t: number) => X0 + (t / T) * LEN;
const KIND = { model: 'Model', tool: 'Tool call', obs: 'Observation', block: 'Tool call, blocked' };
const PEOPLE = 134;

export function createTrace(ctx: Ctx, el: HTMLElement, X: number) {
  const group = new THREE.Group();
  group.position.x = X;
  const take = new Takeover();
  const r = rng(4242);
  const q = <T2 extends HTMLElement>(s: string) => el.querySelector<T2>(s);

  /* ----- light ----- */
  const lamp = new THREE.PointLight(LIME, 0, 12, 1.6);
  lamp.position.set(0, 2.6, 1.6);
  group.add(lamp);

  /* ----- the rack: three shelves stepping up and back ----- */
  const metal = new THREE.MeshStandardMaterial({ color: '#0e110d', roughness: 0.4, metalness: 0.88 });
  const shelfG = new THREE.BoxGeometry(LEN + 0.7, 0.05, 0.52);
  const lipMat = new THREE.MeshBasicMaterial({ color: LIME.clone().multiplyScalar(0.55) });
  const lipG = new THREE.BoxGeometry(LEN + 0.7, 0.012, 0.012);
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Mesh(shelfG, metal);
    s.position.set(X0 + LEN / 2, LY[k] - 0.14, LZ[k]);
    const lip = new THREE.Mesh(lipG, lipMat);
    lip.position.set(X0 + LEN / 2, LY[k] - 0.11, LZ[k] + 0.262);
    group.add(s, lip);
  }
  const postG = new THREE.BoxGeometry(0.07, 1, 0.07);
  for (const px of [X0 - 0.3, X0 + LEN * 0.33, X0 + LEN * 0.66, X0 + LEN + 0.3])
    for (let k = 0; k < 3; k++) {
      const post = new THREE.Mesh(postG, metal);
      post.scale.y = LY[k] - 0.14;
      post.position.set(px, (LY[k] - 0.14) / 2, LZ[k] - 0.18);
      group.add(post);
    }

  /* ----- spans ----- */
  const NS = SPANS.length;
  const sg = new THREE.BoxGeometry(1, 0.26, 0.4);
  sg.translate(0.5, 0, 0);
  const sCol = new THREE.InstancedBufferAttribute(new Float32Array(NS * 3), 3);
  const sGlow = new THREE.InstancedBufferAttribute(new Float32Array(NS), 1);
  sCol.setUsage(THREE.DynamicDrawUsage);
  sGlow.setUsage(THREE.DynamicDrawUsage);
  sg.setAttribute('aCol', sCol);
  sg.setAttribute('aGlow', sGlow);
  const su = { uTime: { value: 0 } };
  const spans = new THREE.InstancedMesh(
    sg,
    new THREE.ShaderMaterial({
      uniforms: su,
      vertexShader: /* glsl */ `
        attribute vec3 aCol; attribute float aGlow; varying vec3 vN, vV, vCol, vL; varying float vGlow, vLen;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          vL = position; vCol = aCol; vGlow = aGlow; vLen = length(instanceMatrix[0].xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec3 vN, vV, vCol, vL; varying float vGlow, vLen;
        void main() {
          float fr = pow(clamp(1.0 - dot(vN, vV), 0.0, 1.0), 2.2);
          float top = max(vN.y, 0.0);
          float front = max(vN.z, 0.0);
          float along = vL.x * vLen;
          // an ingot of dark glass: lit rim on every face, fine ticks so length reads as time
          vec3 q = vec3(min(along, vLen - along) / 0.03, (0.13 - abs(vL.y)) / 0.03, (0.2 - abs(vL.z)) / 0.03);
          vec3 w = abs(vN);
          float e = w.x > 0.5 ? min(q.y, q.z) : w.y > 0.5 ? min(q.x, q.z) : min(q.x, q.y);
          float rim = smoothstep(1.0, 0.25, e);
          float tick = smoothstep(0.42, 0.5, abs(fract(along * 10.0) - 0.5)) * (front + top) * 0.5;
          float head = smoothstep(0.16, 0.0, vLen - along);
          vec3 c = vCol * (0.035 + top * 0.11 + front * 0.05 + fr * 0.3) * (0.5 + vGlow * 1.3);
          c += vCol * rim * (0.3 + vGlow * 0.75);
          c += vCol * tick * (0.08 + vGlow * 0.2);
          c += mix(vCol, vec3(1.0), 0.4) * head * vGlow * 0.8;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
    NS,
  );
  spans.frustumCulled = false;
  group.add(spans);
  const m4 = new THREE.Matrix4();
  const colOf = (s: Span) => (s.kind === 'block' ? STOP : s.kind === 'obs' ? PALE : LIME);

  /* ----- beams: lane hand-offs, port drops ----- */
  const beams = new Beams(NS + 4);
  group.add(beams.mesh);
  const stopBeams = new Beams(2, STOP);
  group.add(stopBeams.mesh);
  const lead = new Beams(1);
  group.add(lead.mesh);

  /* ----- playhead ----- */
  const headU = { uA: { value: 0 }, uTime: { value: 0 } };
  const head = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 2.5),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: headU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uA, uTime; varying vec2 vUv;
        void main() {
          float x = abs(vUv.x - 0.5) * 2.0;
          float core = exp(-x * x * 900.0) * 1.6 + exp(-x * x * 12.0) * 0.1;
          float v = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
          gl_FragColor = vec4(vec3(0.72, 1.0, 0.24) * core * v * uA, 1.0);
        }`,
    }),
  );
  head.rotation.x = -0.83;
  group.add(head);

  /* ----- tool ports ----- */
  const portX = [tx(1.18), tx(2.75), tx(5.1)];
  const portMat: THREE.MeshBasicMaterial[] = [];
  const portG = new THREE.CylinderGeometry(0.2, 0.25, 0.42, 28);
  const capG = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 28);
  portX.forEach((px) => {
    const b = new THREE.Mesh(portG, metal);
    b.position.set(px, 0.21, 1.05);
    const cm = new THREE.MeshBasicMaterial({ color: LIME.clone() });
    portMat.push(cm);
    const cap = new THREE.Mesh(capG, cm);
    cap.position.set(px, 0.43, 1.05);
    group.add(b, cap);
  });

  /* ----- the gate ----- */
  const GX = tx(4.15) + 0.06;
  const gateU = { uA: { value: 0 }, uTime: { value: 0 }, uIdle: { value: 0 } };
  const barrier = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 2.9),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: gateU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uA, uTime, uIdle; varying vec2 vUv;
        void main() {
          vec2 q = abs(vUv - 0.5) * 2.0;
          float frame = smoothstep(0.86, 1.0, max(q.x, q.y));
          float hatch = smoothstep(0.35, 0.5, abs(fract((vUv.x + vUv.y) * 7.0 - uTime * 0.4) - 0.5));
          float mask = smoothstep(1.0, 0.9, max(q.x, q.y));
          vec3 stop = vec3(1.0, 0.33, 0.2);
          vec3 lime = vec3(0.72, 1.0, 0.24);
          vec3 c = stop * (hatch * 0.55 + frame * 1.6 + 0.12) * uA + lime * frame * 0.5 * uIdle * (1.0 - uA);
          gl_FragColor = vec4(c * mask, 1.0);
        }`,
    }),
  );
  barrier.position.set(GX, 1.72, LZ[1]);
  barrier.rotation.y = Math.PI / 2 - 0.95;
  group.add(barrier);
  const gateLamp = new THREE.PointLight(STOP, 0, 6, 1.8);
  gateLamp.position.set(GX - 0.5, 1.8, 0.4);
  group.add(gateLamp);
  ctx.glb('/assets/systems/prop-gate.glb').then(
    (g) => {
      const o = prop(g.scene);
      o.scale.setScalar(3.5);
      o.position.set(GX, 0, LZ[1]);
      o.rotation.y = Math.PI / 2 - 0.95;
      group.add(o);
    },
    () => {},
  );
  ctx.glb('/assets/systems/prop-console.glb').then(
    (g) => {
      const o = prop(g.scene);
      o.scale.setScalar(1.25);
      o.position.set(-2.3, 0, 1.35);
      o.rotation.y = -Math.PI / 2 + 0.3;
      group.add(o);
    },
    () => {},
  );

  // shards: the blocked call breaks into points at the gate (a function of playhead time)
  const NB = 70;
  const bP = new Float32Array(NB * 3);
  const bS = new Float32Array(NB);
  for (let i = 0; i < NB; i++) {
    const a = r() * 6.283;
    const e = Math.acos(r() * 2 - 1);
    bP.set([-Math.abs(Math.sin(e) * Math.cos(a)), Math.cos(e), Math.sin(e) * Math.sin(a)], i * 3);
    bS[i] = r();
  }
  const burstG = new THREE.BufferGeometry();
  burstG.setAttribute('position', new THREE.BufferAttribute(bP, 3));
  burstG.setAttribute('aSeed', new THREE.BufferAttribute(bS, 1));
  const burstU = { uT: { value: -1 }, uS: { value: 1 }, uO: { value: new THREE.Vector3(GX - 0.05, LY[1], LZ[1]) } };
  const burst = new THREE.Points(
    burstG,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: burstU,
      vertexShader: /* glsl */ `
        uniform float uT, uS; uniform vec3 uO; attribute float aSeed; varying float vA;
        void main() {
          float t = max(uT, 0.0);
          float k = 1.0 - exp(-t * 2.4);
          vec3 p = uO + position * k * (0.35 + aSeed * 1.1);
          p.y -= t * t * 0.5 * aSeed;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (2.0 + aSeed * 5.0) * (5.0 / -mv.z);
          vA = step(0.0, uT) * exp(-t * 1.6);
        }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.36, 0.2) * smoothstep(0.5, 0.0, d) * vA * 1.6, 1.0); }',
    }),
  );
  burst.frustumCulled = false;
  group.add(burst);

  /* ----- the crowd: 130+ people as points, and their requests ----- */
  const cP = new Float32Array(PEOPLE * 3);
  const cS = new Float32Array(PEOPLE);
  const people: THREE.Vector3[] = [];
  for (let i = 0; i < PEOPLE; i++) {
    const row = Math.floor(i / 17);
    const col = i % 17;
    const x = -7.4 + col * 0.25 + (row % 2) * 0.12 + (r() - 0.5) * 0.08;
    const z = -2.2 - row * 0.4 + (r() - 0.5) * 0.1;
    const y = 3.0 + row * 0.26 + (r() - 0.5) * 0.05;
    cP.set([x, y, z], i * 3);
    cS[i] = r();
    people.push(new THREE.Vector3(x, y, z));
  }
  const crowdG = new THREE.BufferGeometry();
  crowdG.setAttribute('position', new THREE.BufferAttribute(cP, 3));
  crowdG.setAttribute('aSeed', new THREE.BufferAttribute(cS, 1));
  const crowdU = { uTime: { value: 0 }, uS: { value: 1 }, uA: { value: 0 } };
  const crowd = new THREE.Points(
    crowdG,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: crowdU,
      vertexShader: /* glsl */ `
        uniform float uTime, uS, uA; attribute float aSeed; varying float vA, vAsk;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 1.3 + aSeed * 40.0) * 0.018;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          // someone is asking right now
          vAsk = smoothstep(0.9, 1.0, sin(uTime * 0.8 + aSeed * 90.0) * 0.5 + 0.5);
          gl_PointSize = uS * (24.0 + vAsk * 12.0) * (5.0 / -mv.z);
          float born = smoothstep(aSeed * 0.8, aSeed * 0.8 + 0.2, uA);
          vA = born * (0.75 + 0.45 * aSeed);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA, vAsk;
        void main() {
          // a person marker: a head and a short tapering body
          vec2 q = gl_PointCoord - vec2(0.5, 0.26);
          float headD = length(q);
          float headM = smoothstep(0.16, 0.08, headD);
          float by = (gl_PointCoord.y - 0.46) / 0.5;
          float body = step(0.0, by) * step(by, 1.0) * smoothstep(0.2 * (1.0 - by * 0.5), 0.1 * (1.0 - by * 0.5), abs(q.x)) * (1.0 - by) * 0.55;
          float a = (headM + body) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(mix(vec3(0.72, 1.0, 0.24), vec3(1.0), vAsk * 0.7) * a * (0.9 + vAsk * 1.2), 1.0);
        }`,
    }),
  );
  crowd.frustumCulled = false;
  group.add(crowd);

  // two ways in: the web app and the chat bot
  const doors = [new THREE.Vector3(X0 - 0.55, 2.2, 0.0), new THREE.Vector3(X0 - 0.55, 1.45, 0.55)];
  const doorMat = new THREE.MeshBasicMaterial({ color: LIME.clone().multiplyScalar(1.3) });
  doors.forEach((d) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.014, 8, 48), doorMat);
    ring.position.copy(d);
    ring.rotation.y = Math.PI / 2 - 0.35;
    group.add(ring);
  });
  const NR = ctx.tier === 0 ? 18 : 30;
  const TRAIL = 5;
  const rA = new Float32Array(NR * TRAIL * 3);
  const rB = new Float32Array(NR * TRAIL * 3);
  const rS = new Float32Array(NR * TRAIL * 2);
  for (let i = 0; i < NR; i++) {
    const from = people[Math.floor(r() * PEOPLE)];
    const door = doors[i % 2];
    const s = r();
    for (let k = 0; k < TRAIL; k++) {
      rA.set([from.x, from.y, from.z], (i * TRAIL + k) * 3);
      rB.set([door.x, door.y, door.z], (i * TRAIL + k) * 3);
      rS.set([s, k / TRAIL], (i * TRAIL + k) * 2);
    }
  }
  const reqG = new THREE.BufferGeometry();
  reqG.setAttribute('position', new THREE.BufferAttribute(rA, 3));
  reqG.setAttribute('aTo', new THREE.BufferAttribute(rB, 3));
  reqG.setAttribute('aSeed', new THREE.BufferAttribute(rS, 2));
  const reqU = { uTime: { value: 0 }, uS: { value: 1 }, uA: { value: 0 }, uIn: { value: new THREE.Vector3(X0, LY[0], LZ[0]) } };
  const reqs = new THREE.Points(
    reqG,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: reqU,
      vertexShader: /* glsl */ `
        uniform float uTime, uS, uA; uniform vec3 uIn; attribute vec3 aTo; attribute vec2 aSeed; varying float vA;
        void main() {
          float t = fract(uTime * (0.1 + aSeed.x * 0.05) + aSeed.x * 7.0) * 1.25 - aSeed.y * 0.05;
          float u = clamp(t, 0.0, 1.0);
          float e = u * u * (3.0 - 2.0 * u);
          vec3 c = mix(position, aTo, 0.5) + vec3(0.0, 0.5 + aSeed.x * 0.6, 0.9);
          vec3 p = mix(mix(position, c, e), mix(c, aTo, e), e);
          float into = clamp((t - 1.0) / 0.2, 0.0, 1.0);
          p = mix(p, uIn, into);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uS * (5.5 - aSeed.y * 4.0) * (5.0 / -mv.z);
          vA = smoothstep(0.0, 0.08, t) * (1.0 - into) * (1.0 - aSeed.y * 0.8) * uA;
        }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.85, 1.0, 0.5) * smoothstep(0.5, 0.0, d) * vA * 1.5, 1.0); }',
    }),
  );
  reqs.frustumCulled = false;
  group.add(reqs);

  /* ----- eval board: flaps that turn over to a pass mark ----- */
  const EC = 4;
  const ER = 5;
  const NE = EC * ER;
  const board = new THREE.Group();
  board.position.set(X0 + LEN + 0.5, 2.3, 0.1);
  board.rotation.y = -0.3;
  board.scale.setScalar(0.85);
  group.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(EC * 0.36 + 0.16, ER * 0.27 + 0.16, 0.06), metal);
  frame.position.z = -0.06;
  board.add(frame);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3 - (ER * 0.27) / 2, 0.08), metal);
  stand.position.set(0, -(ER * 0.27) / 2 - (2.3 - (ER * 0.27) / 2) / 2, -0.06);
  board.add(stand);
  const flapG = new THREE.BoxGeometry(0.32, 0.23, 0.014);
  const flaps = new THREE.InstancedMesh(
    flapG,
    new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN, vNl;
        void main() { vUv = uv; vNl = normal; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN, vNl;
        float segd(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
        void main() {
          vec3 lime = vec3(0.72, 1.0, 0.24);
          float lit = 0.35 + 0.65 * abs(vN.z);
          vec2 p = (vUv - 0.5) * vec2(1.39, 1.0);
          vec3 c;
          if (vNl.z > 0.5) {
            // waiting side: a dark flap with a dim dash
            float dash = smoothstep(0.035, 0.02, segd(p, vec2(-0.12, 0.0), vec2(0.12, 0.0)));
            c = vec3(0.02, 0.028, 0.018) + vec3(0.2, 0.26, 0.16) * dash;
          } else if (vNl.z < -0.5) {
            // pass side (uv is mirrored on the back face)
            p.x = -p.x; p.y = -p.y;
            float chk = min(segd(p, vec2(-0.16, 0.0), vec2(-0.04, -0.13)), segd(p, vec2(-0.04, -0.13), vec2(0.2, 0.15)));
            float m = smoothstep(0.05, 0.03, chk);
            c = lime * 0.2 + mix(vec3(0.0), vec3(0.03, 0.06, 0.0), 1.0) + lime * m * 1.5;
          } else c = vec3(0.03);
          gl_FragColor = vec4(c * lit, 1.0);
        }`,
    }),
    NE,
  );
  flaps.frustumCulled = false;
  board.add(flaps);
  const flapSeed = Array.from({ length: NE }, () => r());
  const rotM = new THREE.Matrix4();

  /* ----- DOM ----- */
  const spanEl = q('.s-span');
  const spanKind = q('.s-span-kind');
  const spanName = q('.s-span-name');
  const spanText = q('.s-span-text');
  const spanMeta = q('.s-span-meta');
  const gateEl = q('.s-gate');
  const crowdEl = q('.s-crowd');
  const evalEl = q('.s-eval');
  const meterMs = q('.s-meter-ms');
  const meterTok = q('.s-meter-tok');
  const laneEls = Array.from(el.querySelectorAll<HTMLElement>('.s-lane'));
  const portEls = Array.from(el.querySelectorAll<HTMLElement>('.s-port'));
  const doorEls = Array.from(el.querySelectorAll<HTMLElement>('.s-door'));
  const scrub = q<HTMLInputElement>('.s-scrub');
  const track = q('.s-scrub-track');
  const scrubWrap = q('.s-scrubber');
  const runBtn = q<HTMLButtonElement>('.s-run');
  if (track)
    SPANS.forEach((s) => {
      const i = document.createElement('i');
      i.className = `k-${s.kind} l-${s.lane}`;
      i.style.left = `${(s.t0 / T) * 100}%`;
      i.style.width = `${((s.t1 - s.t0) / T) * 100}%`;
      track.appendChild(i);
    });
  let dragging = false;
  scrub?.addEventListener('input', () => take.set(Number(scrub.value) / 1000));
  scrub?.addEventListener('pointerdown', () => (dragging = true));
  addEventListener('pointerup', () => (dragging = false));
  runBtn?.addEventListener('click', () => take.play(8));

  let hover = -1;
  let hoverHold = -1;
  let active = false;
  let shownSpan = -2;
  let meterShown = '';
  const rc = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  addEventListener('click', (e) => {
    if (!active) return;
    if ((e.target as HTMLElement).closest?.('a,button,input,label,[data-hit]')) return;
    const i = pickSpan();
    if (i >= 0) {
      take.set((SPANS[i].t0 + (SPANS[i].t1 - SPANS[i].t0) * 0.6) / T);
      hoverHold = i;
    }
  });
  const pickSpan = () => {
    rc.ray.copy(ctx.ray().ray);
    hits.length = 0;
    spans.raycast(rc, hits);
    let best = -1;
    let bd = 1e9;
    for (const h of hits) if (h.distance < bd && h.instanceId !== undefined) (bd = h.distance), (best = h.instanceId);
    return best;
  };
  const act = new URLSearchParams(location.search).get('act') ?? '';
  if (ctx.shot && act.startsWith('t-')) take.set(Number(act.slice(2)) || 0);
  if (ctx.shot && act.startsWith('span-')) {
    hoverHold = Number(act.slice(5)) || 0;
    const s = SPANS[hoverHold];
    take.set((s.t0 + (s.t1 - s.t0) * 0.6) / T);
  }

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const wp = new THREE.Vector3();
  const col = new THREE.Color();
  let glow: number[] = SPANS.map(() => 0);

  function update(f: Frame, near: number) {
    const { p, t, dt } = f;
    const narrow = ctx.size.narrow;
    active = near > 0.5;
    const u = take.resolve(seg(p, 0.425, 0.632), p, t, dt, ctx.shot);
    if (!take.on && hoverHold >= 0 && !ctx.shot) hoverHold = -1;
    const now = u * T;
    const sz = ctx.size.dpr * (ctx.size.h / 900);

    if (scrub && !dragging) {
      const v = String(Math.round(u * 1000));
      if (scrub.value !== v) scrub.value = v;
    }
    css(scrubWrap, '--u', u);
    flag(scrubWrap, 'mine', take.on);

    /* which span is in focus */
    let cur = -1;
    for (let i = 0; i < NS; i++) if (now >= SPANS[i].t0 && now <= SPANS[i].t1 + 1e-4) cur = i;
    if (u >= 1) cur = NS - 1;
    const hv = active && ctx.pointer.seen && !dragging ? pickSpan() : -1;
    if (hv >= 0 && SPANS[hv].t0 > now) hover = -1;
    else hover = hv;
    const focus = hover >= 0 ? hover : hoverHold >= 0 ? hoverHold : cur;

    /* spans */
    for (let i = 0; i < NS; i++) {
      const s = SPANS[i];
      const len = (clamp01((now - s.t0) / (s.t1 - s.t0)) * (s.t1 - s.t0) * LEN) / T;
      const shake = s.kind === 'block' && now > s.t1 ? Math.sin((now - s.t1) * 60) * 0.02 * Math.exp(-(now - s.t1) * 9) : 0;
      m4.makeScale(Math.max(len - 0.03, 0.0001), len > 0.001 ? 1 : 0.0001, len > 0.001 ? 1 : 0.0001);
      m4.setPosition(tx(s.t0) + 0.015 + shake, LY[s.lane], LZ[s.lane]);
      spans.setMatrixAt(i, m4);
      const g = i === focus ? 1.5 : i === cur ? 1.1 : 0.25;
      glow[i] += (g - glow[i]) * damp(10, dt);
      if (ctx.shot) glow[i] = g;
      col.copy(colOf(s));
      sCol.setXYZ(i, col.r, col.g, col.b);
      sGlow.setX(i, glow[i]);
      // hand-off to the next span
      const nx = SPANS[i + 1];
      if (nx && now > s.t1) {
        a.set(tx(s.t1), LY[s.lane], LZ[s.lane]);
        b.set(tx(nx.t0) + 0.02, LY[nx.lane], LZ[nx.lane]);
        const fresh = Math.exp(-(now - s.t1) * 2.5);
        beams.set(i, a, b, 0.035, 0.25 + fresh * 1.3);
      } else beams.off(i);
    }
    spans.instanceMatrix.needsUpdate = true;
    sCol.needsUpdate = true;
    sGlow.needsUpdate = true;
    su.uTime.value = t;

    /* ports */
    for (let k = 0; k < 3; k++) {
      const s = SPANS.find((x) => x.port === k)!;
      const on = now >= s.t0 && now <= s.t1 ? 1 : 0;
      const done = now > s.t1 ? 1 : 0;
      a.set(portX[k], 0.45, 1.05);
      b.set(tx(mix(s.t0, s.t1, clamp01((now - s.t0) / (s.t1 - s.t0)))), LY[1] - 0.1, LZ[1] + 0.18);
      if (on) beams.set(NS + k, a, b, 0.05, 1.4);
      else beams.off(NS + k);
      portMat[k].color.copy(LIME).multiplyScalar(0.18 + on * 2.2 + done * 0.45);
      flag(portEls[k], 'on', on > 0);
      pin(ctx, portEls[k], wp.set(X + portX[k], 0.5, 1.2), near * (narrow ? on : 1), 0.7, narrow ? 80 : 0);
    }
    a.set(tx(now), LY[0] - 0.3, LZ[0] + 0.3);
    beams.off(NS + 3);
    beams.commit(t);

    /* playhead */
    head.position.set(tx(now), 1.8, -0.3);
    headU.uA.value = near * (u > 0 && u < 1 ? 1 : 0.35);
    headU.uTime.value = t;

    /* gate */
    const blk = SPANS[7];
    const hitT = now - blk.t1;
    const stop = now >= blk.t0 ? (hitT < 0 ? 0.5 * clamp01((now - blk.t0) / (blk.t1 - blk.t0)) : 0.07 + 0.93 * Math.exp(-hitT * 1.3)) : 0;
    gateU.uA.value = stop;
    gateU.uIdle.value = 0.6 + 0.4 * Math.sin(t * 1.4);
    gateU.uTime.value = t;
    gateLamp.intensity = near * stop * 9;
    burstU.uT.value = hitT;
    burstU.uS.value = sz;
    if (hitT > 0 && hitT < 0.6) {
      a.set(GX, LY[1], LZ[1]);
      b.set(tx(SPANS[8].t0) + 0.02, LY[0], LZ[0]);
      stopBeams.set(0, a, b, 0.05, 1.5 * (1 - hitT / 0.6));
    } else stopBeams.off(0);
    stopBeams.off(1);
    stopBeams.commit(t);
    const gateShow = focus === 7 || (now >= blk.t0 && now < SPANS[8].t1 + 0.2) ? 1 : 0;
    flag(gateEl, 'on', gateShow > 0);
    pin(ctx, gateEl, wp.set(X + GX + 1.05, 2.75, LZ[1] - 1.25), near * mix(0.75, 1, gateShow), 0.5, narrow ? 110 : 0);

    /* crowd */
    crowdU.uTime.value = t;
    crowdU.uS.value = sz;
    crowdU.uA.value = near;
    reqU.uTime.value = ctx.still ? 3 : t;
    reqU.uS.value = sz;
    reqU.uA.value = near;
    pin(ctx, crowdEl, wp.set(X - 2.5, 4.1, -2.4), near, 0.2, narrow ? 100 : 0);
    doorEls.forEach((d, i) => pin(ctx, d, wp.set(X + doors[i].x, doors[i].y + 0.36, doors[i].z), near, 0.6, narrow ? 60 : 0));
    laneEls.forEach((l, i) => pin(ctx, l, wp.set(X + X0 - 0.3, LY[i] - 0.17, LZ[i] + 0.27), near, 0.3));

    /* eval board */
    const ev = seg(u, 0.88, 1);
    for (let i = 0; i < NE; i++) {
      const cx = ((i % EC) - (EC - 1) / 2) * 0.36;
      const cy = ((ER - 1) / 2 - Math.floor(i / EC)) * 0.27;
      const k = smooth(clamp01(ev * 2.2 - flapSeed[i] * 1.2));
      rotM.makeRotationX(k * Math.PI);
      rotM.setPosition(cx, cy, 0);
      flaps.setMatrixAt(i, rotM);
    }
    flaps.instanceMatrix.needsUpdate = true;
    flag(evalEl, 'on', ev >= 1);
    pin(ctx, evalEl, wp.set(0, -(ER * 0.27) / 2 - 0.42, 0).applyMatrix4(board.matrixWorld), near, 0.3, narrow ? 80 : 0);

    /* tooltip */
    if (focus !== shownSpan && focus >= 0) {
      shownSpan = focus;
      const s = SPANS[focus];
      if (spanKind) spanKind.textContent = KIND[s.kind];
      if (spanName) spanName.textContent = s.name;
      if (spanText) spanText.textContent = s.text;
      const ms = Math.round((s.t1 - s.t0) * 1000);
      if (spanMeta) spanMeta.textContent = s.tok ? `${ms} ms · ${(s.tok / 1000).toFixed(1)}k tokens` : `${ms} ms`;
      if (spanEl) spanEl.dataset.kind = s.kind;
    }
    if (focus >= 0) {
      const s = SPANS[focus];
      const fx = tx((s.t0 + Math.min(s.t1, Math.max(now, s.t0 + 0.05))) / 2);
      // the card floats above the rack; a thread of light ties it to its span
      const top = narrow ? 3.5 : 3.02;
      a.set(fx, top, LZ[s.lane]);
      b.set(fx, LY[s.lane] + 0.15, LZ[s.lane]);
      if (u > 0.001) lead.set(0, a, b, 0.022, 0.8);
      else lead.off(0);
      lead.mat.uniforms.uCol.value.copy(s.kind === 'block' ? STOP : LIME);
      wp.set(X + fx, top, LZ[s.lane]);
    } else lead.off(0);
    lead.commit(0);
    pin(ctx, spanEl, wp, near * (focus >= 0 && u > 0.001 ? 1 : 0), 0.5, narrow ? 150 : 170);

    /* meter */
    let ms = 0;
    let tok = 0;
    for (const s of SPANS) {
      const k = clamp01((now - s.t0) / (s.t1 - s.t0));
      ms += k * (s.t1 - s.t0);
      tok += k * (s.tok ?? 0);
    }
    const mt = `${ms.toFixed(1)}|${(tok / 1000).toFixed(1)}`;
    if (mt !== meterShown) {
      meterShown = mt;
      if (meterMs) meterMs.textContent = `${ms.toFixed(1)} s`;
      if (meterTok) meterTok.textContent = `${(tok / 1000).toFixed(1)}k`;
    }

    lamp.intensity = near * (5 + stop * 2);
    lamp.position.x = tx(now);
    lamp.color.copy(LIME).lerp(STOP, stop * 0.5);
    return { u, now, stop, focus, hot: hover >= 0 };
  }

  /** world position of the MCP port, where the knowledge base cable arrives */
  const mcpPort = new THREE.Vector3(X + portX[1], 0.43, 1.05);
  return { group, update, take, mcpPort };
}
