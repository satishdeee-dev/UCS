"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export type WallpaperId = "default" | "plain" | "warm" | "cool" | "doodle";

export interface WallpaperPreset {
  id: WallpaperId;
  label: string;
  /** CSS bg-image overlay rendered on top of the app's --background. */
  bgImage?: string;
  bgSize?: string;
  /** CSS background shorthand for the picker swatch preview. */
  thumb: string;
}

// Wallpapers are now translucent overlays — no solid bgColor — so they
// read correctly over both light and dark theme backgrounds. The picker
// swatches still show their accent color so the user can tell them apart.

export const WALLPAPERS: WallpaperPreset[] = [
  {
    id: "default",
    label: "Default",
    bgImage:
      "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.18) 1px, transparent 0)",
    bgSize: "22px 22px",
    thumb:
      "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.55) 1px, transparent 0) 0 0 / 8px 8px #1c1b2e",
  },
  {
    id: "plain",
    label: "Plain",
    thumb: "#0f0f1a",
  },
  {
    id: "warm",
    label: "Warm",
    bgImage:
      "radial-gradient(circle at 1px 1px, rgba(245,158,11,0.22) 1px, transparent 0)",
    bgSize: "22px 22px",
    thumb:
      "radial-gradient(circle at 1px 1px, rgba(245,158,11,0.7) 1px, transparent 0) 0 0 / 8px 8px #2a1f10",
  },
  {
    id: "cool",
    label: "Cool",
    bgImage:
      "radial-gradient(circle at 1px 1px, rgba(20,184,166,0.22) 1px, transparent 0)",
    bgSize: "22px 22px",
    thumb:
      "radial-gradient(circle at 1px 1px, rgba(20,184,166,0.7) 1px, transparent 0) 0 0 / 8px 8px #0f2a26",
  },
  {
    id: "doodle",
    label: "Doodle",
    bgImage:
      "repeating-linear-gradient(45deg, rgba(99,102,241,0.14) 0 2px, transparent 2px 14px)",
    bgSize: "20px 20px",
    thumb:
      "repeating-linear-gradient(45deg, rgba(99,102,241,0.55) 0 1.5px, transparent 1.5px 8px) #1c1b2e",
  },
];

const KEY_PREFIX = "commapp.wallpaper.";
const CHANGE_EVENT = "commapp-wallpaper-change";

export function readWallpaper(conversationId: string): WallpaperId {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(KEY_PREFIX + conversationId);
  if (stored && WALLPAPERS.some((p) => p.id === stored)) {
    return stored as WallpaperId;
  }
  return "default";
}

export function writeWallpaper(conversationId: string, id: WallpaperId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_PREFIX + conversationId, id);
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, { detail: { conversationId, id } }),
  );
}

export function useWallpaper(conversationId: string): WallpaperId {
  const [w, setW] = useState<WallpaperId>("default");
  useEffect(() => {
    setW(readWallpaper(conversationId));
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ conversationId: string; id: WallpaperId }>;
      if (ce.detail.conversationId === conversationId) setW(ce.detail.id);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [conversationId]);
  return w;
}

export function getWallpaperStyle(id: WallpaperId): CSSProperties {
  const preset = WALLPAPERS.find((p) => p.id === id) ?? WALLPAPERS[0];
  return {
    backgroundImage: preset.bgImage,
    backgroundSize: preset.bgSize,
  };
}
