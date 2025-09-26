(() => {
  const stage = document.getElementById('stage');
  if (!stage) return;

  const root = document.documentElement;
  const viewport = window.visualViewport;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const measure = () => {
    const vv = viewport || { width: window.innerWidth, height: window.innerHeight };
    const height = clamp(vv.height, 540, 820);
    const width = height * (16 / 9);
    const scale = Math.min(vv.width / width, vv.height / height);

    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    stage.style.setProperty('--fit', `${scale}`);
    root.style.setProperty('--baseH', `${height}px`);
    raf = null;
  };

  let raf = null;
  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(measure);
  };

  if (viewport) {
    viewport.addEventListener('resize', schedule, { passive: true });
    viewport.addEventListener('scroll', schedule, { passive: true });
  }

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(measure, 120), { passive: true });

  if (document.fonts?.ready) {
    document.fonts.ready.then(measure).catch(measure);
  }

  measure();
})();
