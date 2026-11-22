/**
 * Without WebGL no chapter module is ever initialised, so the console would be dead markup.
 * This tiny entry (loaded from section.html) mounts it on its own clock in that case only. The console
 * itself is imported on demand, so it stays out of the entry chunk when WebGL is there.
 */
addEventListener('load', async () => {
  const el = document.getElementById('ask');
  if (!el || el.dataset.mounted !== undefined || !document.documentElement.classList.contains('no-gl')) return;
  el.dataset.mounted = '';
  const { mountConsole } = await import('./agent');
  const agent = mountConsole(el, { quick: false, go: (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) });
  let last = performance.now();
  const loop = (now: number) => {
    agent.tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
