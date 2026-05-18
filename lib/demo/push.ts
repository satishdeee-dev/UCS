"use client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export async function registerPushSubscription(phone: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!VAPID_PUBLIC_KEY) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "granted")
    return false;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("Push subscribe failed", err);
    return false;
  }
}

export interface SendPushOptions {
  to: string[];
  title: string;
  body: string;
  conversationId?: string;
  tag?: string;
}

/**
 * Fire-and-forget request to deliver Web Push notifications to a set of
 * recipients. Failures are logged but don't surface to the user — pushes
 * are a best-effort layer on top of Realtime delivery.
 */
export function sendPush(opts: SendPushOptions): void {
  if (typeof window === "undefined") return;
  if (!opts.to.length) return;
  void fetch("/api/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
    keepalive: true,
  }).catch((err) => {
    console.warn("Push send failed", err);
  });
}
