let audioContext = null;

function getContext() {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return null;
  }
  if (!audioContext) {
    try {
      audioContext = new window.AudioContext();
    } catch (error) {
      audioContext = null;
    }
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

export function playClickSound() {
  const ctx = getContext();
  if (!ctx) {
    return;
  }
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(920, now);
  oscillator.frequency.exponentialRampToValueAtTime(640, now + 0.14);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.22);

  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    gain.disconnect();
  });
}
