"use client";

import Dexie, { type Table } from "dexie";

export interface LocalAttachment {
  blob: Blob;
  name: string;
  type: string;
  size: number;
}

export interface LocalMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: number;
  syncedAt: number | null;
  attachment?: LocalAttachment;
}

export interface LocalVoiceNote {
  id: string;
  conversationId: string;
  senderId: string;
  audioBlob: Blob;
  transcript: string | null;
  durationMs: number;
  createdAt: number;
  syncedAt: number | null;
  remoteUrl: string | null;
}

export interface LocalUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  avatarBlob?: Blob;
  lastSeenAt: number;
}

export type EntityType = "message" | "voice_note" | "user";
export type SyncOp = "create" | "update" | "delete";

export interface SyncQueueItem {
  id?: number;
  entityType: EntityType;
  entityId: string;
  op: SyncOp;
  payload: unknown;
  attempts: number;
  lastError: string | null;
  createdAt: number;
}

export interface LocalVector {
  id: string;
  kind: "message" | "transcript";
  vector: number[];
  createdAt: number;
}

class UcsDb extends Dexie {
  messages!: Table<LocalMessage, string>;
  voiceNotes!: Table<LocalVoiceNote, string>;
  users!: Table<LocalUser, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  vectors!: Table<LocalVector, string>;

  constructor() {
    super("ucs");
    this.version(1).stores({
      messages: "id, conversationId, senderId, createdAt, syncedAt",
      voiceNotes: "id, conversationId, senderId, createdAt, syncedAt",
      users: "id, email, lastSeenAt",
      syncQueue: "++id, entityType, entityId, createdAt",
      vectors: "id, kind, createdAt",
    });
  }
}

export const db = new UcsDb();
