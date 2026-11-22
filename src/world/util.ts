/** Small helpers shared by chapters. */

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
/** 0 before a, 1 after b, linear in between */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
/** 0 → 1 → 1 → 0 window: fades in over [a, a+fade], out over [b-fade, b] */
export const win = (p: number, a: number, b: number, fade = 0.04) => Math.min(smooth(seg(p, a, a + fade)), 1 - smooth(seg(p, b - fade, b)));
export const outExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(t)));
export const inOutCubic = (t: number) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
/** frame-rate independent easing factor: value += (target - value) * damp(rate, dt) */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

const last = new WeakMap<HTMLElement, Map<string, string>>();
/** set a style / CSS variable only when its value changed (safe to call every frame) */
export function css(el: HTMLElement | null, prop: string, value: string | number) {
  if (!el) return;
  let m = last.get(el);
  if (!m) last.set(el, (m = new Map()));
  const v = typeof value === 'number' ? value.toFixed(3) : value;
  if (m.get(prop) === v) return;
  m.set(prop, v);
  if (prop.startsWith('--')) el.style.setProperty(prop, v);
  else (el.style as unknown as Record<string, string>)[prop] = v;
}
/** opacity + visibility in one call; hides the element from pointer and AT when fully out */
export function show(el: HTMLElement | null, amount: number) {
  css(el, 'opacity', amount);
  css(el, 'visibility', amount < 0.01 ? 'hidden' : 'visible');
}
/** toggle a class only when it changes */
export function flag(el: HTMLElement | null, name: string, on: boolean) {
  if (el && el.classList.contains(name) !== on) el.classList.toggle(name, on);
}
