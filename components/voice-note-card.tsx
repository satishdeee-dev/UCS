"use client";

import { useEffect, useState } from "react";
import { Loader2, CloudOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type LocalVoiceNote } from "@/lib/db";

export function VoiceNoteCard({ note }: { note: LocalVoiceNote }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(note.audioBlob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [note.audioBlob]);

  const seconds = Math.floor(note.durationMs / 1000);
  const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const time = new Date(note.createdAt).toLocaleString();

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{time}</span>
        <span className="flex items-center gap-2 font-mono tabular-nums">
          {note.syncedAt === null && (
            <CloudOff
              className="size-3"
              aria-label="Not yet synced"
            />
          )}
          {duration}
        </span>
      </div>
      {url && <audio src={url} controls className="w-full" preload="metadata" />}
      <div className="text-sm">
        {note.transcript === null ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="size-3 animate-spin" />
            <span>Transcribing on-device…</span>
          </div>
        ) : note.transcript === "" ? (
          <span className="italic text-zinc-400">No speech detected.</span>
        ) : (
          <p className="leading-relaxed">{note.transcript}</p>
        )}
      </div>
    </Card>
  );
}
