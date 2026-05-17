"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { clearIdentity, getIdentity } from "@/lib/demo/identity";
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
    <div className="hidden h-full flex-1 items-center justify-center bg-background md:flex">
      <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
        <Logo size={64} />
        <h2 className="text-lg font-semibold">Pick a conversation</h2>
        <p className="text-sm text-zinc-500">
          Or tap <span className="font-medium">New chat</span> in the sidebar to
          start one. Open commapp in another tab as a different phone number to
          chat or call.
        </p>
      </div>
    </div>
  );
}
