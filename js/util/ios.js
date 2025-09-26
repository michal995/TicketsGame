const DOUBLE_TAP_DELAY = 350;

export function preventIOSZoom() {
  let lastTouch = 0;

  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      if (now - lastTouch <= DOUBLE_TAP_DELAY) {
        event.preventDefault();
      }
      lastTouch = now;
    },
    { passive: false }
  );

  document.addEventListener(
    'gesturestart',
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );
}
