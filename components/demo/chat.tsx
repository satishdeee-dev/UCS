"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, type LocalMessage, type LocalVoiceNote } from "@/lib/db";
import { conversationIdFor } from "@/lib/demo/conversations";
import { transcribe, warmTranscriber } from "@/lib/ai/transcribe";
import { blobToBase64 } from "@/lib/demo/encoding";
import { emit } from "@/lib/demo/transport";
import { getWallpaperStyle, useWallpaper } from "@/lib/demo/wallpapers";
import { Avatar } from "./avatar";
import { useCall } from "./call-provider";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";

interface Props {
  self: string;
  peer: string;
  onBack: () => void;
  onOpenProfile: () => void;
}

type Item =
  | { kind: "text"; data: LocalMessage }
  | { kind: "voice"; data: LocalVoiceNote };

export function Chat({ self, peer, onBack, onOpenProfile }: Props) {
  const conversationId = useMemo(
    () => conversationIdFor(self, peer),
    [self, peer],
  );

  const items = useLiveQuery<Item[]>(async () => {
    const [msgs, vns] = await Promise.all([
      db.messages.where("conversationId").equals(conversationId).toArray(),
      db.voiceNotes.where("conversationId").equals(conversationId).toArray(),
    ]);
    const merged: Item[] = [
      ...msgs.map<Item>((m) => ({ kind: "text", data: m })),
      ...vns.map<Item>((v) => ({ kind: "voice", data: v })),
    ];
    merged.sort((a, b) => a.data.createdAt - b.data.createdAt);
    return merged;
  }, [conversationId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [items?.length]);

  // Warm up the transcription model in the background so voice notes
  // get transcribed promptly.
  useEffect(() => {
    void warmTranscriber().catch(() => {});
  }, []);

  async function sendText(body: string) {
    const message: LocalMessage = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: self,
      body,
      createdAt: Date.now(),
      syncedAt: null,
    };
    await db.messages.add(message);
    void emit({
      kind: "message",
      from: self,
      to: peer,
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

  async function sendAttachment(file: File) {
    const message: LocalMessage = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: self,
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
    void emit({
      kind: "message",
      from: self,
      to: peer,
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

  async function sendVoice(blob: Blob, durationMs: number) {
    const id = crypto.randomUUID();
    await db.voiceNotes.add({
      id,
      conversationId,
      senderId: self,
      audioBlob: blob,
      transcript: null,
      durationMs,
      createdAt: Date.now(),
      syncedAt: null,
      remoteUrl: null,
    });

    try {
      const text = await transcribe(blob);
      await db.voiceNotes.update(id, { transcript: text });
    } catch (err) {
      console.error("Transcription failed", err);
      await db.voiceNotes.update(id, { transcript: "" });
    }
  }

  const { call, state: callState } = useCall();
  const callInFlight = callState.phase !== "idle";
  const wallpaperId = useWallpaper(conversationId);

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
          <Avatar phone={peer} size={36} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-mono text-sm">{peer}</span>
            <span className="text-[10px] text-zinc-500">tap for info</span>
          </div>
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => call(peer, "video")}
          disabled={callInFlight}
          aria-label="Video call"
        >
          <Video className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => call(peer, "audio")}
          disabled={callInFlight}
          aria-label="Voice call"
        >
          <Phone className="size-4" />
        </Button>
      </header>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4"
        style={getWallpaperStyle(wallpaperId)}
      >
        {items && items.length === 0 && (
          <p className="my-auto text-center text-sm text-zinc-500">
            No messages yet. Say hi.
          </p>
        )}
        {items?.map((item) => {
          if (item.kind === "text") {
            return (
              <MessageBubble
                key={`m-${item.data.id}`}
                kind="text"
                body={item.data.body}
                attachment={item.data.attachment}
                createdAt={item.data.createdAt}
                outgoing={item.data.senderId === self}
              />
            );
          }
          return (
            <MessageBubble
              key={`v-${item.data.id}`}
              kind="voice"
              audioBlob={item.data.audioBlob}
              transcript={item.data.transcript}
              createdAt={item.data.createdAt}
              outgoing={item.data.senderId === self}
            />
          );
        })}
      </div>

      <Composer
        onSendText={sendText}
        onSendVoice={sendVoice}
        onSendAttachment={sendAttachment}
      />
    </main>
  );
}
