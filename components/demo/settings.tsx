"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Camera,
  ChevronRight,
  Info,
  LogOut,
  Shield,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { clearIdentity } from "@/lib/demo/identity";
import { blobToBase64 } from "@/lib/demo/encoding";
import { resizeImageToJpeg } from "@/lib/demo/image";
import { registerProfile } from "@/lib/demo/profiles";
import { emit } from "@/lib/demo/transport";
import { Avatar } from "./avatar";
import { Logo } from "./logo";

interface Props {
  self: string;
  onSignedOut: () => void;
}

const VERSION = "0.9 — demo";
const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024;

export function Settings({ self, onSignedOut }: Props) {
  const me = useLiveQuery(() => db.users.get(self), [self]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function clearAllData() {
    await Promise.all([
      db.messages.clear(),
      db.voiceNotes.clear(),
      db.vectors.clear(),
      db.syncQueue.clear(),
      db.users.clear(),
      db.callHistory.clear(),
      db.groups.clear(),
    ]);
    setConfirmingClear(false);
  }

  function signOut() {
    clearIdentity();
    onSignedOut();
  }

  function openFilePicker() {
    setPhotoError(null);
    fileInputRef.current?.click();
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Pick an image file");
      return;
    }
    if (file.size > MAX_AVATAR_INPUT_BYTES) {
      setPhotoError("Image too large (max 10 MB)");
      return;
    }

    try {
      const resized = await resizeImageToJpeg(file, 256, 0.85);
      await db.users.put({
        id: self,
        email: me?.email ?? "",
        displayName: me?.displayName ?? self,
        avatarUrl: null,
        avatarBlob: resized,
        lastSeenAt: Date.now(),
      });
      const base64 = await blobToBase64(resized);
      void emit({
        kind: "avatar",
        from: self,
        avatar: { base64, type: resized.type },
      });
      void registerProfile(self, resized);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't process image");
    }
  }

  async function removePhoto() {
    if (!me) return;
    await db.users.put({
      id: self,
      email: me.email,
      displayName: me.displayName,
      avatarUrl: null,
      avatarBlob: undefined,
      lastSeenAt: Date.now(),
    });
    void emit({ kind: "avatar", from: self, avatar: null });
    void registerProfile(self, null);
  }

  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Profile</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={handlePhotoFile}
        />

        {/* 1. Profile — big and visual */}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <button
              type="button"
              onClick={openFilePicker}
              className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              aria-label="Change profile photo"
            >
              <Avatar phone={self} size={112} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <Camera className="size-7 text-white" />
              </span>
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-mono text-base">{self}</span>
              <span className="text-xs text-zinc-500">Signed in</span>
            </div>
            {photoError && (
              <p className="text-xs text-red-500">{photoError}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={openFilePicker} variant="outline" size="sm">
                <Camera className="size-4" />
                {me?.avatarBlob ? "Change photo" : "Add photo"}
              </Button>
              {me?.avatarBlob && (
                <Button onClick={removePhoto} variant="ghost" size="sm">
                  Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Quick rows — Local data, Admin, About */}
        <Card>
          <CardContent className="flex flex-col p-0">
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="flex items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <Trash2 className="size-4 text-zinc-500" />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">Clear local data</span>
                <span className="text-xs text-zinc-500">
                  Wipes messages, voice notes, and photos on this device
                </span>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </button>

            <Link
              href="/demo/admin"
              className="flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <Shield className="size-4 text-indigo-600" />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">Admin dashboard</span>
                <span className="text-xs text-zinc-500">
                  See every user that has signed in to CommApp
                </span>
              </div>
              <ChevronRight className="size-4 text-zinc-400" />
            </Link>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <Info className="size-4 text-zinc-500" />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">About CommApp</span>
                  <span className="text-xs text-zinc-500">
                    Version, transport, and credits
                  </span>
                </div>
                <ChevronRight className="size-4 text-zinc-400 transition-transform group-open:rotate-90" />
              </summary>
              <div className="flex flex-col gap-3 border-t bg-zinc-50/60 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
                <div className="flex items-center gap-3">
                  <Logo size={36} />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      CommApp
                    </span>
                    <span className="text-xs">version {VERSION}</span>
                  </div>
                </div>
                <p>
                  Cross-device messaging and audio/video calls between dummy
                  numbers. Demo OTP is{" "}
                  <span className="font-mono">1234</span>; any phone number
                  works.
                </p>
                <p>
                  Messaging + WebRTC signaling uses Supabase Realtime;
                  per-device storage in{" "}
                  <span className="font-mono">IndexedDB</span> via Dexie.
                  Whisper-tiny transcribes voice notes locally; WebRTC calls
                  fall through public STUN servers.
                </p>
              </div>
            </details>
          </CardContent>
        </Card>

        {/* Inline confirm for clear data */}
        {confirmingClear && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
            <CardContent className="flex flex-col gap-3 py-4">
              <p className="text-sm">
                Delete all messages, voice notes, profile photos, and
                embeddings on this device? This can&apos;t be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={clearAllData}>
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
            </CardContent>
          </Card>
        )}

        {/* 3. Sign out as the last, prominent action */}
        <Button
          onClick={signOut}
          variant="outline"
          className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </main>
  );
}
