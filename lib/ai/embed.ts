"use client";

import { pipeline } from "@huggingface/transformers";

type Extractor = (
  input: string,
  opts?: { pooling?: "mean" | "cls" | "none"; normalize?: boolean },
) => Promise<{ data: Float32Array }>;

let cached: Promise<Extractor> | null = null;

function getModel(): Promise<Extractor> {
  if (!cached) {
    cached = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2") as unknown as Promise<Extractor>;
  }
  return cached;
}

export async function warmEmbedder(): Promise<void> {
  await getModel();
}

export async function embed(text: string): Promise<number[]> {
  const model = await getModel();
  const out = await model(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are L2-normalized → dot product == cosine similarity
}
