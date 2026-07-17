'use client';

/**
 * Notification sounds via WebAudio — no audio files needed.
 * Browsers require a user gesture before audio can play; we resume the
 * context on the first click/tap automatically.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const resume = () => { ctx?.resume(); };
    window.addEventListener('click', resume, { once: true });
    window.addEventListener('touchstart', resume, { once: true });
  }
  return ctx;
}

function tone(freq: number, startAt: number, duration: number, volume = 0.35) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime + startAt);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startAt + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + startAt);
  osc.stop(c.currentTime + startAt + duration + 0.05);
}

/** New order arrived (kitchen/bar screens): two-tone ding-dong, played twice. */
export function playNewOrderSound() {
  const c = getCtx();
  if (!c) return;
  c.resume();
  tone(880, 0, 0.25);
  tone(660, 0.28, 0.35);
  tone(880, 0.9, 0.25);
  tone(660, 1.18, 0.35);
}

/** Order fully ready (desk/manager): rising triple chime. */
export function playOrderReadySound() {
  const c = getCtx();
  if (!c) return;
  c.resume();
  tone(660, 0, 0.18);
  tone(830, 0.2, 0.18);
  tone(990, 0.4, 0.45);
}
