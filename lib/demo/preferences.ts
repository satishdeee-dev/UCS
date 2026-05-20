"use client";

import { useEffect, useState } from "react";

export interface Preferences {
  // Privacy
  showLastSeen: boolean;
  showReadReceipts: boolean;
  showOnlineStatus: boolean;
  showProfilePhoto: boolean;
  // Notifications
  messageNotifications: boolean;
  messageSound: boolean;
  showNotifPreview: boolean;
  callNotifications: boolean;
  callRingtone: boolean;
  // Chats
  enterToSend: boolean;
  fontSize: "small" | "medium" | "large";
  // Media auto-download
  autoDownloadImages: "always" | "wifi" | "never";
  autoDownloadDocs: "always" | "wifi" | "never";
}

export const DEFAULT_PREFERENCES: Preferences = {
  showLastSeen: true,
  showReadReceipts: true,
  showOnlineStatus: true,
  showProfilePhoto: true,
  messageNotifications: true,
  messageSound: true,
  showNotifPreview: true,
  callNotifications: true,
  callRingtone: true,
  enterToSend: true,
  fontSize: "medium",
  autoDownloadImages: "wifi",
  autoDownloadDocs: "wifi",
};

const KEY = "commapp.preferences";
const CHANGE_EVENT = "commapp-preferences-change";

export function readPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(stored) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(patch: Partial<Preferences>): Preferences {
  const next = { ...readPreferences(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  return next;
}

export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void] {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  useEffect(() => {
    setPrefs(readPreferences());
    const onChange = (e: Event) => {
      setPrefs((e as CustomEvent<Preferences>).detail);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);
  return [prefs, writePreferences];
}
