import { clamp01, smooth } from '../../world/util';

/** Length of the road in world units. He walks it along +X. */
/** every table below is written in road units (the layout was drawn on a 72-unit road); K converts to world units */
export const K = 2 / 3;
export const L = 72 * K;
/** Chapter progress at which the walk starts / ends. Before: the title beat. After: the arrival. */
export const P0 = 0.065;
/** he reaches the end of the road here; the arrival beat and the rift exit follow */
export const P1 = 0.83;
/** Street lamps stand every LAMP_STEP units, the first at LAMP_0. Markers sit half-way between two. */
export const LAMP_STEP = 7 * K;
export const LAMP_0 = 0.5 * K;

export interface Place {
  id: 'nl' | 'bj' | 'sz' | 'sg';
  name: string;
  city: string;
  lon: number;
  lat: number;
  /** span of the road that belongs to this place */
  a: number;
  b: number;
}

export const PLACES: Place[] = [
  { id: 'nl', name: 'The Netherlands', city: 'Eindhoven', lon: 5.47, lat: 51.44, a: -12, b: 18 },
  { id: 'bj', name: 'Beijing', city: 'Beijing', lon: 116.4, lat: 39.9, a: 18, b: 32 },
  { id: 'sz', name: 'Shenzhen', city: 'Shenzhen', lon: 114.06, lat: 22.54, a: 32, b: 53 },
  { id: 'sg', name: 'Singapore', city: 'Singapore', lon: 103.82, lat: 1.35, a: 53, b: 84 },
];
for (const p of PLACES) {
  p.a *= K;
  p.b *= K;
}

export interface Stop {
  /** where the milestone marker stands on the road */
  x: number;
  /** the stretch of road during which this stop is "now" */
  a: number;
  b: number;
  from: number;
  to: number;
  place: number;
}

export const STOPS: Stop[] = [
  { x: 4, a: 0, b: 7.5, from: 2010, to: 2013, place: 0 },
  { x: 11, a: 7.5, b: 18, from: 2013, to: 2015, place: 0 },
  { x: 25, a: 18, b: 32, from: 2015, to: 2016, place: 1 },
  { x: 39, a: 32, b: 42.5, from: 2016, to: 2017, place: 2 },
  { x: 46, a: 42.5, b: 53, from: 2017, to: 2020, place: 2 },
  { x: 60, a: 53, b: 63.5, from: 2020, to: 2023, place: 3 },
  { x: 67, a: 63.5, b: 72, from: 2023, to: 2025, place: 3 },
];
for (const s of STOPS) {
  s.x *= K;
  s.a *= K;
  s.b *= K;
}

/** half-width of the hand-over between two places (mist, far layers cross-fade) */
export const BLEND = 3.2 * K;

/** trapezoid velocity profile: ease in over the first `e`, ease out over the last `e` */
const E = 0.06;
function ramp(t: number) {
  t = clamp01(t);
  const v = 1 / (1 - E);
  if (t < E) return (v * t * t) / (2 * E);
  if (t > 1 - E) {
    const r = 1 - t;
    return 1 - (v * r * r) / (2 * E);
  }
  return v * (t - E / 2);
}

/** road position for a chapter progress */
export function xOf(p: number) {
  return L * ramp((p - P0) / (P1 - P0));
}

/** chapter progress at which he stands at road position x (inverse of xOf) */
export function pOf(x: number) {
  const target = clamp01(x / L);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (ramp(m) < target) lo = m;
    else hi = m;
  }
  return P0 + ((lo + hi) / 2) * (P1 - P0);
}

/** the year the counter shows at road position x (continuous) */
export function yearOf(x: number) {
  if (x <= 0) return 2010;
  for (const s of STOPS) if (x < s.b) return s.from + ((x - s.a) / (s.b - s.a)) * (s.to - s.from);
  return 2025;
}

/** index of the stop that is "now" at x */
export function stopAt(x: number) {
  for (let i = 0; i < STOPS.length; i++) if (x < STOPS[i].b) return i;
  return STOPS.length - 1;
}

/** weight 0..1 of each place at x; neighbours cross-fade over 2 * BLEND. Writes into `out`. */
export function placeWeights(x: number, out: number[]) {
  for (let i = 0; i < PLACES.length; i++) {
    const pl = PLACES[i];
    const up = i === 0 ? 1 : smooth((x - (pl.a - BLEND)) / (2 * BLEND));
    const down = i === PLACES.length - 1 ? 1 : 1 - smooth((x - (pl.b - BLEND)) / (2 * BLEND));
    out[i] = Math.min(up, down);
  }
  return out;
}

/** 0 inside a place, 1 in the middle of a hand-over */
export function between(x: number) {
  let m = 0;
  for (let i = 1; i < PLACES.length; i++) m = Math.max(m, 1 - Math.min(1, Math.abs(x - PLACES[i].a) / (BLEND * 1.5)));
  return smooth(m);
}

/** position along the route on the map: 0 = first city … 3 = last; fractional while travelling */
export function routeAt(x: number) {
  let r = 0;
  for (let i = 1; i < PLACES.length; i++) r += smooth((x - (PLACES[i].a - BLEND)) / (2 * BLEND));
  return r;
}
