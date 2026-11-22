import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Hero } from './Hero';
import type { Chapter, ChapterModule, Ctx, Frame, Post, Tier } from './types';

interface Entry {
  id: string;
  el: HTMLElement;
  pin: HTMLElement | null;
  load: (() => Promise<ChapterModule>) | undefined;
  chapter: Chapter | null;
  state: 'idle' | 'loading' | 'ready' | 'dead';
  top: number;
  span: number;
  io: number;
  entered?: boolean;
  /** its GPU resources were released while it was far away (three re-uploads them on next use) */
  evicted?: boolean;
  /** its lights and the most of each kind it can show at once (all of them) */
  rig?: { lights: THREE.Light[]; max: number[]; at: number };
  /** object count + material versions at the last pre-compile (a change means new shader variants) */
  sig?: number;
  readyAt?: number;
  /** its shaders were compiled and linked at least once */
  precompiled?: boolean;
}

type Hook = 'enter' | 'leave' | 'resize' | 'update';

/**
 * Light kinds that are counted in three's shader keys. A chapter hiding one of its lights would change
 * the count and force a synchronous recompile of everything it draws; the director pads the frame with
 * dark stand-ins instead, so each chapter always renders with the same light set.
 */
const KINDS = 4;
const kindOf = (o: THREE.Object3D) => {
  const l = o as THREE.Light & { isDirectionalLight?: boolean; isPointLight?: boolean; isSpotLight?: boolean; isHemisphereLight?: boolean };
  return l.isDirectionalLight ? 0 : l.isPointLight ? 1 : l.isSpotLight ? 2 : l.isHemisphereLight ? 3 : -1;
};
const darkLight = (k: number): THREE.Light =>
  k === 0 ? new THREE.DirectionalLight(0xffffff, 0) : k === 1 ? new THREE.PointLight(0xffffff, 0) : k === 2 ? new THREE.SpotLight(0xffffff, 0) : new THREE.HemisphereLight(0xffffff, 0x000000, 0);

const POST: Post = { bloom: 0.55, threshold: 0.82, vignette: 0.45, grain: 0.5, exposure: 1 };
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const idle = (fn: (d?: IdleDeadline) => void, timeout = 600) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout }) : window.setTimeout(fn, 1);

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
/**
 * One NaN or Inf pixel from any chapter's shader would spread through bloom and black out the frame:
 * a bad component zeroes the pixel, and everything is clamped to a sane HDR ceiling.
 */
const CLEAN = /* glsl */ `
  vec3 clean(vec3 c) {
    bvec3 bad = bvec3(!(c.r >= 0.0 && c.r < 1e4), !(c.g >= 0.0 && c.g < 1e4), !(c.b >= 0.0 && c.b < 1e4));
    return any(bad) ? vec3(0.0) : min(c, vec3(48.0));
  }`;

const finish = {
  uniforms: {
    tDiffuse: { value: null },
    uCut: { value: 0 },
    uTime: { value: 0 },
    uVig: { value: 0.45 },
    uGrain: { value: 0.5 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCell: { value: 14 },
    uExposure: { value: 1 },
  },
  vertexShader: VERT,
  // the old separate OutputPass is folded in here: ACES (three's fit, same exposure scaling) + sRGB
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uCut, uTime, uVig, uGrain, uCell, uExposure; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    ${CLEAN}
    vec3 rrtOdt(vec3 v) {
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }
    vec3 aces(vec3 color) {
      const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      color *= uExposure / 0.6;
      color = ACESInputMat * color;
      color = rrtOdt(color);
      color = ACESOutputMat * color;
      return clamp(color, 0.0, 1.0);
    }
    vec3 srgb(vec3 v) {
      return mix(pow(v, vec3(0.41666)) * 1.055 - vec3(0.055), v * 12.92, vec3(lessThanEqual(v, vec3(0.0031308))));
    }
    void main() {
      vec2 px = vUv * uRes;
      vec3 col = clean(texture2D(tDiffuse, vUv).rgb);
      // hand-over: the frame breaks into a dot screen whose cells drop out at random
      if (uCut > 0.004) {
        vec2 cell = floor(px / uCell);
        vec2 cuv = (cell + 0.5) * uCell / uRes;
        float c = smoothstep(0.0, 0.45, uCut);
        col = mix(col, clean(texture2D(tDiffuse, cuv).rgb), smoothstep(0.0, 0.12, uCut));
        float r = hash(cell);
        float keep = 1.0 - step(r, uCut * 1.25 - 0.12);
        float d = length(fract(px / uCell) - 0.5);
        float dotR = mix(0.75, 0.16, clamp(uCut * 1.3 + r * 0.25 * c, 0.0, 1.0));
        float m = 1.0 - smoothstep(dotR - 0.07, dotR, d);
        col *= mix(1.0, m, c) * keep;
      }
      vec2 q = vUv - 0.5;
      col *= 1.0 - uVig * smoothstep(0.25, 0.95, dot(q, q) * 2.2);
      float g = hash(px + fract(uTime) * 311.7) - 0.5;
      col += g * 0.035 * uGrain;
      col = max(col, 0.0);
      gl_FragColor = vec4(srgb(aces(col)), 1.0);
    }`,
};

/**
 * Renders the scene into its own target (multisampled when asked, with depth) and resolves it into the
 * composer's single-sample buffer through the NaN guard, so only this pass pays for MSAA and depth.
 */
class ScenePass extends Pass {
  readonly rt: THREE.WebGLRenderTarget;
  private quad: FullScreenQuad;
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    samples: number,
  ) {
    super();
    this.needsSwap = true;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true });
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: this.rt.texture } },
        vertexShader: VERT,
        fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; ${CLEAN} void main(){ gl_FragColor = vec4(clean(texture2D(tDiffuse, vUv).rgb), 1.0); }`,
        depthTest: false,
        depthWrite: false,
      }),
    );
  }
  set samples(n: number) {
    if (this.rt.samples === n) return;
    this.rt.dispose();
    this.rt.samples = n;
  }
  setSize(w: number, h: number) {
    this.rt.setSize(w, h);
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

/** Phones: no MSAA, so the scene goes straight into the composer's buffer (the guard lives in bloom and the finish). */
class DirectPass extends Pass {
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
  ) {
    super();
    this.needsSwap = false;
  }
  render(renderer: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(readBuffer);
    renderer.render(this.scene, this.camera);
  }
}

