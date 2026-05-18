"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export type WallpaperId = "default" | "plain" | "warm" | "cool" | "doodle";

export interface WallpaperPreset {
  id: WallpaperId;
  label: string;
  bgColor?: string;
  bgImage?: string;
  bgSize?: string;
  /** CSS background shorthand for a small swatch preview. */
  thumb: string;
}

export const WALLPAPERS: WallpaperPreset[] = [
  {
    id: "default",
    label: "Default",
    bgImage:
      "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.10) 1px, transparent 0)",
    bgSize: "22px 22px",
    thumb:
      "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.45) 1px, transparent 0) 0 0 / 8px 8px white",
  },
  {
    id: "plain",
    label: "Plain",
    bgColor: "white",
    thumb: "white",
  },
  {
    id: "warm",
    label: "Warm",
    bgColor: "#fffbeb",
    bgImage:
      "radial-gradient(circle at 1px 1px, rgba(245,158,11,0.15) 1px, transparent 0)",
    bgSize: "22px 22px",
    thumb:
      "radial-gradient(circle at 1px 1px, rgba(245,158,11,0.55) 1px, transparent 0) 0 0 / 8px 8px #fffbeb",
  },
  {
    id: "cool",
    label: "Cool",
    bgColor: "#ecfeff",
    bgImage:
      "radial-gradient(circle at 1px 1px, rgba(20,184,166,0.18) 1px, transparent 0)",
    bgSize: "22px 22px",
    thumb:
      "radial-gradient(circle at 1px 1px, rgba(20,184,166,0.6) 1px, transparent 0) 0 0 / 8px 8px #ecfeff",
  },
  {
    id: "doodle",
    label: "Doodle",
    bgColor: "#fafafa",
    bgImage:
      "repeating-linear-gradient(45deg, rgba(99,102,241,0.08) 0 2px, transparent 2px 14px)",
    bgSize: "20px 20px",
    thumb:
      "repeating-linear-gradient(45deg, rgba(99,102,241,0.45) 0 1.5px, transparent 1.5px 8px) #fafafa",
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
    backgroundColor: preset.bgColor,
    backgroundImage: preset.bgImage,
    backgroundSize: preset.bgSize,
  };
}
