"use client";

/**
 * Browser notifications + Web Audio tones for incoming messages and calls.
 *
 * Limits:
 *  - These rely on the tab being open (foreground OR background). When the
 *    tab is closed completely, the page can't run; true "app closed"
 *    notifications need Web Push (service worker + VAPID + a push server),
 *    which is out of scope for the demo.
 *  - On iOS Safari, Notifications work only when the page is installed as
 *    a PWA (Add to Home Screen) and require iOS 16.4+.
 */

let audioCtx: AudioContext | null = null;
let ringtoneTimer: ReturnType<typeof setInterval> | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

interface NotifyOptions {
  body?: string;
  tag?: string;
  /** When true, fire even if the tab is focused. Default: only when hidden. */
  whenFocused?: boolean;
  onClick?: () => void;
}

export function notify(title: string, opts: NotifyOptions = {}): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (!opts.whenFocused && typeof document !== "undefined") {
    if (!document.hidden && document.hasFocus()) return;
  }
  try {
    const n = new Notification(title, {
      body: opts.body,
      tag: opts.tag,
      icon: "/icon.svg",
    });
    if (opts.onClick) {
      n.onclick = () => {
        window.focus();
        opts.onClick?.();
        n.close();
      };
    }
  } catch {
    /* ignore */
  }
}

function tone(freq: number, durationSec: number, gain = 0.3, delay = 0): void {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.type = "sine";
    o.frequency.value = freq;
    const start = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);
    o.start(start);
    o.stop(start + durationSec + 0.05);
  } catch {
    /* AudioContext blocked by autoplay policy until user gesture */
  }
}

export function playMessageTone(): void {
  // Short two-note chime.
  tone(880, 0.18, 0.22, 0);
  tone(1175, 0.22, 0.2, 0.12);
}

export function startRingtone(): void {
  stopRingtone();
  const beep = () => {
    // E5 then C5 — simple two-tone ring pattern.
    tone(659, 0.25, 0.3, 0);
    tone(523, 0.25, 0.3, 0.32);
  };
  beep();
  ringtoneTimer = setInterval(beep, 1600);
}

export function stopRingtone(): void {
  if (ringtoneTimer) {
    clearInterval(ringtoneTimer);
    ringtoneTimer = null;
  }
}