interface Level {
  dpr: number;
  msaa: boolean;
  half: boolean;
}

/**
 * collect every texture and geometry an object tree references (materials' maps and shader uniforms);
 * shown = only what is drawn as things stand (the root's own visibility aside)
 */
function collect(root: THREE.Object3D, tex: Set<THREE.Texture>, geo: Set<THREE.BufferGeometry>, shown = false) {
  const addTex = (v: unknown) => {
    if (!v) return;
    if ((v as THREE.Texture).isTexture) tex.add(v as THREE.Texture);
    else if (Array.isArray(v)) for (const x of v) if (x && (x as THREE.Texture).isTexture) tex.add(x as THREE.Texture);
  };
  const addMat = (m: THREE.Material) => {
    for (const k in m) {
      const v = (m as unknown as Record<string, unknown>)[k];
      if (v && typeof v === 'object' && (v as THREE.Texture).isTexture) tex.add(v as THREE.Texture);
    }
    const u = (m as THREE.ShaderMaterial).uniforms;
    if (u) for (const k in u) addTex(u[k]?.value);
  };
  const visit = (o: THREE.Object3D) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (g && g.isBufferGeometry) geo.add(g);
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(addMat);
    else if (mat) addMat(mat);
    const sk = (o as THREE.SkinnedMesh).skeleton;
    if (sk?.boneTexture) tex.add(sk.boneTexture);
  };
  if (!shown) root.traverse(visit);
  else for (const c of root.children) c.traverseVisible(visit);
}

