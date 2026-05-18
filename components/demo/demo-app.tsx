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
import { AnimatedBackground } from "./animated-background";
import { CallProvider } from "./call-provider";
import { CallOverlay } from "./call-overlay";
import { LoginFlow } from "./login-flow";
import { ConversationsList } from "./conversations-list";
import { Chat } from "./chat";
import { GroupChat } from "./group-chat";
import { Settings } from "./settings";
import { Logo } from "./logo";
import { conversationIdFor } from "@/lib/demo/conversations";

type Hydration = { state: "loading" } | { state: "ready"; self: string | null };

type View =
  | { type: "chats" }
  | { type: "chat"; target: string } // peer phone OR group id
  | { type: "settings" };

export function DemoApp() {
  const [hydration, setHydration] = useState<Hydration>({ state: "loading" });
  const [view, setView] = useState<View>({ type: "chats" });

  useEffect(() => {
    setHydration({ state: "ready", self: getIdentity() });
  }, []);

  const self = hydration.state === "ready" ? hydration.self : null;

  const askedAvatarRef = useRef<Set<string>>(new Set());
  const askedGroupRef = useRef<Set<string>>(new Set());

  // Inbound events from peers (cross-device, via Supabase Realtime).
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

        // Ask for avatar if we don't have one yet.
        if (!askedAvatarRef.current.has(sender)) {
          const existing = await db.users.get(sender);
          if (!existing?.avatarBlob) {
            askedAvatarRef.current.add(sender);
            void emit({ kind: "avatar-request", from: self, to: sender });
          }
        }

        // Group message for a group we don't know about? Ask the sender.
        if (isGroupId(wire.conversationId)) {
          const groupId = wire.conversationId;
          const existing = await db.groups.get(groupId);
          if (!existing && !askedGroupRef.current.has(groupId)) {
            askedGroupRef.current.add(groupId);
            void emit({
              kind: "group-request",
              from: self,
              to: sender,
              groupId,
            });
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
        if (!g.members.includes(self)) return; // not for us
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
        if (!g.members.includes(event.from)) return; // requester isn't a member
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

  // Announce our avatar (if any) when we sign in.
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
      // Broadcast to each member except self.
      for (const m of members) {
        if (m === self) continue;
        void emit({ kind: "group-created", from: self, group });
      }
      setView({ type: "chat", target: id });
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
            setView({ type: "chats" });
          }}
        />
      </CallProvider>
    );
  }

  const onMobileShowChats = view.type === "chats";
  const onMobileShowRightPane = view.type !== "chats";

  return (
    <CallProvider self={self}>
      <div className="md:grid md:h-svh md:grid-cols-[320px_1fr]">
        <aside
          className={cn(
            "md:flex md:flex-col md:overflow-hidden md:border-r",
            !onMobileShowChats && "hidden md:flex",
          )}
        >
          <ConversationsList
            self={self}
            selectedTarget={view.type === "chat" ? view.target : null}
            onSelect={(target) => setView({ type: "chat", target })}
            onOpenSettings={() => setView({ type: "settings" })}
            onCreateGroup={createGroup}
            onSendBroadcast={sendBroadcast}
          />
        </aside>
        <section
          className={cn(
            "md:flex md:flex-col md:overflow-hidden",
            !onMobileShowRightPane && "hidden md:flex",
          )}
        >
          {view.type === "chat" ? (
            isGroupId(view.target) ? (
              <GroupChat
                self={self}
                groupId={view.target}
                onBack={() => setView({ type: "chats" })}
              />
            ) : (
              <Chat
                self={self}
                peer={view.target}
                onBack={() => setView({ type: "chats" })}
              />
            )
          ) : view.type === "settings" ? (
            <Settings
              self={self}
              onBack={() => setView({ type: "chats" })}
              onSignedOut={() => {
                clearIdentity();
                setHydration({ state: "ready", self: null });
                setView({ type: "chats" });
              }}
            />
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
