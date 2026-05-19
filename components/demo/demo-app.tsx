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
import {
  ensureNotificationPermission,
  notify,
  playMessageTone,
} from "@/lib/demo/notifications";
import { registerProfile } from "@/lib/demo/profiles";
import { registerPushSubscription, sendPush } from "@/lib/demo/push";
import { AnimatedBackground } from "./animated-background";
import { BottomBar, type Tab } from "./bottom-bar";
import { CallProvider } from "./call-provider";
import { CallOverlay } from "./call-overlay";
import { CallsView } from "./calls-view";
import { Chat } from "./chat";
import { ChatProfile } from "./chat-profile";
import { ConversationsList } from "./conversations-list";
import { GroupChat } from "./group-chat";
import { LeftRail } from "./left-rail";
import { Logo } from "./logo";
import { LoginFlow } from "./login-flow";
import { Settings } from "./settings";

type Hydration = { state: "loading" } | { state: "ready"; self: string | null };

export function DemoApp() {
  const [hydration, setHydration] = useState<Hydration>({ state: "loading" });
  const [tab, setTab] = useState<Tab>("chats");
  const [target, setTarget] = useState<string | null>(null);
  const [chatSubView, setChatSubView] = useState<"messages" | "profile">(
    "messages",
  );

  useEffect(() => {
    setHydration({ state: "ready", self: getIdentity() });
  }, []);

  const self = hydration.state === "ready" ? hydration.self : null;

  // Ask for notification permission and register the service worker for
  // Web Push once we have an identity.
  useEffect(() => {
    if (!self) return;
    (async () => {
      const granted = await ensureNotificationPermission();
      if (!granted) return;
      await registerPushSubscription(self);
    })();
  }, [self]);

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
          location: wire.location,
        };
        void db.messages.put(local);

        // Notify + chime when this device isn't actively viewing the chat.
        const isGroup = isGroupId(wire.conversationId);
        const groupForTitle = isGroup
          ? await db.groups.get(wire.conversationId)
          : undefined;
        const title = isGroup
          ? `${groupForTitle?.name ?? "Group"} — ${wire.senderId}`
          : wire.senderId;
        const body = wire.body
          || (wire.location
            ? "📍 Location"
            : wire.attachment
              ? wire.attachment.type.startsWith("image/")
                ? "📷 Photo"
                : `📎 ${wire.attachment.name}`
              : "New message");
        notify(title, { body, tag: wire.conversationId });
        playMessageTone();

        const sender = event.from;

        // Mark "asked" before the DB read so subsequent messages from
        // the same peer skip the IndexedDB roundtrip entirely.
        if (!askedAvatarRef.current.has(sender)) {
          askedAvatarRef.current.add(sender);
          const existing = await db.users.get(sender);
          if (!existing?.avatarBlob) {
            void emit({ kind: "avatar-request", from: self, to: sender });
          }
        }

        if (isGroupId(wire.conversationId)) {
          const groupId = wire.conversationId;
          if (!askedGroupRef.current.has(groupId)) {
            askedGroupRef.current.add(groupId);
            const existing = await db.groups.get(groupId);
            if (!existing) {
              void emit({ kind: "group-request", from: self, to: sender, groupId });
            }
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

      if (event.kind === "voice-note") {
        if (event.to !== self) return;
        const vn = event.voiceNote;
        const blob = base64ToBlob(vn.base64, vn.type);
        await db.voiceNotes.put({
          id: vn.id,
          conversationId: vn.conversationId,
          senderId: vn.senderId,
          audioBlob: blob,
          transcript: vn.transcript,
          durationMs: vn.durationMs,
          createdAt: vn.createdAt,
          syncedAt: null,
          remoteUrl: null,
        });

        // Notification + chime when the tab isn't focused.
        const isGroup = isGroupId(vn.conversationId);
        const groupForTitle = isGroup
          ? await db.groups.get(vn.conversationId)
          : undefined;
        notify(
          isGroup
            ? `${groupForTitle?.name ?? "Group"} — ${vn.senderId}`
            : vn.senderId,
          {
            body: "🎤 Voice note",
            tag: vn.conversationId,
          },
        );
        playMessageTone();
        return;
      }

      if (event.kind === "voice-transcript") {
        if (event.to !== self) return;
        await db.voiceNotes.update(event.voiceNoteId, {
          transcript: event.transcript,
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
      if (cancelled) return;
      void registerProfile(self, me?.avatarBlob ?? undefined);
      if (!me?.avatarBlob) return;
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
      const targets: string[] = [];
      for (const peer of recipients) {
        if (peer === self) continue;
        targets.push(peer);
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
      sendPush({
        to: targets,
        title: self,
        body,
        tag: `broadcast-${now}`,
      });
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

  // Reset to messages whenever the target changes (so opening a new chat
  // doesn't jump to the previous chat's profile).
  // We rely on setTarget callers to also setChatSubView("messages").

  const changeTab = (next: Tab) => {
    setTab(next);
    if (next !== "chats") {
      setTarget(null);
      setChatSubView("messages");
    }
  };

  return (
    <CallProvider self={self}>
      <div className="flex h-svh flex-col md:grid md:grid-cols-[64px_320px_1fr]">
        <LeftRail active={tab} onChange={changeTab} />

        <aside
          className={cn(
            "flex h-full flex-1 flex-col overflow-hidden md:flex-initial md:border-r",
            inChatDetail && "hidden md:flex",
          )}
        >
          <div className="flex flex-1 flex-col overflow-hidden">
            {tab === "chats" && (
              <ConversationsList
                self={self}
                selectedTarget={target}
                onSelect={(t) => {
                  setTarget(t);
                  setChatSubView("messages");
                }}
                onCreateGroup={createGroup}
                onSendBroadcast={sendBroadcast}
              />
            )}
            {tab === "calls" && (
              <CallsView
                onOpenChat={(peer) => {
                  setTab("chats");
                  setTarget(peer);
                  setChatSubView("messages");
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
          <BottomBar active={tab} onChange={changeTab} />
        </aside>

        <section
          className={cn(
            "flex h-full flex-1 flex-col overflow-hidden md:flex-initial",
            !inChatDetail && "hidden md:flex",
          )}
        >
          {inChatDetail && target ? (
            chatSubView === "profile" ? (
              <ChatProfile
                self={self}
                target={target}
                onBack={() => setChatSubView("messages")}
              />
            ) : isGroupId(target) ? (
              <GroupChat
                self={self}
                groupId={target}
                onBack={() => {
                  setTarget(null);
                  setChatSubView("messages");
                }}
                onOpenProfile={() => setChatSubView("profile")}
              />
            ) : (
              <Chat
                self={self}
                peer={target}
                onBack={() => {
                  setTarget(null);
                  setChatSubView("messages");
                }}
                onOpenProfile={() => setChatSubView("profile")}
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
