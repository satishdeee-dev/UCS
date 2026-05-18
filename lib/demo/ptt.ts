"use client";

/**
 * Auto-play helper for push-to-talk voice notes. Browsers block audio
 * autoplay unless the page has had recent user interaction; in practice
 * once the user has tapped any button on the page (login, send, etc.),
 * autoplay works. We fail silently if blocked.
 */
export function autoPlayVoiceNote(blob: Blob): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener("ended", () => URL.revokeObjectURL(url), {
    once: true,
  });
  audio.addEventListener(
    "error",
    () => URL.revokeObjectURL(url),
    { once: true },
  );
  audio.play().catch((err) => {
    console.warn("PTT auto-play blocked", err);
    URL.revokeObjectURL(url);
  });
}

/**
 * Treat a freshly-received voice note as "live" if it was recorded
 * within this many milliseconds — i.e., recently enough that the user
 * likely wants to hear it immediately as a walkie-talkie burst rather
 * than as a stored voice message.
 */
export const PTT_AUTOPLAY_WINDOW_MS = 15_000;
