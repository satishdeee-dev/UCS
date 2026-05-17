"use client";

import { pipeline } from "@huggingface/transformers";

type TranscriberInput = Float32Array | string;
type TranscriberOutput = { text?: string } | Array<{ text?: string }>;
type Transcriber = (input: TranscriberInput) => Promise<TranscriberOutput>;

let cached: Promise<Transcriber> | null = null;

function getModel(): Promise<Transcriber> {
  if (!cached) {
    cached = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny") as unknown as Promise<Transcriber>;
  }
  return cached;
}

export async function warmTranscriber(): Promise<void> {
  await getModel();
}

export async function transcribe(audio: Float32Array | Blob | string): Promise<string> {
  const model = await getModel();
  const input: TranscriberInput =
    audio instanceof Blob ? URL.createObjectURL(audio) : audio;

  const out = await model(input);

  if (audio instanceof Blob && typeof input === "string") {
    URL.revokeObjectURL(input);
  }

  if (Array.isArray(out)) {
    return out.map((r) => r.text ?? "").join(" ").trim();
  }
  return out.text?.trim() ?? "";
}