/** a downscaled copy of an image as an ImageBitmap, or null if it is small enough or the browser cannot */
async function shrink(img: unknown, width: number, flip: boolean, always = false): Promise<ImageBitmap | null> {
  const src = img as { width?: number; height?: number } | null;
  if (!src?.width || !src.height || (src.width <= width && !always) || typeof createImageBitmap !== 'function') return null;
  const w = Math.max(1, Math.round(Math.min(width, src.width)));
  const h = Math.max(1, Math.round((src.height * w) / src.width));
  const resize = w < src.width ? { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' as ResizeQuality } : {};
  try {
    const bm = await createImageBitmap(img as ImageBitmapSource, {
      ...resize,
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
      imageOrientation: (flip ? 'flipY' : 'from-image') as ImageOrientation,
    });
    if (bm.width !== w) {
      bm.close();
      return null;
    }
    return bm;
  } catch {
    return null;
  }
}

export class World {
  readonly ctx: Ctx;
  readonly hero: Hero;
  private entries: Entry[] = [];
  private active = -1;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private scenePass: ScenePass | null = null;
  private bloom: UnrealBloomPass;
  private fin: ShaderPass;
  private timer = new THREE.Timer();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private lastY = 0;
  private virtual: number | null = null;
  private pending: { id: string; p: number } | null = null;
  private running = false;
  private holds = new Set<string>();
  private fr: Frame = { p: 0, io: 0, side: 0, t: 0, dt: 0, vel: 0 };
  private wIn = 0;
  private wOut = 0;
  private bootAt = performance.now();
  private idleAsked = new Set<number>();
  private uploads: THREE.Texture[] = [];
  private levels: Level[] = [];
  private bloomHalf = false;
  /** dark stand-in lights, by kind, always in the scene */
  private pads: THREE.Light[][] = [[], [], [], []];
  private padRoot = new THREE.Group();
  private vis = [0, 0, 0, 0];
  private compileQ: Entry[] = [];
  private compiling = false;
  private heroSeen = false;
  /** the hero's own materials, recorded when he arrives: a chapter may swap one for its own while it
   * is on screen (About's x-ray), and its neighbours must still be compiled for the original */
  private heroBase = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>();
  private heroHold = 0;
  private sigAt = 0;
  private movedAt = 0;
  /** material -> version it was last warm-drawn at (with the chapter it was drawn for) */
  private warmed = new WeakMap<THREE.Material, string>();
  private videos: HTMLVideoElement[] = [];
  private pausedByUs = new Set<HTMLVideoElement>();
  private gov = { n: 0, minDt: 1, avg: 0, work: 0, slow: 0, fast: 0, lastUp: 0, lastDown: 0, upWait: 10 };
  onFirstFrame: (() => void) | null = null;
  onActive: ((id: string, index: number) => void) | null = null;
  /** run at the top of every frame (smooth scroll goes here, so the frame reads this frame's scroll) */
  readonly before: ((now: number) => void)[] = [];
  /** run at the end of every frame (DOM that follows the story) */
  readonly after: ((now: number) => void)[] = [];
  /** overall story progress 0..1, for the progress rail */
  progress = 0;
  /** the chapter that owns the viewport and the progress through it, for the node navigator */
  readonly now = { id: '', index: -1, p: 0, /** document scroll y this frame was drawn for (read before any DOM write) */ y: 0 };
  /** adaptive quality state (read-only from outside) */
  readonly quality = { level: 0, levels: 1, dpr: 1, msaa: false, bloomHalf: false, /** s */ budget: 0, /** ms */ budgetMs: 0, /** ms, moving average frame interval */ avg: 0, /** ms, moving average main-thread work per frame */ work: 0, ups: 0, downs: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    sections: HTMLElement[],
    loaders: Record<string, () => Promise<ChapterModule>>,
    opts: { tier: Tier; still: boolean; shot: boolean; scrollTo: (y: number, instant?: boolean) => void },
  ) {
    const tier = opts.tier;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    this.renderer = renderer;
    const dpr = Math.min(devicePixelRatio || 1, [1.5, 1.75, 2][tier]);
    renderer.setPixelRatio(dpr);
    // tone mapping and the output transform happen in the finish pass; scene renders go to HDR targets
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 1);
    // checking compile status is a synchronous round trip to the GPU process at every program's first
    // use (a stall of tens to hundreds of ms per chapter): only on request while developing (?glcheck)
    renderer.debug.checkShaderErrors = !!import.meta.env.DEV && location.search.includes('glcheck');

    const scene = new THREE.Scene();
    const bg = new THREE.Color(0x000000);
    scene.background = bg;
    const fog = new THREE.FogExp2(0x000000, 0);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
    camera.position.set(0, 1.2, 6);

    const hero = new Hero(tier);
    this.hero = hero;
    scene.add(hero.root);
    this.padRoot.name = 'light-pads';
    scene.add(this.padRoot);

    const texLoader = new THREE.TextureLoader();
    const gltf = new GLTFLoader();
    // compressed (meshopt) and plain GLBs both load; the decoder module is fetched alongside the first file
    const meshopt = import('three/addons/libs/meshopt_decoder.module.js').then(async (m) => {
      await m.MeshoptDecoder.ready;
      gltf.setMeshoptDecoder(m.MeshoptDecoder);
    });
    const cache = new Map<string, Promise<unknown>>();
    const once = <T>(key: string, make: () => Promise<T>) => {
      if (!cache.has(key)) cache.set(key, make());
      return cache.get(key) as Promise<T>;
    };
    const proj = new THREE.Vector3();
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const loadGlb = async (url: string, small: boolean) => {
      const [buf] = await Promise.all([
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(`${r.status} ${url}`);
          return r.arrayBuffer();
        }),
        meshopt.catch((e) => console.warn('meshopt decoder unavailable', e)),
      ]);
      const g = await gltf.parseAsync(buf, url.slice(0, url.lastIndexOf('/') + 1));
      // phones: material textures at most 512 wide (the owner approved half-size textures on tier 0)
      if (small) {
        const jobs = new Map<object, Promise<void>>();
        const tex = new Set<THREE.Texture>();
        collect(g.scene, tex, new Set());
        for (const t of tex) {
          const s = t.source as { data: unknown; needsUpdate: boolean };
          if (jobs.has(s)) continue;
          jobs.set(
            s,
            shrink(s.data, 512, false).then((bm) => {
              if (!bm) return;
              const old = s.data;
              s.data = bm;
              s.needsUpdate = true;
              if (typeof ImageBitmap !== 'undefined' && old instanceof ImageBitmap) old.close();
            }),
          );
        }
        await Promise.all(jobs.values());
      }
      return { scene: g.scene, animations: g.animations };
    };

    this.ctx = {
      renderer,
      scene,
      camera,
      hero,
      tier,
      still: opts.still,
      shot: opts.shot,
      pointer: { x: 0, y: 0, rx: 0, ry: 0, px: 0, py: 0, down: false, seen: false },
      size: { w: 1, h: 1, narrow: false, dpr },
      post: { ...POST },
      bg,
      fog,
      project: (v, out = { x: 0, y: 0, z: 0 }) => {
        proj.copy(v).project(camera);
        out.x = (proj.x * 0.5 + 0.5) * this.ctx.size.w;
        out.y = (-proj.y * 0.5 + 0.5) * this.ctx.size.h;
        out.z = proj.z;
        return out;
      },
      ray: (raw = false) => {
        const q = this.ctx.pointer;
        this.ndc.set(raw ? q.rx : q.x, raw ? q.ry : q.y);
        this.raycaster.setFromCamera(this.ndc, camera);
        return this.raycaster;
      },
      goTo: (id, p = 0) => this.goTo(id, p, opts.scrollTo),
      tex: (url, o = {}) =>
        once(`t:${url}:${o.srgb !== false}:${!!o.repeat}:${o.flipY !== false}`, async () => {
          const flip = o.flipY !== false;
          // decoded off the main thread into an ImageBitmap straight from the file's bytes (from an <img>,
          // createImageBitmap copies and scales on the main thread: 60-90 ms per texture on a phone, right
          // when a neighbouring chapter loads during an entrance), so the GPU upload later is a plain copy.
          // Phones also halve anything wider than 1024 (the owner approved). An ImageBitmap ignores flipY
          // at upload, so the flip happens here.
          let t: THREE.Texture;
          const blob = typeof createImageBitmap === 'function' ? await fetch(url).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
          let bm = blob ? await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: flip ? 'flipY' : 'from-image' }).catch(() => null) : null;
          if (bm && tier === 0 && bm.width > 1024) {
            const half = await shrink(bm, bm.width / 2, false);
            if (half) {
              bm.close();
              bm = half;
            }
          }
          if (bm) {
            t = new THREE.Texture(bm as unknown as HTMLImageElement);
            t.flipY = false;
            t.needsUpdate = true;
          } else {
            t = await texLoader.loadAsync(url);
            if (!flip) t.flipY = false;
          }
          if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
          if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = maxAniso;
          return t;
        }),
      video: (url, o = {}) =>
        once(`v:${url}`, async () => {
          const el = document.createElement('video');
          el.src = url;
          el.muted = true;
          el.playsInline = true;
          el.loop = o.loop !== false;
          el.preload = 'auto';
          el.crossOrigin = 'anonymous';
          if (o.poster) el.poster = o.poster;
          await new Promise<void>((res) => {
            el.addEventListener('loadeddata', () => res(), { once: true });
            el.addEventListener('error', () => res(), { once: true });
            setTimeout(res, 4000);
          });
          this.videos.push(el);
          const tex = new THREE.VideoTexture(el);
          tex.colorSpace = THREE.SRGBColorSpace;
          return { el, tex };
        }),
      glb: (url) => once(`g:${url}`, () => loadGlb(url, tier === 0)),
    };

    // ping-pong buffers: single-sample half float, no depth (phones render the scene straight into them, so they keep depth there)
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0, depthBuffer: tier === 0, stencilBuffer: false }));
    if (tier > 0) {
      this.scenePass = new ScenePass(scene, camera, 4);
      composer.addPass(this.scenePass);
    } else composer.addPass(new DirectPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), POST.bloom, 0.7, POST.threshold);
    // the bloom chain reads only its high-pass, so guarding that keeps a bad pixel from spreading
    const hp = this.bloom.materialHighPassFilter;
    hp.fragmentShader = hp.fragmentShader
      .replace('void main() {', `${CLEAN}\nvoid main() {`)
      .replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = texture2D( tDiffuse, vUv ); texel.rgb = clean( texel.rgb );');
    composer.addPass(this.bloom);
    this.fin = new ShaderPass(finish);
    (this.fin.material as THREE.ShaderMaterial).toneMapped = false;
    composer.addPass(this.fin);
    this.composer = composer;

    // quality ladder, best first: resolution steps, then MSAA off, then half-resolution bloom
    const minDpr = tier === 0 ? 0.85 : 1;
    let d = dpr;
    const msaa = tier > 0;
    this.levels.push({ dpr: d, msaa, half: false });
    while (d - 0.25 >= minDpr - 1e-3) this.levels.push({ dpr: (d = Math.round((d - 0.25) * 100) / 100), msaa, half: false });
    if (d > minDpr + 1e-3) this.levels.push({ dpr: (d = minDpr), msaa, half: false });
    if (msaa) this.levels.push({ dpr: d, msaa: false, half: false });
    this.levels.push({ dpr: d, msaa: false, half: true });
    Object.assign(this.quality, { level: 0, levels: this.levels.length, dpr, msaa, bloomHalf: false });

    for (const el of sections) {
      const id = el.id;
      this.entries.push({ id, el, pin: el.querySelector<HTMLElement>(':scope > .pin'), load: loaders[id], chapter: null, state: loaders[id] ? 'idle' : 'dead', top: 0, span: 1, io: 0 });
    }

    const p = this.ctx.pointer;
    const move = (x: number, y: number) => {
      p.px = x;
      p.py = y;
      p.rx = (x / this.ctx.size.w) * 2 - 1;
      p.ry = -((y / this.ctx.size.h) * 2 - 1);
      p.seen = true;
    };
    addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
    addEventListener('pointerdown', (e) => { move(e.clientX, e.clientY); p.down = true; }, { passive: true });
    addEventListener('pointerup', () => (p.down = false), { passive: true });
    addEventListener('pointercancel', () => (p.down = false), { passive: true });

    // the environment map takes a few hundred ms of shader work: build it after the page's first paint
    // (every chapter waits for it before it is compiled or drawn)
    idle(() => this.makeEnv(), 300);

    this.resize();
    let rt = 0;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = window.setTimeout(() => this.resize(), 120);
    });
    document.fonts?.ready.then(() => this.measure());
    addEventListener('load', () => this.measure());
    document.addEventListener('visibilitychange', () => {
      this.hold('hidden', document.hidden);
      // chapter videos would keep decoding in a background tab: pause them, resume only what we paused
      if (document.hidden) {
        for (const v of this.videos)
          if (!v.paused) {
            v.pause();
            this.pausedByUs.add(v);
          }
      } else {
        for (const v of this.pausedByUs) v.play().catch(() => {});
        this.pausedByUs.clear();
      }
    });

    // the hero is exempt from the 512 rule for phones (it would blur his face). He ships as two files from
    // the same export (tools/gen/hero2/web_export.mjs): phones fetch the one with base colour and normal map
    // at 1024 and metal-roughness at 512, so they neither download nor decode the 2048 set
    // (while developing, ?hero=<url> loads another file instead, to compare an export against its source)
    const heroDev = import.meta.env.DEV ? new URLSearchParams(location.search).get('hero') : null;
    const heroUrl = heroDev ?? (tier === 0 ? '/assets/hero/hero.m.glb' : '/assets/hero/hero.glb');
    hero.load(heroUrl, (url) => once(`g:full:${url}`, () => loadGlb(url, false))).catch((e) => console.warn('hero model not available yet', e));
  }

  private makeEnv() {
    const scene = this.ctx.scene;
    if (scene.environment) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  /** capture mode: pretend the page is scrolled to progress p of a chapter */
  pinTo(id: string, p: number) {
    this.pending = { id, p };
    this.measure();
  }

  /** document scroll y at progress p of a chapter (null if the chapter is not in the page) */
  yOf(id: string, p: number) {
    const i = this.entries.findIndex((e) => e.id === id.replace('#', ''));
    if (i < 0) return null;
    const e = this.entries[i];
    this.windows(i);
    return e.top + this.wIn + clamp01(p) * Math.max(0, e.span - this.wIn - this.wOut) + 2;
  }

  private goTo(id: string, p: number, scrollTo: (y: number, instant?: boolean) => void) {
    const y = this.yOf(id, p);
    if (y !== null) scrollTo(y);
  }

  /** hand-over window heights of chapter i, into wIn / wOut (no allocation: called every frame) */
  private windows(i: number) {
    const e = this.entries[i];
    const w = Math.min(this.ctx.size.h * 0.42, e.span * 0.2);
    this.wIn = i === 0 ? 0 : w;
    this.wOut = i === this.entries.length - 1 ? 0 : w;
  }

  private measure() {
    const vh = innerHeight;
    this.entries.forEach((e, i) => {
      const r = e.el.getBoundingClientRect();
      e.top = r.top + scrollY;
      e.span = Math.max(1, i === this.entries.length - 1 ? r.height - vh : r.height);
    });
    if (this.pending) this.virtual = this.yOf(this.pending.id, this.pending.p);
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    const s = this.ctx.size;
    s.w = w;
    s.h = h;
    s.narrow = w <= 860;
    this.renderer.setPixelRatio(s.dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(s.dpr);
    this.composer.setSize(w, h);
    // the composer sizes bloom at half the frame; the last quality step halves it again
    if (this.bloomHalf) this.bloom.setSize((w * s.dpr) / 2, (h * s.dpr) / 2);
    this.fin.uniforms.uRes.value.set(w * s.dpr, h * s.dpr);
    this.fin.uniforms.uCell.value = Math.round((s.narrow ? 9 : 13) * s.dpr);
    this.ctx.camera.aspect = w / h;
    this.ctx.camera.updateProjectionMatrix();
    this.measure();
    for (const e of this.entries) if (e.state === 'ready') this.call(e, 'resize');
  }

  /** run a chapter hook; an exception disables only that chapter */
  private call(e: Entry, hook: Hook) {
    const ch = e.chapter;
    if (!ch) return;
    try {
      if (hook === 'update') ch.update(this.fr, this.ctx);
      else ch[hook]?.(this.ctx);
    } catch (err) {
      console.error(`[chapter ${e.id}]`, err);
      e.state = 'dead';
      ch.group.visible = false;
    }
  }

  private ensure(i: number) {
    const e = this.entries[i];
    if (!e || e.state !== 'idle' || !e.load) return;
    e.state = 'loading';
    e.load()
      .then(async (m) => {
        const ch = m.default;
        this.makeEnv();
        ch.group.visible = false;
        this.ctx.scene.add(ch.group);
        await ch.init(this.ctx, e.el);
        e.chapter = ch;
        e.state = 'ready';
        e.readyAt = performance.now();
        ch.resize?.(this.ctx);
        e.el.classList.add('ready');
        // not on screen yet: upload its textures in the background
        if (this.entries.indexOf(e) !== this.active) this.queueUploads(e);
        this.rig(e);
        this.queueCompile(e);
      })
      .catch((err) => {
        console.error(`[chapter ${e.id}] failed to start`, err);
        e.state = 'dead';
        e.el.classList.add('dead');
      });
  }

  /**
   * Neighbours load once the chapter on screen is up and the hero has arrived (or after 2 s), in idle
   * time, so a phone spends its first seconds of bandwidth and main thread on what it shows.
   */
  private ensureLater(i: number) {
    const e = this.entries[i];
    if (!e || e.state !== 'idle' || this.idleAsked.has(i)) return;
    const cur = this.entries[this.active];
    const settled = cur && cur.state !== 'idle' && cur.state !== 'loading';
    if (!settled || (!this.hero.ready && performance.now() - this.bootAt < 2000)) return;
    this.idleAsked.add(i);
    idle(() => {
      this.idleAsked.delete(i);
      this.ensure(i);
    });
  }

  /* ---------- GPU memory: release far chapters, pre-upload near ones ---------- */

  private keepSet() {
    const tex = new Set<THREE.Texture>();
    const geo = new Set<THREE.BufferGeometry>();
    collect(this.hero.root, tex, geo);
    for (let j = this.active - 1; j <= this.active + 1; j++) {
      const n = this.entries[j];
      if (n?.chapter) collect(n.chapter.group, tex, geo);
    }
    const env = this.ctx.scene.environment;
    if (env) tex.add(env);
    return { tex, geo };
  }

  /** drop the GPU copies of chapters two or more away; their CPU data stays, three re-uploads on next use */
  private evictFar() {
    let keep: ReturnType<World['keepSet']> | null = null;
    for (let j = 0; j < this.entries.length; j++) {
      const e = this.entries[j];
      if (e.evicted || e.state !== 'ready' || !e.chapter || Math.abs(j - this.active) < 2) continue;
      keep ??= this.keepSet();
      const tex = new Set<THREE.Texture>();
      const geo = new Set<THREE.BufferGeometry>();
      collect(e.chapter.group, tex, geo);
      for (const t of tex) {
        if (keep.tex.has(t) || (t as THREE.VideoTexture).isVideoTexture || t.isRenderTargetTexture || (t as THREE.DepthTexture).isDepthTexture) continue;
        t.dispose();
      }
      for (const g of geo) if (!keep.geo.has(g)) g.dispose();
      e.evicted = true;
    }
  }

  private queueUploads(e: Entry) {
    if (!e.chapter) return;
    const tex = new Set<THREE.Texture>();
    collect(e.chapter.group, tex, new Set(), true);
    const props = this.renderer.properties;
    for (const t of tex) {
      if ((t as THREE.VideoTexture).isVideoTexture || t.isRenderTargetTexture || !t.image) continue;
      if ((props.get(t) as { __webglInit?: boolean }).__webglInit) continue;
      if (!this.uploads.includes(t)) this.uploads.push(t);
    }
  }

  private pumpUploads(n: number) {
    const props = this.renderer.properties;
    while (n > 0 && this.uploads.length) {
      const t = this.uploads.shift()!;
      if ((props.get(t) as { __webglInit?: boolean }).__webglInit) continue;
      this.renderer.initTexture(t);
      n--;
    }
  }


  /* ---------- constant light sets + shader pre-compilation ---------- */

  /** (re)collect a chapter's lights; returns true if the most it can show of some kind grew */
  private rig(e: Entry) {
    if (!e.chapter) return false;
    const lights: THREE.Light[] = [];
    const max = [0, 0, 0, 0];
    e.chapter.group.traverse((o) => {
      const k = kindOf(o);
      if (k < 0) return;
      lights.push(o as THREE.Light);
      max[k]++;
    });
    const old = e.rig;
    e.rig = { lights, max, at: 0 };
    return !!old && max.some((m, k) => m > old.max[k]);
  }

  /** fill the frame up to the chapter's full light set with dark stand-ins for whatever it hid */
  private padLights(e: Entry) {
    const vis = this.vis;
    vis[0] = vis[1] = vis[2] = vis[3] = 0;
    const rig = e.state === 'ready' && e.chapter?.group.visible ? e.rig : undefined;
    if (rig) {
      // chapters may add lights after init (lazy kits): look again now and then
      if (++rig.at >= 90) {
        rig.at = 0;
        if (this.rig(e)) this.queueCompile(e);
      }
      const group = e.chapter!.group;
      const ls = e.rig!.lights;
      for (let i = 0; i < ls.length; i++) {
        let o: THREE.Object3D | null = ls[i];
        while (o && o !== group && o.visible) o = o.parent;
        if (o === group) vis[kindOf(ls[i])]++;
      }
    }
    for (let k = 0; k < KINDS; k++) {
      const need = rig ? Math.max(0, e.rig!.max[k] - vis[k]) : 0;
      const pool = this.pads[k];
      while (pool.length < need) {
        const l = darkLight(k);
        pool.push(l);
        this.padRoot.add(l);
      }
      for (let i = 0; i < pool.length; i++) pool[i].visible = i < need;
    }
  }

  private sig(e: Entry) {
    let n = 0;
    e.chapter?.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      n += 1000;
      if (Array.isArray(m)) for (const x of m) n += x.version;
      else n += m.version;
    });
    return n;
  }

  private queueCompile(e: Entry) {
    if (!this.compileQ.includes(e)) {
      // the chapter on screen first
      if (e === this.entries[this.active]) this.compileQ.unshift(e);
      else this.compileQ.push(e);
    }
    this.pumpCompile();
  }

  /**
   * Compile a chapter's materials (and the hero's) for the exact variants the director will draw:
   * same fog, environment, HDR target and full light set. Done in idle slices of a few ms; with
   * KHR_parallel_shader_compile the driver links in the background, so the first real draw does not wait.
   */
  private pumpCompile() {
    if (this.compiling || !this.compileQ.length) return;
    this.compiling = true;
    let job: { e: Entry; objs: THREE.Object3D[]; i: number; stand: THREE.Scene; draws: THREE.Object3D[] | null; d: number } | null = null;
    const step = (deadline?: IdleDeadline) => {
      const t0 = performance.now();
      let defer = false;
      const budget = deadline && !deadline.didTimeout ? Math.min(8, Math.max(2, deadline.timeRemaining() - 1)) : 6;
      const r = this.renderer;
      const prev = r.getRenderTarget();
      r.setRenderTarget(this.scenePass ? this.scenePass.rt : this.composer.readBuffer);
      try {
        while (performance.now() - t0 < budget) {
          if (!job) {
            const e = this.compileQ.shift();
            if (!e) break;
            if (e.state !== 'ready' || !e.chapter) continue;
            if (!e.rig) this.rig(e);
            const stand = new THREE.Scene();
            const scene = this.ctx.scene;
            stand.fog = scene.fog;
            stand.environment = scene.environment;
            stand.environmentRotation.copy(scene.environmentRotation);
            e.rig!.max.forEach((n, k) => {
              for (let i = 0; i < n; i++) stand.add(darkLight(k));
            });
            const objs: THREE.Object3D[] = [];
            const take = (o: THREE.Object3D) => {
              const m = o as THREE.Mesh;
              if ((m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) && m.material) objs.push(o);
            };
            e.chapter.group.traverse(take);
            if (this.hero.ready) this.hero.root.traverse(take);
            job = { e, objs, i: 0, stand, draws: null, d: 0 };
            e.sig = this.sig(e);
          }
          const group = job.e.chapter?.group;
          if (!group) {
            job = null;
            continue;
          }
          if (job.i >= job.objs.length) {
            // then one real draw per material into a single scissored pixel: some drivers (ANGLE on
            // D3D) finish a program only at its first draw with the real target and vertex layout
            // wait for the driver to finish linking what was just compiled (else the draw would wait for
            // it); while the reader scrolls, one draw per slice and none inside a hand-over window
            const linking = r.info.programs!.some((pg) => !(pg as unknown as { isReady(): boolean }).isReady());
            if (!linking) job.e.precompiled = true;
            if (job.e === this.entries[this.active] || job.e.state !== 'ready') {
              if (linking && job.e.state === 'ready') {
                defer = true;
                break;
              }
              job = null;
              continue;
            }
            const moving = performance.now() - this.movedAt < 400;
            if ((moving && this.fr.io < 1) || linking) {
              defer = true;
              break;
            }
            if (!job.draws) {
              // one object per material is enough
              const seen = new Set<THREE.Material>();
              job.draws = job.objs.filter((o) => {
                const m = (this.heroBase.get(o) ?? (o as THREE.Mesh).material) as THREE.Material | THREE.Material[];
                const key = Array.isArray(m) ? m[0] : m;
                if (seen.has(key)) return false;
                seen.add(key);
                return this.warmed.get(key) !== `${job!.e.id}:${key.version}`;
              });
            }
            if (job.d >= job.draws.length) {
              job = null;
              continue;
            }
            const wo = job.draws[job.d++];
            const wm = (this.heroBase.get(wo) ?? (wo as THREE.Mesh).material) as THREE.Material | THREE.Material[];
            const wk = Array.isArray(wm) ? wm[0] : wm;
            const undo = this.heroOwn(wo);
            try {
              this.warmDraw(job.e, wo);
            } finally {
              undo();
            }
            this.warmed.set(wk, `${job.e.id}:${wk.version}`);
            if (moving) break;
            continue;
          }
          // the group is hidden meanwhile so its own lights are not counted on top of the stand-ins
          const was = group.visible;
          group.visible = false;
          const co = job.objs[job.i++];
          const undo = this.heroOwn(co);
          try {
            r.compile(co, this.ctx.camera, job.stand);
          } finally {
            group.visible = was;
            undo();
          }
        }
      } catch (err) {
        console.warn('shader pre-compile skipped', err);
        job = null;
      } finally {
        r.setRenderTarget(prev);
      }
      if (defer) window.setTimeout(() => idle(step, 1000), 120);
      else if (job || this.compileQ.length) idle(step, 1000);
      else this.compiling = false;
    };
    idle(step, 1000);
  }

  /** put the hero's own material back on one of his objects for a moment; returns the undo */
  private heroOwn(o: THREE.Object3D) {
    const base = this.heroBase.get(o);
    const m = o as THREE.Mesh;
    const cur = m.material;
    if (!base || base === cur) return () => {};
    m.material = base;
    return () => {
      m.material = cur;
    };
  }

  /** draw a single object of a chapter (with that chapter's light set) into one scissored pixel */
  private warmDraw(e: Entry, obj: THREE.Object3D) {
    const group = e.chapter!.group;
    const act = this.entries[this.active];
    const actGroup = act?.chapter?.group;
    const r = this.renderer;
    const target = this.scenePass ? this.scenePass.rt : this.composer.readBuffer;
    const saved: [THREE.Object3D, boolean][] = [];
    const set = (o: THREE.Object3D, v: boolean) => {
      saved.push([o, o.visible]);
      o.visible = v;
    };
    const culled = obj.frustumCulled;
    try {
      const own = !!group.getObjectById(obj.id);
      if (actGroup && actGroup !== group) set(actGroup, false);
      if (own) set(this.hero.root, false);
      // warming one of his objects: only that one (another may wear the active chapter's material,
      // which would then link a program for this chapter's lights that is never used)
      else
        this.hero.root.traverse((o) => {
          if (o !== obj && o.visible && ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints)) set(o, false);
        });
      if (!group.visible) set(group, true);
      // everything else in the chapter hidden (its lights stay as they are; the pads make up the set)
      group.traverse((o) => {
        if (o !== obj && o.visible && kindOf(o) < 0 && ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite)) set(o, false);
      });
      for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (!o.visible) set(o, true);
      obj.frustumCulled = false;
      this.padLights(e);
      target.scissor.set(0, 0, 1, 1);
      target.scissorTest = true;
      r.setRenderTarget(target);
      r.render(this.ctx.scene, this.ctx.camera);
    } finally {
      target.scissorTest = false;
      target.scissor.set(0, 0, target.width, target.height);
      obj.frustumCulled = culled;
      for (let i = saved.length - 1; i >= 0; i--) saved[i][0].visible = saved[i][1];
      if (act) this.padLights(act);
    }
  }

  /* ---------- loop ---------- */

  /** pause the loop while any reason holds (hidden tab, a full-screen menu over the canvas) */
  hold(reason: string, on: boolean) {
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    if (this.holds.size) this.stop();
    else this.start();
  }

  start() {
    if (this.running || this.holds.size) return;
    this.running = true;
    this.timer.reset();
    this.gov.slow = this.gov.fast = 0;
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }
  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private first = true;

  private frame(now: number) {
    const t0 = performance.now();
    for (let i = 0; i < this.before.length; i++) this.before[i](now);
    this.timer.update(now);
    const raw = this.timer.getDelta();
    const dt = Math.min(raw, 0.1);
    const t = this.timer.getElapsed();
    const ctx = this.ctx;
    const y = this.virtual ?? scrollY;
    const ptr = ctx.pointer;
    const k = 1 - Math.exp(-dt * 7);
    ptr.x += (ptr.rx - ptr.x) * k;
    ptr.y += (ptr.ry - ptr.y) * k;

    // which chapter owns the viewport
    let idx = 0;
    for (let i = 0; i < this.entries.length; i++) if (y >= this.entries[i].top - 1) idx = i;
    const e = this.entries[idx];
    if (!e) return;
    const local = y - e.top;
    this.windows(idx);
    const inW = this.wIn;
    const outW = this.wOut;
    const a = inW ? clamp01(local / inW) : 1;
    const b = outW ? clamp01((e.span - local) / outW) : 1;
    const io = smooth(Math.min(a, b));
    const side: Frame['side'] = a < 1 ? -1 : b < 1 ? 1 : 0;
    const body = Math.max(1, e.span - inW - outW);
    const p = clamp01((local - inW) / body);
    const vel = (y - this.lastY) / Math.max(dt, 1e-4) / body;
    this.lastY = y;
    const last = this.entries[this.entries.length - 1];
    this.progress = clamp01(y / Math.max(1, last.top + last.span));
    this.now.id = e.id;
    this.now.index = idx;
    this.now.p = p;
    if (y !== this.now.y) this.movedAt = now;
    this.now.y = y;

    if (idx !== this.active) {
      const prev = this.entries[this.active];
      if (prev) {
        if (prev.state === 'ready') this.call(prev, 'leave');
        if (prev.chapter) prev.chapter.group.visible = false;
        prev.el.classList.remove('on');
        if (prev.pin) prev.pin.inert = true;
        prev.io = 0;
        if (prev.pin) prev.pin.style.opacity = '0';
      }
      this.active = idx;
      e.el.classList.add('on');
      if (e.pin) e.pin.inert = false;
      document.documentElement.dataset.chapter = e.id;
      e.entered = false;
      this.onActive?.(e.id, idx);
      e.evicted = false;
      for (const j of [idx - 1, idx + 1]) {
        const n = this.entries[j];
        if (n?.evicted) {
          n.evicted = false;
          this.queueUploads(n);
        }
      }
      this.evictFar();
      // neighbours again: materials that got their textures (or were created) after init have new variants
      for (const j of [idx - 1, idx + 1]) {
        const n = this.entries[j];
        if (n?.state === 'ready') this.queueCompile(n);
      }
    }
    this.ensure(idx);
    this.ensureLater(idx + (side < 0 ? -1 : 1));
    if (p > 0.4) this.ensureLater(idx + 1);

    // defaults; the chapter overrides what it needs
    ctx.bg.set(0x000000);
    ctx.fog.color.set(0x000000);
    ctx.fog.density = 0;
    Object.assign(ctx.post, POST);
    ctx.scene.environmentIntensity = 0.55;
    ctx.camera.fov = 35;
    this.hero.reset();

    let cut = 1 - io;
    if (e.state === 'ready') {
      const ch = e.chapter!;
      ch.group.visible = true;
      if (!e.entered) {
        e.entered = true;
        this.call(e, 'enter');
      }
      const f = this.fr;
      f.p = p;
      f.io = io;
      f.side = side;
      f.t = t;
      f.dt = dt;
      f.vel = vel;
      this.call(e, 'update');
    } else {
      this.hero.visible = false;
      if (e.state === 'loading') cut = 1;
    }
    // a chapter that just arrived stays dark (it is still behind the loading cut) for up to 1.5 s while
    // its shaders compile in the background, instead of compiling them all inside its first frame
    if (e.state === 'ready' && !e.precompiled && !ctx.shot && performance.now() - (e.readyAt ?? 0) < 1500) cut = 1;
    if (e.pin && Math.abs(io - e.io) > 0.004) {
      e.io = io;
      e.pin.style.opacity = io.toFixed(3);
    }

    // the hero just arrived: he steps in once his shaders are compiled for this chapter (at most 1.5 s)
    if (this.heroHold && !ctx.shot) {
      if (e.precompiled || performance.now() > this.heroHold) this.heroHold = 0;
      else this.hero.visible = false;
    }
    ctx.camera.updateProjectionMatrix();
    ctx.camera.updateMatrixWorld();
    this.hero.update(dt, t, ctx.ray().ray, ctx.size.dpr, ctx.size.h);
    this.padLights(e);
    // materials that got a texture (needsUpdate) or objects added after init change shader variants:
    // look at the chapter on screen and its neighbours about once a second and compile what is new
    if (++this.sigAt >= 60) {
      this.sigAt = 0;
      for (let j = idx - 1; j <= idx + 1; j++) {
        const n = this.entries[j];
        if (n?.state === 'ready' && n.sig !== undefined && n.sig !== this.sig(n)) this.queueCompile(n);
      }
    }
    if (this.hero.ready && !this.heroSeen) {
      // the hero arrived after some chapters were compiled: compile his materials under their lights too
      this.heroSeen = true;
      this.hero.root.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) this.heroBase.set(o, m);
      });
      this.heroHold = performance.now() + 1500;
      for (const n of this.entries)
        if (n.state === 'ready') {
          n.precompiled = false;
          this.queueCompile(n);
        }
    }

    if (e.state === 'dead') cut = 0;
    if (cut >= 0.999) {
      // the frame would be black (a chapter still loading, or the exact hand-over point): skip the passes
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
      this.pumpUploads(4);
    } else {
      this.bloom.strength = ctx.post.bloom;
      this.bloom.threshold = ctx.post.threshold;
      const u = this.fin.uniforms;
      u.uExposure.value = ctx.post.exposure;
      u.uCut.value = cut;
      u.uTime.value = t;
      u.uVig.value = ctx.post.vignette;
      u.uGrain.value = ctx.post.grain;
      this.composer.render(dt);
      this.pumpUploads(ctx.tier === 0 ? 1 : 2);
    }

    if (this.first) {
      this.first = false;
      this.onFirstFrame?.();
    }
    for (let i = 0; i < this.after.length; i++) this.after[i](now);
    this.govern(raw, performance.now() - t0, t);
  }

  /* ---------- adaptive quality ---------- */

  /**
   * Learns the display's frame interval from the fastest of the first 60 frames, then steps quality
   * down after 2 s of frames averaging over 1.4x that, and back up after 6 s of clean frames with
   * main-thread work under 0.7x of it (at most every 10 s, waiting longer after each step that
   * had to be undone).
   */
  private govern(dt: number, work: number, t: number) {
    const g = this.gov;
    const q = this.quality;
    if (this.ctx.shot || dt <= 0 || dt > 0.5) return;
    if (g.n < 60) {
      g.n++;
      g.minDt = Math.min(g.minDt, dt);
      g.avg = dt;
      g.work = work / 1000;
      // rAF intervals jitter below the real one: snap to the nearest common refresh rate at or above it
      if (g.n === 60) {
        const hz = [240, 165, 144, 120, 90, 75, 60, 50, 30].find((h) => 1 / h >= g.minDt * 0.92) ?? 30;
        q.budget = 1 / hz;
        q.budgetMs = 1000 / hz;
      }
      return;
    }
    const budget = q.budget;
    // one-off hitches (a chapter starting up, a texture upload, a tab switch) say nothing about sustained
    // GPU load: leave them out of the average instead of letting them push quality down
    if (dt > budget * 4) return;
    g.avg += (dt - g.avg) * 0.08;
    g.work += (work / 1000 - g.work) * 0.08;
    q.avg = g.avg * 1000;
    q.work = g.work * 1000;
    g.slow = g.avg > budget * 1.4 ? g.slow + dt : 0;
    g.fast = g.avg < budget * 1.12 && g.work < budget * 0.7 ? g.fast + dt : 0;
    if (g.slow >= 2 && q.level < this.levels.length - 1) {
      // a step up that did not hold: wait longer before trying again
      if (t - g.lastUp < 10) g.upWait = Math.min(120, g.upWait * 2);
      this.setLevel(q.level + 1);
      g.lastDown = t;
      q.downs++;
    } else if (g.fast >= 6 && q.level > 0 && t - Math.max(g.lastUp, g.lastDown) >= g.upWait) {
      this.setLevel(q.level - 1);
      g.lastUp = t;
      q.ups++;
    }
  }

  private setLevel(level: number) {
    const L = this.levels[level];
    const q = this.quality;
    q.level = level;
    q.dpr = L.dpr;
    q.msaa = L.msaa;
    q.bloomHalf = L.half;
    this.gov.slow = this.gov.fast = 0;
    this.gov.avg = this.quality.budget;
    if (this.scenePass) this.scenePass.samples = L.msaa ? 4 : 0;
    this.bloomHalf = L.half;
    this.ctx.size.dpr = L.dpr;
    this.resize();
  }
}
