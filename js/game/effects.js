import { playClickSound } from '../util/sound.js';

const scoreAnimations = new WeakMap();

const getNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

function toNumber(value, fallback = 0) {
  const result = Number.parseFloat(value);
  return Number.isFinite(result) ? result : fallback;
}

export function playClickFeedback(element) {
  if (!(element instanceof HTMLElement)) {
    playClickSound();
    return;
  }

  playClickSound();

  const animation = element.animate(
    [
      { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: 'none' },
      {
        transform: 'scale(1.08)',
        filter: 'brightness(1.05)',
        boxShadow: '0 0 18px rgba(255, 222, 133, 0.55)',
      },
      { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: 'none' },
    ],
    { duration: 220, easing: 'ease-out' }
  );

  animation.addEventListener('finish', () => {
    if (element && element.isConnected) {
      element.style.filter = '';
    }
  });
}

export function animateFlyToScore(source, target) {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const clone = source.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    return;
  }
  clone.classList.add('flying-token');
  clone.removeAttribute('id');
  clone.style.position = 'fixed';
  clone.style.top = `${sourceRect.top}px`;
  clone.style.left = `${sourceRect.left}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.pointerEvents = 'none';
  clone.style.margin = '0';
  clone.style.zIndex = '9999';
  clone.style.opacity = '0.9';

  document.body.appendChild(clone);

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);

  const animation = clone.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 0.9 },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.35)`,
        opacity: 0,
        offset: 1,
      },
    ],
    { duration: 520, easing: 'cubic-bezier(0.32, 0.8, 0.36, 1)' }
  );

  const removeClone = () => {
    clone.remove();
  };

  animation.addEventListener('finish', removeClone, { once: true });
  animation.addEventListener('cancel', removeClone, { once: true });
}

export function animateScoreValue(element, value) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const target = Math.round(Number(value) || 0);
  const currentText = element.dataset.displayValue ?? element.textContent ?? '0';
  const current = Math.round(toNumber(currentText, 0));

  if (current === target) {
    element.dataset.displayValue = String(target);
    element.textContent = String(target);
    return;
  }

  const previous = scoreAnimations.get(element);
  if (previous?.raf) {
    cancelAnimationFrame(previous.raf);
  }

  const start = current;
  const delta = target - start;
  const duration = 520;
  const startTime = getNow();

  const state = {};

  const step = (timestamp) => {
    const elapsed = timestamp - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const valueNow = Math.round(start + delta * eased);
    element.textContent = String(valueNow);
    element.dataset.displayValue = String(valueNow);
    if (progress < 1) {
      state.raf = requestAnimationFrame(step);
    } else {
      scoreAnimations.delete(element);
    }
  };

  state.raf = requestAnimationFrame(step);
  scoreAnimations.set(element, state);
}

export function applyTimerVisual(timerElement, timeLeft) {
  if (!(timerElement instanceof HTMLElement)) {
    return;
  }
  const seconds = Math.max(0, Math.ceil(Number(timeLeft) || 0));
  timerElement.textContent = `${seconds} s`;

  let state = 'normal';
  if (seconds <= 5) {
    state = 'critical';
  } else if (seconds <= 10) {
    state = 'warning';
  }

  timerElement.dataset.state = state;
  if (state === 'critical') {
    timerElement.classList.add('is-pulsing');
  } else {
    timerElement.classList.remove('is-pulsing');
  }
}

export function applyScoreVisual(scoreElement, scoreValue) {
  if (!(scoreElement instanceof HTMLElement)) {
    return;
  }
  const score = Math.round(Number(scoreValue) || 0);
  const tone = score >= 0 ? 'positive' : 'negative';
  scoreElement.dataset.tone = tone;
}

export function highlightPays(cardElement) {
  if (!(cardElement instanceof HTMLElement)) {
    return;
  }
  cardElement.classList.add('is-highlight');
  const handleEnd = () => {
    cardElement.classList.remove('is-highlight');
    cardElement.removeEventListener('animationend', handleEnd);
  };
  cardElement.addEventListener('animationend', handleEnd);
}

export function flyScoreLabel({ source, target, text, tone = 'positive', duration = 720 }) {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const label = document.createElement('div');
  label.className = 'flying-score-label';
  label.dataset.tone = tone;
  label.textContent = text;
  label.style.position = 'fixed';
  label.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
  label.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
  label.style.transform = 'translate(-50%, -50%)';
  label.style.pointerEvents = 'none';
  document.body.appendChild(label);

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);

  const animation = label.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      {
        transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0.6)`,
        opacity: 0,
      },
    ],
    { duration, easing: 'cubic-bezier(0.24, 0.74, 0.44, 0.98)' }
  );

  const cleanup = () => {
    label.remove();
  };

  animation.addEventListener('finish', cleanup, { once: true });
  animation.addEventListener('cancel', cleanup, { once: true });
}

function applyFeedbackClass(element, className) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  element.classList.add(className);
  const handleEnd = () => {
    element.classList.remove(className);
    element.removeEventListener('animationend', handleEnd);
  };
  element.addEventListener('animationend', handleEnd);
}

export function applyCorrectFeedback(element) {
  applyFeedbackClass(element, 'is-correct');
}

export function applyErrorFeedback(element) {
  applyFeedbackClass(element, 'is-error');
}
