"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Megaphone, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { conversationIncludes, getPeer } from "@/lib/demo/conversations";
import { normalizePhone } from "@/lib/demo/identity";
import { Avatar } from "./avatar";
import { Logo } from "./logo";
import { NewGroupDialog } from "./new-group-dialog";
import { NewBroadcastDialog } from "./new-broadcast-dialog";

interface Props {
  self: string;
  selectedTarget: string | null; // peer phone OR groupId
  onSelect: (target: string) => void;
  onCreateGroup: (name: string, members: string[]) => Promise<void>;
  onSendBroadcast: (recipients: string[], body: string) => Promise<void>;
}

type ListEntry = {
  id: string; // peer phone or groupId
  kind: "direct" | "group";
  name: string; // peer phone or group name
  preview: string;
  createdAt: number;
};

export function ConversationsList({
  self,
  selectedTarget,
  onSelect,
  onCreateGroup,
  onSendBroadcast,
}: Props) {
  const [showNewChat, setShowNewChat] = useState(false);
  const [newPeer, setNewPeer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);

  const entries = useLiveQuery(async () => {
    const [msgs, vns, groups] = await Promise.all([
      db.messages.toArray(),
      db.voiceNotes.toArray(),
      db.groups.toArray(),
    ]);

    const map = new Map<string, ListEntry>();

    // Direct conversations: derived from messages (any conversationId with "phone:phone" shape)
    for (const m of msgs) {
      const cid = m.conversationId;
      if (cid.startsWith("group:")) continue;
      if (!conversationIncludes(cid, self)) continue;
      const peer = getPeer(cid, self);
      if (!peer) continue;
      const preview = m.location
        ? "📍 Location"
        : m.attachment
          ? m.attachment.type.startsWith("image/")
            ? "📷 Photo"
            : `📎 ${m.attachment.name}`
          : m.body;
      const ex = map.get(peer);
      if (!ex || m.createdAt > ex.createdAt) {
        map.set(peer, {
          id: peer,
          kind: "direct",
          name: peer,
          preview,
          createdAt: m.createdAt,
        });
      }
    }
    for (const v of vns) {
      const cid = v.conversationId;
      if (cid.startsWith("group:")) continue;
      if (!conversationIncludes(cid, self)) continue;
      const peer = getPeer(cid, self);
      if (!peer) continue;
      const ex = map.get(peer);
      if (!ex || v.createdAt > ex.createdAt) {
        map.set(peer, {
          id: peer,
          kind: "direct",
          name: peer,
          preview: "🎤 Voice note",
          createdAt: v.createdAt,
        });
      }
    }

    // Groups: every group you're a member of shows up, even before any message
    for (const g of groups) {
      if (!g.members.includes(self)) continue;
      const groupMsgs = msgs.filter((m) => m.conversationId === g.id);
      const groupVns = vns.filter((v) => v.conversationId === g.id);
      const last = [...groupMsgs, ...groupVns].sort(
        (a, b) => b.createdAt - a.createdAt,
      )[0];
      let preview = `${g.members.length} members`;
      let createdAt = g.createdAt;
      if (last) {
        createdAt = last.createdAt;
        if ("body" in last) {
          const who = last.senderId === self ? "You" : last.senderId;
          preview = last.location
            ? `${who}: 📍 Location`
            : last.attachment
              ? last.attachment.type.startsWith("image/")
                ? `${who}: 📷 Photo`
                : `${who}: 📎 ${last.attachment.name}`
              : `${who}: ${last.body}`;
        } else {
          preview = `${last.senderId === self ? "You" : last.senderId}: 🎤 Voice note`;
        }
      }
      map.set(g.id, {
        id: g.id,
        kind: "group",
        name: g.name,
        preview,
        createdAt,
      });
    }

    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
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
    setShowNewChat(false);
    setNewPeer("");
  }

  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <Logo size={40} />
        <div className="flex flex-col">
          <span className="text-xl font-bold leading-tight tracking-tight">
            CommApp
          </span>
          <span className="font-mono text-[10px] text-zinc-500">{self}</span>
        </div>
      </header>

      <div className="flex flex-col gap-2 border-b bg-card px-3 py-3">
        {showNewChat ? (
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
                  setShowNewChat(false);
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
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowNewChat(true)}
              variant="outline"
              size="sm"
            >
              <Plus className="size-4" /> New chat
            </Button>
            <Button
              onClick={() => setShowGroupDialog(true)}
              variant="outline"
              size="sm"
            >
              <Users className="size-4" /> New group
            </Button>
            <Button
              onClick={() => setShowBroadcastDialog(true)}
              variant="outline"
              size="sm"
            >
              <Megaphone className="size-4" /> Broadcast
            </Button>
          </div>
        )}
      </div>

      <ul className="flex flex-1 flex-col overflow-y-auto">
        {entries && entries.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-zinc-500">
            No conversations yet. Tap <span className="font-medium">New chat</span>{" "}
            or <span className="font-medium">New group</span> to start one.
          </li>
        )}
        {entries?.map((entry) => {
          const isActive = selectedTarget === entry.id;
          const time = new Date(entry.createdAt).toLocaleString();
          return (
            <li key={entry.id}>
              <button
                onClick={() => onSelect(entry.id)}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-amber-50/60 dark:hover:bg-amber-950/30 ${isActive ? "bg-amber-50 dark:bg-amber-950/40" : ""}`}
              >
                {entry.kind === "direct" ? (
                  <Avatar phone={entry.id} size={40} />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200">
                    <Users className="size-5" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={`${entry.kind === "direct" ? "font-mono" : "font-medium"} truncate text-sm`}
                  >
                    {entry.name}
                  </span>
                  <span className="truncate text-xs text-zinc-500">
                    {entry.preview}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">{time}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {showGroupDialog && (
        <NewGroupDialog
          self={self}
          onCancel={() => setShowGroupDialog(false)}
          onCreate={async (name, members) => {
            await onCreateGroup(name, members);
            setShowGroupDialog(false);
          }}
        />
      )}
      {showBroadcastDialog && (
        <NewBroadcastDialog
          self={self}
          onCancel={() => setShowBroadcastDialog(false)}
          onSend={async (recipients, body) => {
            await onSendBroadcast(recipients, body);
            setShowBroadcastDialog(false);
          }}
        />
      )}
    </main>
  );
}
