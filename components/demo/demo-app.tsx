"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  db,
  isGroupId,
  type LocalAttachment,
  type LocalGroup,
  type LocalMessage,
} from "@/lib/db";
import { clearIdentity, getIdentity } from "@/lib/demo/identity";
import { base64ToBlob, blobToBase64 } from "@/lib/demo/encoding";
import { emit, listen } from "@/lib/demo/transport";
import { conversationIdFor } from "@/lib/demo/conversations";
import { AnimatedBackground } from "./animated-background";
import { BottomBar, type Tab } from "./bottom-bar";
import { CallProvider } from "./call-provider";
import { CallOverlay } from "./call-overlay";
import { CallsView } from "./calls-view";
import { Chat } from "./chat";
import { ConversationsList } from "./conversations-list";
import { GroupChat } from "./group-chat";
import { Logo } from "./logo";
import { LoginFlow } from "./login-flow";
import { Settings } from "./settings";

type Hydration = { state: "loading" } | { state: "ready"; self: string | null };

export function DemoApp() {
  const [hydration, setHydration] = useState<Hydration>({ state: "loading" });
  const [tab, setTab] = useState<Tab>("chats");
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    setHydration({ state: "ready", self: getIdentity() });
  }, []);

  const self = hydration.state === "ready" ? hydration.self : null;

  const askedAvatarRef = useRef<Set<string>>(new Set());
  const askedGroupRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!self) return;
    return listen(async (event) => {
      if (event.kind === "message") {
        if (event.to !== self) return;
        const wire = event.message;

        let attachment: LocalAttachment | undefined;
        if (wire.attachment) {
          attachment = {
            blob: base64ToBlob(wire.attachment.base64, wire.attachment.type),
            name: wire.attachment.name,
            type: wire.attachment.type,
            size: wire.attachment.size,
          };
        }
        const local: LocalMessage = {
          id: wire.id,
          conversationId: wire.conversationId,
          senderId: wire.senderId,
          body: wire.body,
          createdAt: wire.createdAt,
          syncedAt: wire.syncedAt,
          attachment,
        };
        void db.messages.put(local);

        const sender = event.from;

        if (!askedAvatarRef.current.has(sender)) {
          const existing = await db.users.get(sender);
          if (!existing?.avatarBlob) {
            askedAvatarRef.current.add(sender);
            void emit({ kind: "avatar-request", from: self, to: sender });
          }
        }

        if (isGroupId(wire.conversationId)) {
          const groupId = wire.conversationId;
          const existing = await db.groups.get(groupId);
          if (!existing && !askedGroupRef.current.has(groupId)) {
            askedGroupRef.current.add(groupId);
            void emit({ kind: "group-request", from: self, to: sender, groupId });
          }
        }
        return;
      }

      if (event.kind === "avatar") {
        const blob = event.avatar
          ? base64ToBlob(event.avatar.base64, event.avatar.type)
          : undefined;
        const existing = await db.users.get(event.from);
        await db.users.put({
          id: event.from,
          email: existing?.email ?? "",
          displayName: existing?.displayName ?? event.from,
          avatarUrl: null,
          avatarBlob: blob,
          lastSeenAt: Date.now(),
        });
        return;
      }

      if (event.kind === "avatar-request") {
        if (event.to !== self) return;
        const me = await db.users.get(self);
        if (!me?.avatarBlob) {
          void emit({ kind: "avatar", from: self, avatar: null });
          return;
        }
        const base64 = await blobToBase64(me.avatarBlob);
        void emit({
          kind: "avatar",
          from: self,
          avatar: { base64, type: me.avatarBlob.type },
        });
        return;
      }

      if (event.kind === "group-created") {
        const g = event.group;
        if (!g.members.includes(self)) return;
        const local: LocalGroup = {
          id: g.id,
          name: g.name,
          members: g.members,
          createdBy: g.createdBy,
          createdAt: g.createdAt,
        };
        await db.groups.put(local);
        return;
      }

      if (event.kind === "group-request") {
        if (event.to !== self) return;
        const g = await db.groups.get(event.groupId);
        if (!g) return;
        if (!g.members.includes(event.from)) return;
        void emit({
          kind: "group-created",
          from: self,
          group: {
            id: g.id,
            name: g.name,
            members: g.members,
            createdBy: g.createdBy,
            createdAt: g.createdAt,
          },
        });
        return;
      }
    });
  }, [self]);

  useEffect(() => {
    if (!self) return;
    let cancelled = false;
    (async () => {
      const me = await db.users.get(self);
      if (cancelled || !me?.avatarBlob) return;
      const base64 = await blobToBase64(me.avatarBlob);
      void emit({
        kind: "avatar",
        from: self,
        avatar: { base64, type: me.avatarBlob.type },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [self]);

  const createGroup = useCallback(
    async (name: string, members: string[]) => {
      if (!self) return;
      const id = `group:${crypto.randomUUID()}`;
      const group: LocalGroup = {
        id,
        name,
        members,
        createdBy: self,
        createdAt: Date.now(),
      };
      await db.groups.put(group);
      for (const m of members) {
        if (m === self) continue;
        void emit({ kind: "group-created", from: self, group });
      }
      setTab("chats");
      setTarget(id);
    },
    [self],
  );

  const sendBroadcast = useCallback(
    async (recipients: string[], body: string) => {
      if (!self) return;
      const now = Date.now();
      for (const peer of recipients) {
        if (peer === self) continue;
        const message: LocalMessage = {
          id: crypto.randomUUID(),
          conversationId: conversationIdFor(self, peer),
          senderId: self,
          body,
          createdAt: now,
          syncedAt: null,
        };
        await db.messages.add(message);
        void emit({
          kind: "message",
          from: self,
          to: peer,
          message: {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            body: message.body,
            createdAt: message.createdAt,
            syncedAt: message.syncedAt,
          },
        });
      }
    },
    [self],
  );

  if (hydration.state === "loading") {
    return (
      <CallProvider self={null}>
        <div className="min-h-svh" />
      </CallProvider>
    );
  }

  if (self === null) {
    return (
      <CallProvider self={null}>
        <LoginFlow
          onSignedIn={(phone) => {
            setHydration({ state: "ready", self: phone });
            setTab("chats");
            setTarget(null);
          }}
        />
      </CallProvider>
    );
  }

  const inChatDetail = tab === "chats" && target !== null;

  return (
    <CallProvider self={self}>
      <div className="md:grid md:h-svh md:grid-cols-[320px_1fr]">
        <aside
          className={cn(
            "flex h-svh flex-col md:h-auto md:overflow-hidden md:border-r",
            inChatDetail && "hidden md:flex",
          )}
        >
          <div className="flex flex-1 flex-col overflow-hidden">
            {tab === "chats" && (
              <ConversationsList
                self={self}
                selectedTarget={target}
                onSelect={(t) => setTarget(t)}
                onCreateGroup={createGroup}
                onSendBroadcast={sendBroadcast}
              />
            )}
            {tab === "calls" && (
              <CallsView
                onOpenChat={(peer) => {
                  setTab("chats");
                  setTarget(peer);
                }}
              />
            )}
            {tab === "profile" && (
              <Settings
                self={self}
                onSignedOut={() => {
                  clearIdentity();
                  setHydration({ state: "ready", self: null });
                  setTab("chats");
                  setTarget(null);
                }}
              />
            )}
          </div>
          <BottomBar
            active={tab}
            onChange={(next) => {
              setTab(next);
              if (next !== "chats") setTarget(null);
            }}
          />
        </aside>
        <section
          className={cn(
            "md:flex md:flex-col md:overflow-hidden",
            !inChatDetail && "hidden md:flex",
          )}
        >
          {inChatDetail && target ? (
            isGroupId(target) ? (
              <GroupChat
                self={self}
                groupId={target}
                onBack={() => setTarget(null)}
              />
            ) : (
              <Chat
                self={self}
                peer={target}
                onBack={() => setTarget(null)}
              />
            )
          ) : (
            <EmptyChatPlaceholder />
          )}
        </section>
      </div>
      <CallOverlay />
    </CallProvider>
  );
}

function EmptyChatPlaceholder() {
  return (
    <div className="relative hidden h-full flex-1 items-center justify-center overflow-hidden bg-background md:flex">
      <AnimatedBackground />
      <div className="relative z-10 flex max-w-sm flex-col items-center gap-3 px-6 text-center">
        <Logo size={64} />
        <h2 className="text-lg font-semibold">Pick a conversation</h2>
        <p className="text-sm text-zinc-500">
          Or tap <span className="font-medium">New chat</span> in the sidebar to
          start one. Open CommApp on another phone or tab as a different number
          to chat or call.
        </p>
      </div>
    </div>
  );
}
