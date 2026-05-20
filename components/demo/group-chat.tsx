"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, type LocalLocation, type LocalMessage, type LocalVoiceNote } from "@/lib/db";
import { blobToBase64 } from "@/lib/demo/encoding";
import { readPreferences } from "@/lib/demo/preferences";
import { sendPush } from "@/lib/demo/push";
import { emit } from "@/lib/demo/transport";
import { transcribe, warmTranscriber } from "@/lib/ai/transcribe";
import { getWallpaperStyle, useWallpaper } from "@/lib/demo/wallpapers";
import { Avatar } from "./avatar";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";

interface Props {
  self: string;
  groupId: string;
  onBack: () => void;
  onOpenProfile: () => void;
}

type Item =
  | { kind: "text"; data: LocalMessage }
  | { kind: "voice"; data: LocalVoiceNote };

export function GroupChat({ self, groupId, onBack, onOpenProfile }: Props) {
  const group = useLiveQuery(() => db.groups.get(groupId), [groupId]);

  const items = useLiveQuery<Item[]>(async () => {
    const [msgs, vns] = await Promise.all([
      db.messages.where("conversationId").equals(groupId).toArray(),
      db.voiceNotes.where("conversationId").equals(groupId).toArray(),
    ]);
    const merged: Item[] = [
      ...msgs.map<Item>((m) => ({ kind: "text", data: m })),
      ...vns.map<Item>((v) => ({ kind: "voice", data: v })),
    ];
    merged.sort((a, b) => a.data.createdAt - b.data.createdAt);
    return merged;
  }, [groupId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [items?.length]);

  useEffect(() => {
    void warmTranscriber().catch(() => {});
  }, []);

  // Read receipts: emit message-read for every inbound message we
  // haven't yet acked-read this session. Fans out to every group
  // member except self so each member's bubble can update its own
  // readBy[] tally.
  const readAckedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!items) return;
    if (!group) return;
    if (!readPreferences().showReadReceipts) return;
    const now = Date.now();
    const others = group.members.filter((m) => m !== self);
    for (const item of items) {
      if (item.kind !== "text") continue;
      if (item.data.senderId === self) continue;
      if (readAckedRef.current.has(item.data.id)) continue;
      readAckedRef.current.add(item.data.id);
      for (const to of others) {
        void emit({
          kind: "message-read",
          from: self,
          to,
          messageId: item.data.id,
          readAt: now,
        });
      }
    }
  }, [items, group, self]);

  const recipients = useMemo(
    () => (group?.members ?? []).filter((m) => m !== self),
    [group, self],
  );

  async function toggleStar(messageId: string) {
    const m = await db.messages.get(messageId);
    if (!m) return;
    await db.messages.update(messageId, { starred: !m.starred });
  }

  async function sendText(body: string) {
    const message: LocalMessage = {
      id: crypto.randomUUID(),
      conversationId: groupId,
      senderId: self,
      recipients,
      deliveredBy: [],
      readBy: [],
      body,
      createdAt: Date.now(),
      syncedAt: null,
    };
    await db.messages.add(message);
    for (const to of recipients) {
      void emit({
        kind: "message",
        from: self,
        to,
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt,
          syncedAt: message.syncedAt,
        },
      });
    }
    sendPush({
      to: recipients,
      title: `${group?.name ?? "Group"} — ${self}`,
      body,
      conversationId: groupId,
      tag: groupId,
    });
  }

  async function sendLocation(location: LocalLocation) {
    const message: LocalMessage = {
      id: crypto.randomUUID(),
      conversationId: groupId,
      senderId: self,
      recipients,
      deliveredBy: [],
      readBy: [],
      body: "",
      createdAt: Date.now(),
      syncedAt: null,
      location,
    };
    await db.messages.add(message);
    for (const to of recipients) {
      void emit({
        kind: "message",
        from: self,
        to,
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt,
          syncedAt: message.syncedAt,
          location,
        },
      });
    }
    sendPush({
      to: recipients,
      title: `${group?.name ?? "Group"} — ${self}`,
      body: "📍 Location",
      conversationId: groupId,
      tag: groupId,
    });
  }

  async function sendAttachment(file: File) {
    const message: LocalMessage = {
      id: crypto.randomUUID(),
      conversationId: groupId,
      senderId: self,
      recipients,
      deliveredBy: [],
      readBy: [],
      body: "",
      createdAt: Date.now(),
      syncedAt: null,
      attachment: {
        blob: file,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      },
    };
    await db.messages.add(message);
    const base64 = await blobToBase64(file);
    for (const to of recipients) {
      void emit({
        kind: "message",
        from: self,
        to,
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt,
          syncedAt: message.syncedAt,
          attachment: {
            base64,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
          },
        },
      });
    }
    sendPush({
      to: recipients,
      title: `${group?.name ?? "Group"} — ${self}`,
      body: file.type.startsWith("image/") ? "📷 Photo" : `📎 ${file.name}`,
      conversationId: groupId,
      tag: groupId,
    });
  }

  async function sendVoice(blob: Blob, durationMs: number) {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await db.voiceNotes.add({
      id,
      conversationId: groupId,
      senderId: self,
      audioBlob: blob,
      transcript: null,
      durationMs,
      createdAt,
      syncedAt: null,
      remoteUrl: null,
    });

    // Broadcast to all members. Opus at 24kbps keeps clips tiny
    // (~3 KB/sec → ~30 KB for a typical 10s clip, fan-out safe).
    const base64 = await blobToBase64(blob);
    for (const to of recipients) {
      void emit({
        kind: "voice-note",
        from: self,
        to,
        voiceNote: {
          id,
          conversationId: groupId,
          senderId: self,
          base64,
          type: blob.type,
          durationMs,
          transcript: null,
          createdAt,
        },
      });
    }
    sendPush({
      to: recipients,
      title: `${group?.name ?? "Group"} — ${self}`,
      body: "🎤 Voice note",
      conversationId: groupId,
      tag: groupId,
    });

    try {
      const text = await transcribe(blob);
      await db.voiceNotes.update(id, { transcript: text });
      for (const to of recipients) {
        void emit({
          kind: "voice-transcript",
          from: self,
          to,
          voiceNoteId: id,
          transcript: text,
        });
      }
    } catch (err) {
      console.error("Transcription failed", err);
      await db.voiceNotes.update(id, { transcript: "" });
    }
  }

  const wallpaperId = useWallpaper(groupId);

  return (
    <main className="flex h-full min-h-svh w-full flex-1 flex-col bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back"
          className="md:hidden"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200">
            <Users className="size-4" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">
              {group?.name ?? "Group"}
            </span>
            <span className="truncate text-[10px] text-zinc-500">
              {group ? `${group.members.length} members · tap for info` : ""}
            </span>
          </div>
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4"
        style={getWallpaperStyle(wallpaperId)}
      >
        {items && items.length === 0 && (
          <p className="my-auto text-center text-sm text-zinc-500">
            No messages yet. Be the first to say hi.
          </p>
        )}
        {items?.map((item) => {
          const outgoing = item.data.senderId === self;
          const senderLabel =
            !outgoing && item.data.senderId !== self
              ? item.data.senderId
              : null;
          return (
            <div key={`${item.kind}-${item.data.id}`} className="flex flex-col gap-0.5">
              {senderLabel && (
                <div className="flex items-center gap-2 px-2">
                  <Avatar phone={senderLabel} size={18} />
                  <span className="font-mono text-[10px] text-zinc-500">
                    {senderLabel}
                  </span>
                </div>
              )}
              {item.kind === "text" ? (
                <MessageBubble
                  kind="text"
                  body={item.data.body}
                  attachment={item.data.attachment}
                  location={item.data.location}
                  createdAt={item.data.createdAt}
                  outgoing={outgoing}
                  starred={item.data.starred}
                  onToggleStar={() => toggleStar(item.data.id)}
                  recipients={item.data.recipients}
                  deliveredBy={item.data.deliveredBy}
                  readBy={item.data.readBy}
                  deliveredAt={item.data.deliveredAt}
                  readAt={item.data.readAt}
                />
              ) : (
                <MessageBubble
                  kind="voice"
                  audioBlob={item.data.audioBlob}
                  transcript={item.data.transcript}
                  createdAt={item.data.createdAt}
                  outgoing={outgoing}
                />
              )}
            </div>
          );
        })}
      </div>

      <Composer
        onSendText={sendText}
        onSendVoice={sendVoice}
        onSendAttachment={sendAttachment}
        onSendLocation={sendLocation}
      />
    </main>
  );
}
