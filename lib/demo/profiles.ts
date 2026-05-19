"use client";

import { blobToBase64 } from "./encoding";

export interface ProfileRow {
  phone: string;
  display_name: string | null;
  avatar_base64: string | null;
  avatar_mime: string | null;
  sign_in_count: number;
  first_seen_at: string;
  last_seen_at: string;
  device_count: number;
  days_active: number;
}

export interface ProfileStats {
  total: number;
  active_24h: number;
  active_7d: number;
  new_7d: number;
  with_photo: number;
  with_push: number;
  total_devices: number;
  total_sign_ins: number;
}

/**
 * Fire-and-forget upsert. Includes the avatar if one is provided; passing
 * `null` explicitly clears it server-side. Omit the field to leave it
 * untouched. Failures are logged but don't surface — profile sync is a
 * best-effort layer on top of the local-first Dexie model.
 */
export async function registerProfile(
  phone: string,
  avatar?: Blob | null,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const body: {
      phone: string;
      avatar?: { base64: string; mime: string } | null;
    } = { phone };
    if (avatar === null) {
      body.avatar = null;
    } else if (avatar instanceof Blob) {
      body.avatar = {
        base64: await blobToBase64(avatar),
        mime: avatar.type,
      };
    }
    await fetch("/api/profile/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch (err) {
    console.warn("registerProfile failed", err);
  }
}

/**
 * Admin-only: fetch every profile. Returns a 401 if the username/
 * password is wrong, 503 if the env vars aren't set on the server.
 */
export async function listProfiles(
  username: string,
  password: string,
): Promise<
  | {
      ok: true;
      profiles: ProfileRow[];
      stats: ProfileStats;
      admin: { username: string };
    }
  | { ok: false; status: number; error: string }
> {
  try {
    const res = await fetch("/api/profile/list", {
      method: "GET",
      headers: {
        "x-admin-username": username,
        "x-admin-password": password,
      },
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        msg = body.error ?? msg;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, error: msg };
    }
    const body = (await res.json()) as {
      profiles: ProfileRow[];
      stats: ProfileStats;
      admin: { username: string };
    };
    return {
      ok: true,
      profiles: body.profiles ?? [],
      stats: body.stats,
      admin: body.admin,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}
