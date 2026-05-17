"use client";

import { useEffect, useState } from "react";
import { clearIdentity, getIdentity } from "@/lib/demo/identity";
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

  if (hydration.state === "loading") {
    return <div className="min-h-svh" />;
  }

  if (hydration.self === null) {
    return (
      <LoginFlow
        onSignedIn={(phone) => setHydration({ state: "ready", self: phone })}
      />
    );
  }

  if (peer === null) {
    return (
      <ConversationsList
        self={hydration.self}
        onSelect={setPeer}
        onLogout={() => {
          clearIdentity();
          setHydration({ state: "ready", self: null });
          setPeer(null);
        }}
      />
    );
  }

  return (
    <Chat self={hydration.self} peer={peer} onBack={() => setPeer(null)} />
  );
}
