"use client";

import { db, type EntityType, type SyncOp } from "@/lib/db";

export async function enqueue(
  entityType: EntityType,
  entityId: string,
  op: SyncOp,
  payload: unknown,
): Promise<void> {
  await db.syncQueue.add({
    entityType,
    entityId,
    op,
    payload,
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  });
}

export async function pending(): Promise<number> {
  return db.syncQueue.count();
}

export async function nextBatch(limit = 25) {
  return db.syncQueue.orderBy("createdAt").limit(limit).toArray();
}

export async function markFailed(id: number, error: string): Promise<void> {
  const item = await db.syncQueue.get(id);
  if (!item) return;
  await db.syncQueue.update(id, {
    attempts: item.attempts + 1,
    lastError: error,
  });
}

export async function markDone(id: number): Promise<void> {
  await db.syncQueue.delete(id);
}
