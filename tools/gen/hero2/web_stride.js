// Stage 4 helper: paste into the dev console at http://localhost:5173 (any chapter, hero loaded). It stops the render loop,
// plays the walk clip against a moving root for a few candidate strides and prints the planted-foot slide per metre:
// the smallest value is the stride to put in WALK (src/world/Hero.ts). Reload the page afterwards.
(async () => {
  const w = window.__world, h = w.hero;
  w.stop();
  const V = h.root.position.constructor;
  const L = new V(), R = new V();
  const dur = h.walkAct.getClip().duration;
  for (const a of h.acts) a.action.setEffectiveWeight(a.name === 'walk' ? 1 : 0);
  h.root.rotation.set(0, 0, 0); h.root.scale.setScalar(1);
  const out = {};
  for (const stride of (window.__strides ?? [1.15, 1.2, 1.2461, 1.3, 1.35])) {
    const lap = stride * 2; const N = 400; let slide = 0, n = 0; let prev = null; let minY = 9, lift = 0;
    for (let i = 0; i <= N; i++) {
      const d = lap * i / N;
      h.root.position.set(0, 0, d);
      h.walkAct.time = (d / lap % 1) * dur;
      h.mixer.update(0);
      h.root.updateWorldMatrix(true, true);
      h.bone('LeftToeBase', L); h.bone('RightToeBase', R);
      const cur = [L.z, L.y, R.z, R.y];
      if (prev) {
        const la = prev[1] < prev[3], lb = cur[1] < cur[3];
        // only while a foot is clearly the planted one
        if (la === lb && Math.abs(cur[1] - cur[3]) > 0.02) { slide += Math.abs(la ? cur[0] - prev[0] : cur[2] - prev[2]); n++; }
      }
      prev = cur;
    }
    out[stride] = +(slide / (n * lap / N)).toFixed(3);
  }
  return { duration: dur, slidePerMetreByStride: out };
})()
