import Link from "next/link";

const phase1 = [
  { title: "Email & password auth", note: "Supabase Auth, cached for offline use" },
  { title: "Local-first data layer", note: "Dexie tables; UI reads never block on network" },
  { title: "Background sync", note: "Outbound queue drains on reconnect; Realtime pushes inbound" },
  { title: "1:1 messaging (CRDT)", note: "Yjs docs; concurrent writes merge automatically" },
  { title: "Voice notes", note: "MediaRecorder → Dexie → Supabase Storage, adaptive Opus" },
  { title: "On-device transcription", note: "Whisper-tiny via Transformers.js, runs locally" },
  { title: "Semantic search", note: "all-MiniLM-L6-v2 embeddings, cosine sim over local store" },
  { title: "Presence", note: "Green dot when online; last-seen when offline" },
  { title: "Avatars + image attachments", note: "Local cache, sync to Supabase Storage" },
  { title: "In-app notifications", note: "Mirrored to Dexie; Realtime updates the unread count" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16 sm:py-24">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">
          v0.1 · scaffold
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          UCS
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Offline-first messaging, voice notes, and on-device transcription for
          field teams working in intermittent-connectivity environments.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          MVP — Phase 1
        </h2>
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {phase1.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <span className="font-medium sm:w-64 sm:shrink-0">
                {item.title}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {item.note}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Configure your environment:{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-900">
            cp .env.local.example .env.local
          </code>
        </p>
        <p>
          Full spec:{" "}
          <Link
            href="/PRD.md"
            className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
          >
            PRD.md
          </Link>
        </p>
      </section>
    </main>
  );
}
