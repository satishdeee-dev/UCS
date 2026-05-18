"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_ATTACHMENT_BYTES = 500 * 1024; // ~500 KB raw → ~670 KB base64, fits Realtime broadcast
const ACCEPTED_TYPES =
  "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt";

interface Props {
  onSendText: (text: string) => void;
  onSendVoice: (blob: Blob, durationMs: number) => void;
  onSendAttachment: (file: File) => void | Promise<void>;
}

export function Composer({ onSendText, onSendVoice, onSendAttachment }: Props) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function submitText(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
  }

  function openFilePicker() {
    setError(null);
    fileInputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(
        `File too large (${Math.round(file.size / 1024)} KB). Demo limit is 500 KB until Storage is configured.`,
      );
      return;
    }
    setError(null);
    await onSendAttachment(file);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 24_000,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const durationMs = Date.now() - startedAtRef.current;
        stream.getTracks().forEach((t) => t.stop());
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        setRecording(false);
        setElapsedMs(0);
        if (blob.size > 0 && durationMs > 250) {
          onSendVoice(blob, durationMs);
        }
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microphone unavailable";
      setError(msg);
      setRecording(false);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  const seconds = Math.floor(elapsedMs / 1000);
  const elapsedLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-1 border-t bg-card px-3 py-2">
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept={ACCEPTED_TYPES}
        onChange={handleFile}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {recording ? (
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            Recording…
            <span className="ml-auto font-mono tabular-nums">{elapsedLabel}</span>
          </div>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={stopRecording}
            className="rounded-full"
            aria-label="Stop and send"
          >
            <Square className="size-4" />
          </Button>
        </div>
      ) : (
        <form onSubmit={submitText} className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={openFilePicker}
            className="rounded-full"
            aria-label="Attach file"
          >
            <Paperclip className="size-4" />
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message"
            className="flex-1"
          />
          {text.trim() ? (
            <Button type="submit" size="icon" className="rounded-full" aria-label="Send">
              <Send className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="default"
              onClick={startRecording}
              className="rounded-full"
              aria-label="Record voice note"
            >
              <Mic className="size-4" />
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
