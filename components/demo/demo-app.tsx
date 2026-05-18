"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { db, type LocalAttachment, type LocalMessage } from "@/lib/db";
import { clearIdentity, getIdentity } from "@/lib/demo/identity";
import { base64ToBlob } from "@/lib/demo/encoding";
import { listen } from "@/lib/demo/transport";
import { AnimatedBackground } from "./animated-background";
import { CallProvider } from "./call-provider";
import { CallOverlay } from "./call-overlay";
import { LoginFlow } from "./login-flow";
import { ConversationsList } from "./conversations-list";
import { Chat } from "./chat";
import { Settings } from "./settings";
import { Logo } from "./logo";

type Hydration = { state: "loading" } | { state: "ready"; self: string | null };

type View = { type: "chats" } | { type: "chat"; peer: string } | { type: "settings" };

export function DemoApp() {
  const [hydration, setHydration] = useState<Hydration>({ state: "loading" });
  const [view, setView] = useState<View>({ type: "chats" });

  useEffect(() => {
    setHydration({ state: "ready", self: getIdentity() });
  }, []);

  const self = hydration.state === "ready" ? hydration.self : null;

  // Inbound messages from peers (cross-device, via Supabase Realtime).
  useEffect(() => {
    if (!self) return;
    return listen((event) => {
      if (event.kind !== "message") return;
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
    });
  }, [self]);

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
            selectedPeer={view.type === "chat" ? view.peer : null}
            onSelect={(peer) => setView({ type: "chat", peer })}
            onOpenSettings={() => setView({ type: "settings" })}
          />
        </aside>
        <section
          className={cn(
            "md:flex md:flex-col md:overflow-hidden",
            !onMobileShowRightPane && "hidden md:flex",
          )}
        >
          {view.type === "chat" ? (
            <Chat
              self={self}
              peer={view.peer}
              onBack={() => setView({ type: "chats" })}
            />
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
