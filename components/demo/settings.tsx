"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Camera, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { clearIdentity } from "@/lib/demo/identity";
import { blobToBase64 } from "@/lib/demo/encoding";
import { resizeImageToJpeg } from "@/lib/demo/image";
import { emit } from "@/lib/demo/transport";
import { Avatar } from "./avatar";
import { Logo } from "./logo";

interface Props {
  self: string;
  onBack: () => void;
  onSignedOut: () => void;
}

const VERSION = "0.6 — demo";
const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB raw; resized to 256² JPEG before storing

export function Settings({ self, onBack, onSignedOut }: Props) {
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
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={handlePhotoFile}
        />
        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Profile
            </span>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={openFilePicker}
              className="group relative shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 rounded-full"
              aria-label="Change profile photo"
            >
              <Avatar phone={self} size={96} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <Camera className="size-7 text-white" />
              </span>
            </button>
            <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
              <div className="flex flex-col items-center sm:items-start">
                <span className="text-xs text-zinc-500">Signed in as</span>
                <span className="font-mono text-sm">{self}</span>
              </div>
              {photoError && (
                <p className="text-xs text-red-500">{photoError}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={openFilePicker} variant="outline" size="sm">
                  <Camera className="size-4" />
                  {me?.avatarBlob ? "Change photo" : "Add photo"}
                </Button>
                {me?.avatarBlob && (
                  <Button onClick={removePhoto} variant="ghost" size="sm">
                    Remove
                  </Button>
                )}
                <Button onClick={signOut} variant="ghost" size="sm">
                  <LogOut className="size-4" /> Sign out
                </Button>
              </div>
            </div>
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
              All messages, voice notes, and your profile photo are stored in
              this browser. Clearing wipes them on this device.
            </p>
            {confirmingClear ? (
              <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-sm">
                  This will delete all messages, voice notes, profile photos,
                  and embeddings on this device. It can&apos;t be undone.
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
          <CardHeader className="flex flex-row items-center gap-3">
            <Logo size={40} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">CommApp</span>
              <span className="text-xs text-zinc-500">version {VERSION}</span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Cross-device messaging and audio/video calls between dummy
              numbers. Open CommApp on another phone or tab with a different
              number to chat or call.
            </p>
            <p>
              Demo OTP is <span className="font-mono">1234</span>. Any phone
              number works.
            </p>
            <p>
              Cross-device messaging and WebRTC signaling use Supabase Realtime
              broadcast. Local persistence in{" "}
              <span className="font-mono">IndexedDB</span> via Dexie.
            </p>
            <p>
              Voice transcription runs locally via Whisper-tiny. WebRTC calls
              use multiple public STUN servers; calls between phones on the
              same Wi-Fi network usually connect peer-to-peer.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
