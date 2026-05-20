"use client";

import Dexie, { type Table } from "dexie";

export interface LocalAttachment {
  blob: Blob;
  name: string;
  type: string;
  size: number;
}

export interface LocalLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface LocalMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: number;
  syncedAt: number | null;
  /** Recipients other than the sender. Set at send time so the bubble
   *  can compute "delivered to N/N" without needing group context. */
  recipients?: string[];
  /** Phone numbers of recipients who have ack'd receipt. */
  deliveredBy?: string[];
  /** Phone numbers of recipients who have opened the chat. */
  readBy?: string[];
  /** Legacy 1:1 timestamps — kept for backward compat with rows
   *  written before the array model. */
  deliveredAt?: number;
  readAt?: number;
  starred?: boolean;
  attachment?: LocalAttachment;
  location?: LocalLocation;
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

export interface LocalGroup {
  id: string;        // "group:<uuid>"
  name: string;
  members: string[]; // phone numbers (always includes the creator)
  createdBy: string;
  createdAt: number;
}

export function isGroupId(id: string): boolean {
  return id.startsWith("group:");
}

export interface LocalCallRecord {
  id?: number;
  peer: string;
  mediaKind: "audio" | "video";
  direction: "outgoing" | "incoming";
  startedAt: number;
  endedAt: number;
  connected: boolean;
}

class UcsDb extends Dexie {
  messages!: Table<LocalMessage, string>;
  voiceNotes!: Table<LocalVoiceNote, string>;
  users!: Table<LocalUser, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  vectors!: Table<LocalVector, string>;
  groups!: Table<LocalGroup, string>;
  callHistory!: Table<LocalCallRecord, number>;

  constructor() {
    super("ucs");
    this.version(1).stores({
      messages: "id, conversationId, senderId, createdAt, syncedAt",
      voiceNotes: "id, conversationId, senderId, createdAt, syncedAt",
      users: "id, email, lastSeenAt",
      syncQueue: "++id, entityType, entityId, createdAt",
      vectors: "id, kind, createdAt",
    });
    this.version(2).stores({
      groups: "id, createdAt",
    });
    this.version(3).stores({
      callHistory: "++id, peer, startedAt",
    });
  }
}

export const db = new UcsDb();
