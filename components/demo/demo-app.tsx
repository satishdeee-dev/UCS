"use client";

import { useEffect, useState } from "react";
import { clearIdentity, getIdentity } from "@/lib/demo/identity";
import { CallProvider } from "./call-provider";
import { CallOverlay } from "./call-overlay";
import { LoginFlow } from "./login-flow";
import { ConversationsList } from "./conversations-list";
import { Chat } from "./chat";

type Hydration = { state: "loading" } | { state: "ready"; self: string | null };

export function DemoApp() {
  const [hydration, setHydration] = useState<Hydration>({ state: "loading" });
  const [peer, setPeer] = useState<string | null>(null);

  useEffect(() => {
    setHydration({ state: "ready", self: getIdentity() });
  }, []);

  const self = hydration.state === "ready" ? hydration.self : null;

  return (
    <CallProvider self={self}>
      {hydration.state === "loading" ? (
        <div className="min-h-svh" />
      ) : hydration.self === null ? (
        <LoginFlow
          onSignedIn={(phone) =>
            setHydration({ state: "ready", self: phone })
          }
        />
      ) : peer === null ? (
        <ConversationsList
          self={hydration.self}
          onSelect={setPeer}
          onLogout={() => {
            clearIdentity();
            setHydration({ state: "ready", self: null });
            setPeer(null);
          }}
        />
      ) : (
        <Chat self={hydration.self} peer={peer} onBack={() => setPeer(null)} />
      )}
      <CallOverlay />
    </CallProvider>
  );
}
