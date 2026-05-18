"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/demo/identity";
import { conversationIncludes, getPeer } from "@/lib/demo/conversations";

interface Props {
  self: string;
  onCancel: () => void;
  onCreate: (name: string, members: string[]) => void;
}

export function NewGroupDialog({ self, onCancel, onCreate }: Props) {
  const [name, setName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [extraMembers, setExtraMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const knownPeers = useLiveQuery(async () => {
    const msgs = await db.messages.toArray();
    const set = new Set<string>();
    for (const m of msgs) {
      if (m.conversationId.startsWith("group:")) continue;
      if (!conversationIncludes(m.conversationId, self)) continue;
      const peer = getPeer(m.conversationId, self);
      if (peer) set.add(peer);
    }
    return Array.from(set);
  }, [self]);

  const members = useMemo(() => {
    const list = memberInput
      .split(",")
      .map((s) => normalizePhone(s.trim()))
      .filter(Boolean);
    return Array.from(new Set([self, ...extraMembers, ...list]));
  }, [memberInput, extraMembers, self]);

  function addPeer(peer: string) {
    if (!extraMembers.includes(peer)) setExtraMembers([...extraMembers, peer]);
  }

  function removeMember(phone: string) {
    if (phone === self) return;
    setExtraMembers(extraMembers.filter((m) => m !== phone));
    setMemberInput(
      memberInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => normalizePhone(s) !== phone)
        .join(", "),
    );
  }

  function create() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Group needs a name");
      return;
    }
    if (members.length < 2) {
      setError("Add at least one other member");
      return;
    }
    setError(null);
    onCreate(trimmedName, members);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">New group</h2>
            <p className="text-xs text-zinc-500">
              All members must have CommApp open to receive messages.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Field team alpha"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="group-members">Members (comma-separated phone numbers)</Label>
          <Input
            id="group-members"
            value={memberInput}
            inputMode="tel"
            onChange={(e) => setMemberInput(e.target.value)}
            placeholder="+15550002, +15550003"
          />
        </div>

        {knownPeers && knownPeers.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Quick add from your chats:</span>
            <div className="flex flex-wrap gap-1.5">
              {knownPeers.map((peer) => {
                const included = members.includes(peer);
                return (
                  <button
                    key={peer}
                    onClick={() => addPeer(peer)}
                    disabled={included}
                    className={`rounded-full border px-2.5 py-1 text-xs font-mono transition-colors ${
                      included
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
                        : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {included ? "✓ " : "+ "}
                    {peer}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">
            {members.length} member{members.length === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-mono text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-200"
              >
                {m === self ? `${m} (you)` : m}
                {m !== self && (
                  <button
                    onClick={() => removeMember(m)}
                    className="opacity-70 hover:opacity-100"
                    aria-label={`Remove ${m}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={create}>
            <Plus className="size-4" />
            Create group
          </Button>
        </div>
      </div>
    </div>
  );
}
