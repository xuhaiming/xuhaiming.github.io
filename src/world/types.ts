import type * as THREE from 'three';
import type { Hero } from './Hero';

/** 0 = phone / coarse pointer, 1 = mid laptop, 2 = full desktop. Scale counts and effects by it. */
export type Tier = 0 | 1 | 2;

export interface Pointer {
  /** eased, normalised device coords: -1..1, y up */
  x: number;
  y: number;
  /** raw (un-eased) NDC */
  rx: number;
  ry: number;
  /** client pixels */
  px: number;
  py: number;
  down: boolean;
  /** false until the pointer has moved at least once (and always false on touch until a touch) */
  seen: boolean;
}

export interface Post {
  /** bloom strength, default 0.55 */
  bloom: number;
  /** bloom threshold, default 0.82 */
  threshold: number;
  /** vignette amount 0..1, default 0.45 */
  vignette: number;
  /** film grain 0..1, default 0.5 */
  grain: number;
  /** tone-mapping exposure, default 1 */
  exposure: number;
}

/** Shared services. One instance for the whole page; chapters receive it in init() and update(). */
export interface Ctx {
  renderer: THREE.WebGLRenderer;
  /** the single shared scene. Add things to your chapter's `group`, never directly here. */
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hero: Hero;
  tier: Tier;
  /** prefers-reduced-motion: keep the scene but avoid large automatic motion */
  still: boolean;
  /** capture mode (?shot): skip intros, type instantly */
  shot: boolean;
  pointer: Pointer;
  size: { w: number; h: number; narrow: boolean; dpr: number };
  post: Post;
  /** background colour of the frame; reset to black before every update() */
  bg: THREE.Color;
  /** scene fog; reset to none (density 0) before every update() */
  fog: THREE.FogExp2;
  /** world position -> CSS pixels in the viewport; z > 1 or < -1 means off-frustum */
  project(v: THREE.Vector3, out?: { x: number; y: number; z: number }): { x: number; y: number; z: number };
  /** a raycaster set from the pointer and the current camera; raw = un-eased position (use for taps) */
  ray(raw?: boolean): THREE.Raycaster;
  /** smooth-scroll to a chapter (or '#id'), optionally to a progress 0..1 inside it */
  goTo(id: string, p?: number): void;
  /** cached loaders. Paths are site-absolute, e.g. '/assets/range/foo.webp' */
  tex(url: string, opts?: { srgb?: boolean; repeat?: boolean; flipY?: boolean }): Promise<THREE.Texture>;
  video(url: string, opts?: { loop?: boolean; poster?: string }): Promise<{ el: HTMLVideoElement; tex: THREE.VideoTexture }>;
  glb(url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>;
}

export interface Frame {
  /** progress through the chapter, 0..1, clamped, excluding the hand-over windows */
  p: number;
  /** presence: 0 at the chapter boundary, 1 once fully in. Use it to bring your world in and out. */
  io: number;
  /** -1 while entering from the top boundary, +1 while leaving at the bottom, 0 when fully in */
  side: -1 | 0 | 1;
  /** seconds since page start */
  t: number;
  /** seconds since the last frame, clamped to 0.1 */
  dt: number;
  /** scroll velocity in chapter-progress units per second (signed) */
  vel: number;
}

export interface Chapter {
  /** must equal the folder name and the id of the <section> in section.html */
  id: string;
  /** everything this chapter draws. The director toggles its visibility. */
  group: THREE.Group;
  /** build the world. `el` is the chapter's <section>. May be async (load assets here). */
  init(ctx: Ctx, el: HTMLElement): void | Promise<void>;
  /** called every frame while this chapter is on screen. Set camera, hero, bg, post here. */
  update(f: Frame, ctx: Ctx): void;
  /** called once when the chapter becomes the active one / stops being it */
  enter?(ctx: Ctx): void;
  leave?(ctx: Ctx): void;
  resize?(ctx: Ctx): void;
}

export type ChapterModule = { default: Chapter };
