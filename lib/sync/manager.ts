"use client";

import { markDone, markFailed, nextBatch } from "@/lib/sync/queue";

export type SyncState = "synced" | "syncing" | "offline";

type Handler = (item: Awaited<ReturnType<typeof nextBatch>>[number]) => Promise<void>;

let running = false;
let handler: Handler | null = null;
const listeners = new Set<(s: SyncState) => void>();
let current: SyncState = typeof navigator !== "undefined" && navigator.onLine ? "synced" : "offline";

function emit(next: SyncState) {
  current = next;
  for (const l of listeners) l(next);
}

export function onSyncState(cb: (s: SyncState) => void) {
  listeners.add(cb);
  cb(current);
  return () => listeners.delete(cb);
}

export function registerSyncHandler(h: Handler) {
  handler = h;
}

export async function drain() {
  if (running || !handler) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emit("offline");
    return;
  }

  running = true;
  emit("syncing");
  try {
    let batch = await nextBatch();
    while (batch.length > 0) {
      for (const item of batch) {
        try {
          await handler(item);
          if (item.id !== undefined) await markDone(item.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (item.id !== undefined) await markFailed(item.id, msg);
        }
      }
      batch = await nextBatch();
    }
    emit("synced");
  } finally {
    running = false;
  }
}

export function startSyncLoop() {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => {
    emit("synced");
    void drain();
  };
  const onOffline = () => emit("offline");

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  void drain();

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}
