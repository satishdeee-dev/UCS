"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/client";

/**
 * Cross-device transport for CommApp.
 *
 * One Supabase Realtime broadcast channel ("commapp-bus") shared by every
 * device. Each device subscribes; senders address messages with `to: <phone>`
 * and receivers filter on their own phone. Identical messages also flow
 * across tabs of the same browser, but local persistence (Dexie) makes that
 * benign — receivers just `put` by id and the upsert is idempotent.
 */

const CHANNEL_NAME = "commapp-bus";
const EVENT_NAME = "commapp";

export interface WireAttachment {
  base64: string;
  name: string;
  type: string;
  size: number;
}

export interface WireLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface LocalMessageWire {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: number;
  syncedAt: number | null;
  attachment?: WireAttachment;
  location?: WireLocation;
}

export interface WireAvatar {
  base64: string;
  type: string;
}

export type BusEvent =
  | { kind: "message"; from: string; to: string; message: LocalMessageWire }
  | {
      kind: "call-offer";
      from: string;
      to: string;
      callId: string;
      mediaKind: "audio" | "video";
      sdp: string;
    }
  | {
      kind: "call-answer";
      from: string;
      to: string;
      callId: string;
      sdp: string;
    }
  | {
      kind: "ice-candidate";
      from: string;
      to: string;
      callId: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      kind: "call-end";
      from: string;
      to: string;
      callId: string;
      reason: "declined" | "ended" | "busy";
    }
  | { kind: "avatar"; from: string; avatar: WireAvatar | null }
  | { kind: "avatar-request"; from: string; to: string }
  | {
      kind: "group-created";
      from: string;
      group: {
        id: string;
        name: string;
        members: string[];
        createdBy: string;
        createdAt: number;
      };
    }
  | { kind: "group-request"; from: string; to: string; groupId: string }
  | {
      kind: "voice-note";
      from: string;
      to: string;
      voiceNote: WireVoiceNote;
    }
  | {
      kind: "voice-transcript";
      from: string;
      to: string;
      voiceNoteId: string;
      transcript: string;
    };

export interface WireVoiceNote {
  id: string;
  conversationId: string;
  senderId: string;
  base64: string;
  type: string;
  durationMs: number;
  transcript: string | null;
  createdAt: number;
}

type Handler = (event: BusEvent) => void;

let supabase: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
let setupPromise: Promise<void> | null = null;
const handlers = new Set<Handler>();

function getSupabase(): SupabaseClient {
  if (!supabase) supabase = createClient();
  return supabase;
}

function setup(): Promise<void> {
  if (setupPromise) return setupPromise;

  const client = getSupabase();
  channel = client.channel(CHANNEL_NAME, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: EVENT_NAME }, ({ payload }) => {
    const event = payload as BusEvent;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("transport handler error", err);
      }
    }
  });

  setupPromise = new Promise<void>((resolve, reject) => {
    channel!.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        resolve();
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        reject(new Error(`Realtime channel: ${status}`));
      }
    });
  });

  return setupPromise;
}

export function listen(handler: Handler): () => void {
  handlers.add(handler);
  void setup().catch((err) => {
    console.warn("Realtime transport unavailable:", err);
  });
  return () => handlers.delete(handler);
}

export async function emit(event: BusEvent): Promise<void> {
  try {
    await setup();
  } catch (err) {
    console.warn("Realtime emit skipped (not connected):", err);
    return;
  }
  if (!channel) return;
  const res = await channel.send({
    type: "broadcast",
    event: EVENT_NAME,
    payload: event,
  });
  if (res !== "ok") {
    console.warn("Realtime emit non-ok:", res);
  }
}
