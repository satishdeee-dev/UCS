"use client";

import { useState } from "react";
import { ArrowLeft, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { clearIdentity } from "@/lib/demo/identity";
import { Logo } from "./logo";

interface Props {
  self: string;
  onBack: () => void;
  onSignedOut: () => void;
}

const VERSION = "0.5 — demo";

export function Settings({ self, onBack, onSignedOut }: Props) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  async function clearAllData() {
    await Promise.all([
      db.messages.clear(),
      db.voiceNotes.clear(),
      db.vectors.clear(),
      db.syncQueue.clear(),
      db.users.clear(),
    ]);
    setConfirmingClear(false);
  }

  function signOut() {
    clearIdentity();
    onSignedOut();
  }

  return (
    <main className="flex h-full min-h-svh flex-col bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="md:hidden">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Logo size={44} />
            <div className="flex flex-col">
              <span className="text-base font-semibold">commapp</span>
              <span className="text-xs text-zinc-500">version {VERSION}</span>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
            Offline-first messaging, voice notes, and calls between dummy numbers.
            Cross-tab demo — open another tab with a different number to chat or call.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Account
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500">Signed in as</span>
                <span className="font-mono text-sm">{self}</span>
              </div>
            </div>
            <Button onClick={signOut} variant="outline" className="self-start">
              <LogOut className="size-4" /> Sign out
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Local data
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              All messages and voice notes are stored in this browser. Clearing
              wipes them on this device.
            </p>
            {confirmingClear ? (
              <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-sm">
                  This will delete all messages, voice notes, and embeddings on
                  this device. It can't be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearAllData}
                  >
                    Delete everything
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingClear(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setConfirmingClear(true)}
                variant="outline"
                className="self-start"
              >
                <Trash2 className="size-4" /> Clear local data
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              About the demo
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Demo OTP is <span className="font-mono">1234</span>. Any phone
              number works.
            </p>
            <p>
              Cross-tab transport uses{" "}
              <span className="font-mono">BroadcastChannel</span> and shared{" "}
              <span className="font-mono">IndexedDB</span> — no server.
            </p>
            <p>
              Voice transcription runs locally via Whisper-tiny. WebRTC calls
              use host ICE candidates (no STUN required for same-machine peers).
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
