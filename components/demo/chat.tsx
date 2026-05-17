"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, type LocalMessage, type LocalVoiceNote } from "@/lib/db";
import { conversationIdFor } from "@/lib/demo/conversations";
import { transcribe, warmTranscriber } from "@/lib/ai/transcribe";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";

interface Props {
  self: string;
  peer: string;
  onBack: () => void;
}

type Item =
  | { kind: "text"; data: LocalMessage }
  | { kind: "voice"; data: LocalVoiceNote };

export function Chat({ self, peer, onBack }: Props) {
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
    await db.messages.add({
      id: crypto.randomUUID(),
      conversationId,
      senderId: self,
      body,
      createdAt: Date.now(),
      syncedAt: null,
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

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
          {peer.slice(-2)}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-sm">{peer}</span>
          <span className="text-[10px] text-zinc-500">offline-first</span>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto bg-zinc-50 px-3 py-4 dark:bg-zinc-950"
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

      <Composer onSendText={sendText} onSendVoice={sendVoice} />
    </main>
  );
}
