"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { VoiceRecorder } from "@/components/voice-recorder";
import { VoiceNoteCard } from "@/components/voice-note-card";
import { LogoutButton } from "@/components/logout-button";
import { db } from "@/lib/db";
import { transcribe, warmTranscriber } from "@/lib/ai/transcribe";

type ModelStatus = "cold" | "loading" | "ready" | "failed";

export function NotesPanel({ userId }: { userId: string }) {
  const notes = useLiveQuery(
    () => db.voiceNotes.orderBy("createdAt").reverse().toArray(),
    [],
  );

  const [modelStatus, setModelStatus] = useState<ModelStatus>("cold");

  useEffect(() => {
    let cancelled = false;
    setModelStatus("loading");
    warmTranscriber()
      .then(() => {
        if (!cancelled) setModelStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setModelStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleNewRecording(blob: Blob, durationMs: number) {
    const id = crypto.randomUUID();
    const conversationId = `self:${userId}`;
    await db.voiceNotes.add({
      id,
      conversationId,
      senderId: userId,
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

  const banner =
    modelStatus === "loading"
      ? "Downloading transcription model on first use (~75MB, cached after)…"
      : modelStatus === "failed"
        ? "Couldn't load the transcription model. Recordings still work; transcripts won't."
        : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Voice notes</h1>
            <p className="text-sm text-zinc-500">
              Recorded and transcribed locally. Works offline.
            </p>
          </div>
          <LogoutButton />
        </div>
        {banner && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {banner}
          </p>
        )}
      </header>

      <div className="flex justify-center py-4">
        <VoiceRecorder
          onComplete={handleNewRecording}
          disabled={modelStatus === "loading"}
        />
      </div>

      <section className="flex flex-col gap-3">
        {notes && notes.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">
            No notes yet. Tap the mic to record one.
          </p>
        )}
        {notes?.map((note) => <VoiceNoteCard key={note.id} note={note} />)}
      </section>
    </main>
  );
}
