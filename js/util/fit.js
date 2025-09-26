const ORIENTATION_DELAY = 120;

function getBaseHeight(root) {
  const value = getComputedStyle(root).getPropertyValue('--baseH');
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 960;
}

export function setupFitToStage(stage, viewport = stage?.parentElement) {
  if (!stage) {
    return () => {};
  }

  const root = document.documentElement;

  const applyFit = () => {
    const baseHeight = getBaseHeight(root);
    const vv = window.visualViewport || { width: window.innerWidth, height: window.innerHeight };
    const width = vv.width;
    const height = vv.height;
    const baseWidth = baseHeight * (width / height);
    stage.style.width = `${baseWidth}px`;
    stage.style.height = `${baseHeight}px`;
    const scale = Math.min(width / baseWidth, height / baseHeight);
    stage.style.setProperty('--fit', `${scale}`);
  };

  let resizeTimer = null;

  const handleResize = () => {
    if (resizeTimer) {
      cancelAnimationFrame(resizeTimer);
    }
    resizeTimer = requestAnimationFrame(applyFit);
  };

  const handleOrientation = () => {
    setTimeout(applyFit, ORIENTATION_DELAY);
  };

  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleOrientation, { passive: true });

  const observer = viewport ? new ResizeObserver(() => applyFit()) : null;
  observer?.observe(viewport);

  if (document.fonts?.ready) {
    document.fonts.ready.then(applyFit).catch(applyFit);
  }

  applyFit();

  return () => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleOrientation);
    observer?.disconnect();
    if (resizeTimer) {
      cancelAnimationFrame(resizeTimer);
    }
  };
}
