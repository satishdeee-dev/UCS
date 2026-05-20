"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/demo/identity";
import { conversationIncludes, getPeer } from "@/lib/demo/conversations";

interface Props {
  self: string;
  onCancel: () => void;
  onSend: (recipients: string[], body: string) => void;
}

export function NewBroadcastDialog({ self, onCancel, onSend }: Props) {
  const [recipientInput, setRecipientInput] = useState("");
  const [extraRecipients, setExtraRecipients] = useState<string[]>([]);
  const [body, setBody] = useState("");
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

  const recipients = useMemo(() => {
    const list = recipientInput
      .split(",")
      .map((s) => normalizePhone(s.trim()))
      .filter(Boolean);
    return Array.from(new Set([...extraRecipients, ...list])).filter(
      (r) => r !== self,
    );
  }, [recipientInput, extraRecipients, self]);

  function addPeer(peer: string) {
    if (!extraRecipients.includes(peer))
      setExtraRecipients([...extraRecipients, peer]);
  }

  function removeRecipient(phone: string) {
    setExtraRecipients(extraRecipients.filter((m) => m !== phone));
    setRecipientInput(
      recipientInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => normalizePhone(s) !== phone)
        .join(", "),
    );
  }

  function send() {
    if (recipients.length === 0) {
      setError("Pick at least one recipient");
      return;
    }
    if (!body.trim()) {
      setError("Type a message");
      return;
    }
    setError(null);
    onSend(recipients, body.trim());
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Broadcast message</h2>
            <p className="text-xs text-zinc-500">
              Sends the same message to each recipient privately (each sees it
              as a normal 1:1 message from you).
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="bc-recipients">Recipients (comma-separated)</Label>
          <Input
            id="bc-recipients"
            value={recipientInput}
            inputMode="tel"
            onChange={(e) => setRecipientInput(e.target.value)}
            placeholder="+15550002, +15550003"
            autoFocus
          />
        </div>

        {knownPeers && knownPeers.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Quick add from your chats:</span>
            <div className="flex flex-wrap gap-1.5">
              {knownPeers.map((peer) => {
                const included = recipients.includes(peer);
                return (
                  <button
                    key={peer}
                    onClick={() => addPeer(peer)}
                    disabled={included}
                    className={`rounded-full border px-2.5 py-1 text-xs font-mono transition-colors ${
                      included
                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
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

        {recipients.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">
              {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-mono text-amber-700 dark:bg-amber-900/70 dark:text-amber-200"
                >
                  {r}
                  <button
                    onClick={() => removeRecipient(r)}
                    className="opacity-70 hover:opacity-100"
                    aria-label={`Remove ${r}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="bc-body">Message</Label>
          <Input
            id="bc-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="One message, many recipients"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={send}>
            <Send className="size-4" />
            Send to {recipients.length || 0}
          </Button>
        </div>
      </div>
    </div>
  );
}
