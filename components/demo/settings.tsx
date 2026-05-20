"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Bell,
  Camera,
  ChevronRight,
  Database,
  Eye,
  HelpCircle,
  Info,
  LogOut,
  MessageSquare,
  Shield,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db, type LocalMessage } from "@/lib/db";
import { clearIdentity } from "@/lib/demo/identity";
import { blobToBase64, formatBytes } from "@/lib/demo/encoding";
import { resizeImageToJpeg } from "@/lib/demo/image";
import {
  DEFAULT_PREFERENCES,
  usePreferences,
  type Preferences,
} from "@/lib/demo/preferences";
import { registerProfile } from "@/lib/demo/profiles";
import { emit } from "@/lib/demo/transport";
import { Avatar } from "./avatar";
import { Logo } from "./logo";

interface Props {
  self: string;
  onSignedOut: () => void;
}

type Section =
  | "main"
  | "privacy"
  | "notifications"
  | "chats"
  | "starred"
  | "storage"
  | "help";

const VERSION = "1.0 — demo";

export function Settings({ self, onSignedOut }: Props) {
  const [section, setSection] = useState<Section>("main");

  if (section === "privacy")
    return <PrivacySection onBack={() => setSection("main")} />;
  if (section === "notifications")
    return <NotificationsSection onBack={() => setSection("main")} />;
  if (section === "chats")
    return <ChatsSection onBack={() => setSection("main")} />;
  if (section === "starred")
    return <StarredSection self={self} onBack={() => setSection("main")} />;
  if (section === "storage")
    return <StorageSection onBack={() => setSection("main")} />;
  if (section === "help") return <HelpSection onBack={() => setSection("main")} />;

  return (
    <MainSection
      self={self}
      onSignedOut={onSignedOut}
      onNavigate={setSection}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Main section
// ───────────────────────────────────────────────────────────────────────────────

function MainSection({
  self,
  onSignedOut,
  onNavigate,
}: {
  self: string;
  onSignedOut: () => void;
  onNavigate: (s: Section) => void;
}) {
  const me = useLiveQuery(() => db.users.get(self), [self]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
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
    if (file.size > 10 * 1024 * 1024) {
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
      void emit({ kind: "avatar", from: self, avatar: { base64, type: resized.type } });
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

        {/* Profile */}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <button
              type="button"
              onClick={openFilePicker}
              className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
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
            {photoError && <p className="text-xs text-red-500">{photoError}</p>}
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

        {/* Section rows */}
        <Card>
          <CardContent className="flex flex-col p-0">
            <NavRow
              icon={<Shield className="size-4 text-amber-500" />}
              label="Privacy"
              description="Last seen, read receipts, online status"
              onClick={() => onNavigate("privacy")}
            />
            <NavRow
              icon={<Bell className="size-4 text-amber-500" />}
              label="Notifications"
              description="Sounds, previews, calls"
              onClick={() => onNavigate("notifications")}
            />
            <NavRow
              icon={<MessageSquare className="size-4 text-amber-500" />}
              label="Chats"
              description="Send behaviour, font size, auto-download"
              onClick={() => onNavigate("chats")}
            />
            <NavRow
              icon={<Star className="size-4 text-amber-500" />}
              label="Starred messages"
              description="Saved across every conversation"
              onClick={() => onNavigate("starred")}
            />
            <NavRow
              icon={<Database className="size-4 text-amber-500" />}
              label="Storage and data"
              description="Local cache usage and management"
              onClick={() => onNavigate("storage")}
            />
            <NavRow
              icon={<HelpCircle className="size-4 text-amber-500" />}
              label="Help"
              description="FAQ and demo info"
              onClick={() => onNavigate("help")}
            />
          </CardContent>
        </Card>

        {/* Danger / quick actions */}
        <Card>
          <CardContent className="flex flex-col p-0">
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
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
          </CardContent>
        </Card>

        {confirmingClear && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
            <CardContent className="flex flex-col gap-3 py-4">
              <p className="text-sm">
                Delete all messages, voice notes, profile photos, and embeddings
                on this device? This can&apos;t be undone.
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

// ───────────────────────────────────────────────────────────────────────────────
// Reusable bits
// ───────────────────────────────────────────────────────────────────────────────

function SectionShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {children}
      </div>
    </main>
  );
}

function NavRow({
  icon,
  label,
  description,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      {icon}
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-zinc-500">{description}</span>
      </div>
      <ChevronRight className="size-4 text-zinc-400" />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <span className="text-xs text-zinc-500">{description}</span>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked
          ? "bg-amber-500"
          : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[1.4rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SelectRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <span className="text-xs text-zinc-500">{description}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              value === opt.value
                ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Privacy
// ───────────────────────────────────────────────────────────────────────────────

function PrivacySection({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = usePreferences();
  return (
    <SectionShell title="Privacy" onBack={onBack}>
      <Card>
        <CardContent className="flex flex-col p-0">
          <ToggleRow
            label="Last seen"
            description="Show when you were last online"
            checked={prefs.showLastSeen}
            onChange={(v) => setPrefs({ showLastSeen: v })}
          />
          <ToggleRow
            label="Online status"
            description="Show a green dot to people in your chats"
            checked={prefs.showOnlineStatus}
            onChange={(v) => setPrefs({ showOnlineStatus: v })}
          />
          <ToggleRow
            label="Read receipts"
            description="If off, you won't see them either"
            checked={prefs.showReadReceipts}
            onChange={(v) => setPrefs({ showReadReceipts: v })}
          />
          <ToggleRow
            label="Profile photo"
            description="Visible to the people you chat with"
            checked={prefs.showProfilePhoto}
            onChange={(v) => setPrefs({ showProfilePhoto: v })}
          />
        </CardContent>
      </Card>
      <p className="px-2 text-xs text-zinc-500">
        Demo: these toggles persist locally but aren&apos;t enforced
        cross-device. Wiring them into the protocol would need real auth
        + per-relationship policies.
      </p>
    </SectionShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Notifications
// ───────────────────────────────────────────────────────────────────────────────

function NotificationsSection({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = usePreferences();
  return (
    <SectionShell title="Notifications" onBack={onBack}>
      <Card>
        <CardContent className="flex flex-col p-0">
          <span className="border-b px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Messages
          </span>
          <ToggleRow
            label="Show notifications"
            description="OS notifications when a new message arrives"
            checked={prefs.messageNotifications}
            onChange={(v) => setPrefs({ messageNotifications: v })}
          />
          <ToggleRow
            label="Sound"
            description="Play the chime tone on inbound messages"
            checked={prefs.messageSound}
            onChange={(v) => setPrefs({ messageSound: v })}
          />
          <ToggleRow
            label="Show preview"
            description="Display message text in the notification"
            checked={prefs.showNotifPreview}
            onChange={(v) => setPrefs({ showNotifPreview: v })}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col p-0">
          <span className="border-b px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Calls
          </span>
          <ToggleRow
            label="Call notifications"
            description="Show incoming-call screen and OS notification"
            checked={prefs.callNotifications}
            onChange={(v) => setPrefs({ callNotifications: v })}
          />
          <ToggleRow
            label="Ringtone"
            description="Repeating two-tone ring for incoming calls"
            checked={prefs.callRingtone}
            onChange={(v) => setPrefs({ callRingtone: v })}
          />
        </CardContent>
      </Card>
    </SectionShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Chats
// ───────────────────────────────────────────────────────────────────────────────

function ChatsSection({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = usePreferences();
  return (
    <SectionShell title="Chats" onBack={onBack}>
      <Card>
        <CardContent className="flex flex-col p-0">
          <ToggleRow
            label="Enter to send"
            description="Pressing Enter sends instead of inserting a newline"
            checked={prefs.enterToSend}
            onChange={(v) => setPrefs({ enterToSend: v })}
          />
          <SelectRow
            label="Font size"
            description="Applies to message bubbles"
            value={prefs.fontSize}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
            onChange={(v) => setPrefs({ fontSize: v })}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col p-0">
          <span className="border-b px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Media auto-download
          </span>
          <SelectRow
            label="Photos"
            description="When to auto-download inbound images"
            value={prefs.autoDownloadImages}
            options={[
              { value: "always", label: "Always" },
              { value: "wifi", label: "Wi-Fi only" },
              { value: "never", label: "Never" },
            ]}
            onChange={(v) => setPrefs({ autoDownloadImages: v })}
          />
          <SelectRow
            label="Documents"
            description="When to auto-download inbound files"
            value={prefs.autoDownloadDocs}
            options={[
              { value: "always", label: "Always" },
              { value: "wifi", label: "Wi-Fi only" },
              { value: "never", label: "Never" },
            ]}
            onChange={(v) => setPrefs({ autoDownloadDocs: v })}
          />
        </CardContent>
      </Card>
      <p className="px-2 text-xs text-zinc-500">
        Font size and Enter-to-send are wired into the composer. Media
        auto-download is a UI placeholder — the demo currently delivers
        everything inline.
      </p>
    </SectionShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Starred
// ───────────────────────────────────────────────────────────────────────────────

function StarredSection({
  self,
  onBack,
}: {
  self: string;
  onBack: () => void;
}) {
  const starred = useLiveQuery(
    async () => {
      const rows = await db.messages.toArray();
      return rows
        .filter((m) => m.starred)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    [],
  );

  async function unstar(id: string) {
    await db.messages.update(id, { starred: false });
  }

  return (
    <SectionShell title="Starred messages" onBack={onBack}>
      {!starred || starred.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
          <Star className="size-10 text-zinc-300 dark:text-zinc-700" />
          <p className="text-sm text-zinc-500">No starred messages yet.</p>
          <p className="px-6 text-xs text-zinc-400">
            Hover a message in any chat and tap the ⭐ button to keep it here.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col p-0">
            {starred.map((m) => (
              <StarredRow
                key={m.id}
                message={m}
                self={self}
                onUnstar={() => unstar(m.id)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </SectionShell>
  );
}

function StarredRow({
  message,
  self,
  onUnstar,
}: {
  message: LocalMessage;
  self: string;
  onUnstar: () => void;
}) {
  const isOutgoing = message.senderId === self;
  const preview = message.location
    ? "📍 Location"
    : message.attachment
      ? message.attachment.type.startsWith("image/")
        ? "📷 Photo"
        : `📎 ${message.attachment.name}`
      : message.body || "(empty message)";
  const when = new Date(message.createdAt).toLocaleString();
  return (
    <div className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
      <Star className="mt-0.5 size-4 shrink-0 fill-amber-400 text-amber-500" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="font-mono">
            {isOutgoing ? "You" : message.senderId}
          </span>
          <span>·</span>
          <span>{when}</span>
        </div>
        <p className="break-words text-sm">{preview}</p>
      </div>
      <Button onClick={onUnstar} variant="ghost" size="sm">
        Unstar
      </Button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Storage
// ───────────────────────────────────────────────────────────────────────────────

function StorageSection({ onBack }: { onBack: () => void }) {
  const stats = useLiveQuery(async () => {
    const [msgs, vns, groups, users, calls] = await Promise.all([
      db.messages.toArray(),
      db.voiceNotes.toArray(),
      db.groups.toArray(),
      db.users.toArray(),
      db.callHistory.toArray(),
    ]);
    const imageBytes = msgs
      .filter((m) => m.attachment?.type.startsWith("image/"))
      .reduce((sum, m) => sum + (m.attachment?.size ?? 0), 0);
    const docBytes = msgs
      .filter(
        (m) =>
          m.attachment && !m.attachment.type.startsWith("image/"),
      )
      .reduce((sum, m) => sum + (m.attachment?.size ?? 0), 0);
    const voiceBytes = vns.reduce((sum, v) => sum + v.audioBlob.size, 0);
    return {
      messages: msgs.length,
      images: msgs.filter((m) => m.attachment?.type.startsWith("image/")).length,
      docs: msgs.filter(
        (m) => m.attachment && !m.attachment.type.startsWith("image/"),
      ).length,
      voiceNotes: vns.length,
      groups: groups.length,
      users: users.length,
      calls: calls.length,
      imageBytes,
      docBytes,
      voiceBytes,
    };
  }, []);

  if (!stats) {
    return (
      <SectionShell title="Storage and data" onBack={onBack}>
        <p className="text-sm text-zinc-500">Loading…</p>
      </SectionShell>
    );
  }

  const total = stats.imageBytes + stats.docBytes + stats.voiceBytes;

  return (
    <SectionShell title="Storage and data" onBack={onBack}>
      <Card>
        <CardContent className="flex flex-col gap-1 py-5">
          <span className="text-xs text-zinc-500">Total media on device</span>
          <span className="text-3xl font-semibold tabular-nums">
            {formatBytes(total)}
          </span>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col p-0">
          <StatRow label="📷 Photos" count={stats.images} bytes={stats.imageBytes} />
          <StatRow label="📎 Documents" count={stats.docs} bytes={stats.docBytes} />
          <StatRow label="🎤 Voice notes" count={stats.voiceNotes} bytes={stats.voiceBytes} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col p-0">
          <CountRow label="Text messages" count={stats.messages} />
          <CountRow label="Groups" count={stats.groups} />
          <CountRow label="Known users" count={stats.users} />
          <CountRow label="Call history" count={stats.calls} />
        </CardContent>
      </Card>
      <p className="px-2 text-xs text-zinc-500">
        Browsers don&apos;t expose a precise IndexedDB byte count, so this
        adds the sizes of every Blob we store. The actual on-disk footprint
        will be slightly higher because of database overhead.
      </p>
    </SectionShell>
  );
}

function StatRow({
  label,
  count,
  bytes,
}: {
  label: string;
  count: number;
  bytes: number;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-xs text-zinc-500">{count}</span>
      <span className="w-20 text-right font-mono text-xs tabular-nums">
        {formatBytes(bytes)}
      </span>
    </div>
  );
}

function CountRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <span className="flex-1 text-sm">{label}</span>
      <span className="font-mono text-xs tabular-nums">{count}</span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Help / About
// ───────────────────────────────────────────────────────────────────────────────

function HelpSection({ onBack }: { onBack: () => void }) {
  const [prefs] = usePreferences();
  // useMemo prevents needless work + makes the preferences dump cheap.
  const prefsBlob = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(prefs).filter(
          ([k]) => k in DEFAULT_PREFERENCES,
        ),
      ),
    [prefs],
  );
  return (
    <SectionShell title="Help" onBack={onBack}>
      <Card>
        <CardContent className="flex items-center gap-3 py-5">
          <Logo size={56} />
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight">CommApp</span>
            <span className="text-xs text-zinc-500">version {VERSION}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 text-sm text-zinc-700 dark:text-zinc-300">
          <Faq
            q="What's the demo OTP?"
            a={
              <>
                <span className="font-mono">1234</span>. Any phone number works
                — there&apos;s no real SMS in the demo.
              </>
            }
          />
          <Faq
            q="How do messages reach the other phone?"
            a="Each device subscribes to a shared Supabase Realtime broadcast channel. Sends fire one event per recipient; recipients persist locally in Dexie."
          />
          <Faq
            q="Why didn't my call connect?"
            a="WebRTC needs both peers on the same network or both with internet so a STUN-based path can be discovered. We don't run a TURN server, so symmetric-NAT pairs may fail."
          />
          <Faq
            q="Where do voice notes live?"
            a="They're stored as Blobs in your browser's IndexedDB. They also stream as base64 over Realtime so other devices can play them back."
          />
          <Faq
            q="Is anything end-to-end encrypted?"
            a="Web Push payloads are E2E-encrypted by the browser. Realtime broadcasts are TLS-in-transit but readable on the server. Storage at rest is in plaintext — this is a demo."
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Your current settings
          </span>
          <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-[10px] dark:bg-zinc-900">
            {JSON.stringify(prefsBlob, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </SectionShell>
  );
}

function Faq({ q, a }: { q: string; a: ReactNode }) {
  return (
    <details className="group rounded-md border px-3 py-2 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Info className="size-3.5 text-amber-500" />
          {q}
        </span>
        <ChevronRight className="size-3.5 text-zinc-400 transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{a}</p>
    </details>
  );
}

// Re-export for callers that need the preferences shape.
export type { Preferences };
