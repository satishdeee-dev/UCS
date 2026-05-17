"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { conversationIncludes, getPeer } from "@/lib/demo/conversations";
import { normalizePhone } from "@/lib/demo/identity";

interface Props {
  self: string;
  onSelect: (peer: string) => void;
  onLogout: () => void;
}

export function ConversationsList({ self, onSelect, onLogout }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [newPeer, setNewPeer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const conversations = useLiveQuery(async () => {
    const [msgs, vns] = await Promise.all([
      db.messages.toArray(),
      db.voiceNotes.toArray(),
    ]);
    const grouped = new Map<
      string,
      { cid: string; createdAt: number; preview: string }
    >();
    for (const m of msgs) {
      if (!conversationIncludes(m.conversationId, self)) continue;
      const ex = grouped.get(m.conversationId);
      if (!ex || m.createdAt > ex.createdAt) {
        grouped.set(m.conversationId, {
          cid: m.conversationId,
          createdAt: m.createdAt,
          preview: m.body,
        });
      }
    }
    for (const v of vns) {
      if (!conversationIncludes(v.conversationId, self)) continue;
      const ex = grouped.get(v.conversationId);
      if (!ex || v.createdAt > ex.createdAt) {
        grouped.set(v.conversationId, {
          cid: v.conversationId,
          createdAt: v.createdAt,
          preview: "🎤 Voice note",
        });
      }
    }
    return Array.from(grouped.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }, [self]);

  function startNew() {
    const normalized = normalizePhone(newPeer);
    if (!normalized || normalized.length < 4) {
      setError("Enter a phone number");
      return;
    }
    if (normalized === self) {
      setError("Can't chat with yourself");
      return;
    }
    setError(null);
    onSelect(normalized);
    setShowNew(false);
    setNewPeer("");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500">Signed in as</span>
          <span className="font-mono text-sm">{self}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          Sign out
        </Button>
      </header>

      <div className="flex flex-col gap-2 border-b p-4">
        {showNew ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                inputMode="tel"
                placeholder="Peer phone number"
                value={newPeer}
                onChange={(e) => setNewPeer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startNew()}
                autoFocus
              />
              <Button onClick={startNew}>Open</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowNew(false);
                  setError(null);
                  setNewPeer("");
                }}
              >
                Cancel
              </Button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <Button
            onClick={() => setShowNew(true)}
            variant="outline"
            className="self-start"
          >
            <Plus className="size-4" /> New chat
          </Button>
        )}
      </div>

      <ul className="flex flex-1 flex-col">
        {conversations && conversations.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-zinc-500">
            No conversations yet. Tap{" "}
            <span className="font-medium">New chat</span> to start one.
          </li>
        )}
        {conversations?.map((c) => {
          const peer = getPeer(c.cid, self);
          const time = new Date(c.createdAt).toLocaleString();
          return (
            <li key={c.cid}>
              <button
                onClick={() => onSelect(peer)}
                className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                  {peer.slice(-2)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-mono text-sm">{peer}</span>
                  <span className="truncate text-xs text-zinc-500">
                    {c.preview}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">{time}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
