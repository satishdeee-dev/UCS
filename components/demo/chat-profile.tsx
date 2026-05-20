"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Download, ExternalLink, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { db, isGroupId, type LocalAttachment, type LocalMessage } from "@/lib/db";
import { conversationIdFor } from "@/lib/demo/conversations";
import { formatBytes } from "@/lib/demo/encoding";
import {
  WALLPAPERS,
  readWallpaper,
  useWallpaper,
  writeWallpaper,
  type WallpaperId,
} from "@/lib/demo/wallpapers";
import { Avatar } from "./avatar";

interface Props {
  self: string;
  target: string; // peer phone OR group id
  onBack: () => void;
}

const URL_REGEX = /https?:\/\/[^\s]+/gi;

export function ChatProfile({ self, target, onBack }: Props) {
  const isGroup = isGroupId(target);
  const conversationId = isGroup ? target : conversationIdFor(self, target);

  const group = useLiveQuery(
    async () => (isGroup ? await db.groups.get(target) : undefined),
    [target, isGroup],
  );

  const messages = useLiveQuery<LocalMessage[]>(
    () => db.messages.where("conversationId").equals(conversationId).toArray(),
    [conversationId],
  );

  const { mediaItems, docItems, linkItems } = useMemo(() => {
    const media: { id: string; attachment: LocalAttachment }[] = [];
    const docs: { id: string; attachment: LocalAttachment; senderId: string; createdAt: number }[] = [];
    const links: { id: string; url: string; senderId: string; createdAt: number }[] = [];

    for (const m of messages ?? []) {
      if (m.attachment) {
        if (m.attachment.type.startsWith("image/")) {
          media.push({ id: m.id, attachment: m.attachment });
        } else {
          docs.push({
            id: m.id,
            attachment: m.attachment,
            senderId: m.senderId,
            createdAt: m.createdAt,
          });
        }
      }
      if (m.body) {
        const found = m.body.match(URL_REGEX);
        if (found) {
          for (const url of found) {
            links.push({
              id: `${m.id}:${url}`,
              url,
              senderId: m.senderId,
              createdAt: m.createdAt,
            });
          }
        }
      }
    }
    media.sort((a, b) => {
      const ma = messages?.find((m) => m.id === a.id)?.createdAt ?? 0;
      const mb = messages?.find((m) => m.id === b.id)?.createdAt ?? 0;
      return mb - ma;
    });
    docs.sort((a, b) => b.createdAt - a.createdAt);
    links.sort((a, b) => b.createdAt - a.createdAt);

    return { mediaItems: media, docItems: docs, linkItems: links };
  }, [messages]);

  const wallpaper = useWallpaper(conversationId);

  function setWp(id: WallpaperId) {
    writeWallpaper(conversationId, id);
  }

  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-base font-semibold tracking-tight">
          {isGroup ? "Group info" : "Contact info"}
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Identity card */}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            {isGroup ? (
              <div className="flex size-24 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200">
                <Users className="size-10" />
              </div>
            ) : (
              <Avatar phone={target} size={96} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-lg font-semibold">
                {isGroup ? (group?.name ?? "Group") : target}
              </span>
              {isGroup ? (
                <span className="text-xs text-zinc-500">
                  {group ? `${group.members.length} members` : ""}
                </span>
              ) : (
                <span className="text-xs text-zinc-500">offline-first peer</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members (group only) */}
        {isGroup && group && (
          <Card>
            <CardHeader>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Members
              </span>
            </CardHeader>
            <CardContent className="flex flex-col">
              {group.members.map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-3 border-t py-2 first:border-t-0"
                >
                  <Avatar phone={m} size={36} />
                  <span className="font-mono text-sm">
                    {m === self ? `${m} (you)` : m}
                  </span>
                  {m === group.createdBy && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/70 dark:text-amber-200">
                      Creator
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Chat theme */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Chat theme
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {WALLPAPERS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setWp(preset.id)}
                  className={`group flex flex-col items-center gap-1 rounded-md border p-2 transition-all ${
                    wallpaper === preset.id
                      ? "border-amber-500 ring-2 ring-amber-500/40"
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                  }`}
                  aria-pressed={wallpaper === preset.id}
                >
                  <span
                    className="block h-12 w-full rounded"
                    style={{ background: preset.thumb }}
                  />
                  <span className="text-[10px]">{preset.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Media */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Media
            </span>
            <span className="text-xs text-zinc-400">{mediaItems.length}</span>
          </CardHeader>
          <CardContent>
            {mediaItems.length === 0 ? (
              <p className="py-2 text-xs text-zinc-500">No photos shared yet.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {mediaItems.slice(0, 12).map((item) => (
                  <MediaThumb key={item.id} attachment={item.attachment} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Links
            </span>
            <span className="text-xs text-zinc-400">{linkItems.length}</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {linkItems.length === 0 ? (
              <p className="py-2 text-xs text-zinc-500">No links shared yet.</p>
            ) : (
              linkItems.slice(0, 20).map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <ExternalLink className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">{l.url}</span>
                </a>
              ))
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Documents
            </span>
            <span className="text-xs text-zinc-400">{docItems.length}</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {docItems.length === 0 ? (
              <p className="py-2 text-xs text-zinc-500">
                No documents shared yet.
              </p>
            ) : (
              docItems
                .slice(0, 20)
                .map((d) => <DocRow key={d.id} attachment={d.attachment} />)
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MediaThumb({ attachment }: { attachment: LocalAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(attachment.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [attachment.blob]);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="aspect-square overflow-hidden rounded"
    >
      <img
        src={url}
        alt={attachment.name}
        className="h-full w-full object-cover"
      />
    </a>
  );
}

function DocRow({ attachment }: { attachment: LocalAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(attachment.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [attachment.blob]);
  return (
    <a
      href={url ?? "#"}
      download={attachment.name}
      className="flex items-center gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <FileText className="size-5 shrink-0 text-zinc-500" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium">{attachment.name}</span>
        <span className="text-[10px] text-zinc-500">
          {formatBytes(attachment.size)}
        </span>
      </div>
      <Download className="size-4 shrink-0 text-zinc-400" />
    </a>
  );
}

// Re-export so callers can prime wallpaper before mount if desired.
export { readWallpaper };
