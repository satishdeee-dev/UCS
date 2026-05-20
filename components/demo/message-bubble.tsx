"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCheck,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Star,
} from "lucide-react";
import type { LocalAttachment, LocalLocation } from "@/lib/db";
import { formatBytes } from "@/lib/demo/encoding";

type Common = {
  createdAt: number;
  outgoing: boolean;
  starred?: boolean;
  onToggleStar?: () => void;
  deliveredAt?: number;
  readAt?: number;
};

export type BubbleProps =
  | (Common & {
      kind: "text";
      body: string;
      attachment?: LocalAttachment;
      location?: LocalLocation;
    })
  | (Common & {
      kind: "voice";
      audioBlob: Blob;
      transcript: string | null;
    });

export function MessageBubble(props: BubbleProps) {
  const time = new Date(props.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bubbleClass = props.outgoing
    ? "rounded-br-sm bg-amber-600 text-white"
    : "rounded-bl-sm bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

  const timeClass = props.outgoing ? "text-amber-100" : "text-zinc-500";

  return (
    <div
      className={`group flex items-end gap-1.5 ${props.outgoing ? "justify-end" : "justify-start"}`}
    >
      {props.outgoing && props.onToggleStar && (
        <StarButton
          starred={!!props.starred}
          onClick={props.onToggleStar}
          align="right"
        />
      )}
      <div className={`relative max-w-[75%] rounded-2xl px-3 py-2 ${bubbleClass}`}>
        {props.starred && (
          <Star
            className="absolute -top-1.5 -right-1.5 size-3.5 fill-amber-400 text-amber-500 drop-shadow"
            aria-label="Starred"
          />
        )}
        {props.kind === "text" ? (
          <div className="flex flex-col gap-2">
            {props.attachment && (
              <AttachmentView
                attachment={props.attachment}
                outgoing={props.outgoing}
              />
            )}
            {props.location && (
              <LocationView
                location={props.location}
                outgoing={props.outgoing}
              />
            )}
            {props.body && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {props.body}
              </p>
            )}
          </div>
        ) : (
          <VoiceContent
            audioBlob={props.audioBlob}
            transcript={props.transcript}
            outgoing={props.outgoing}
          />
        )}
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${timeClass}`}
        >
          <span>{time}</span>
          {props.outgoing && (
            <ReceiptTicks
              deliveredAt={props.deliveredAt}
              readAt={props.readAt}
            />
          )}
        </div>
      </div>
      {!props.outgoing && props.onToggleStar && (
        <StarButton
          starred={!!props.starred}
          onClick={props.onToggleStar}
          align="left"
        />
      )}
    </div>
  );
}

function ReceiptTicks({
  deliveredAt,
  readAt,
}: {
  deliveredAt?: number;
  readAt?: number;
}) {
  // Triple state mirrors WhatsApp:
  // - sent only:        single tick
  // - delivered:        double tick, same colour
  // - read by peer:     double tick, blue
  if (readAt) {
    return (
      <CheckCheck
        className="size-3 text-sky-300"
        aria-label="Read"
      />
    );
  }
  if (deliveredAt) {
    return (
      <CheckCheck
        className="size-3 opacity-70"
        aria-label="Delivered"
      />
    );
  }
  return <Check className="size-3 opacity-70" aria-label="Sent" />;
}

function StarButton({
  starred,
  onClick,
  align,
}: {
  starred: boolean;
  onClick: () => void;
  align: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={starred ? "Unstar message" : "Star message"}
      aria-pressed={starred}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-zinc-200 hover:text-amber-500 dark:hover:bg-zinc-800 ${
        starred
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus:opacity-100"
      } ${align === "left" ? "order-2" : ""}`}
      tabIndex={0}
    >
      <Star
        className={`size-3.5 ${starred ? "fill-amber-400 text-amber-500" : ""}`}
      />
    </button>
  );
}

function AttachmentView({
  attachment,
  outgoing,
}: {
  attachment: LocalAttachment;
  outgoing: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(attachment.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [attachment.blob]);

  const isImage = attachment.type.startsWith("image/");

  if (isImage) {
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-lg"
      >
        <img
          src={url}
          alt={attachment.name}
          className="block max-h-64 w-full object-cover"
        />
      </a>
    ) : null;
  }

  const cardClass = outgoing
    ? "border-white/30 bg-white/10 hover:bg-white/15"
    : "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800";

  return (
    <a
      href={url ?? "#"}
      download={attachment.name}
      className={`flex w-64 items-center gap-3 rounded-md border px-3 py-2 transition-colors ${cardClass}`}
    >
      <FileText className="size-8 shrink-0 opacity-80" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium">{attachment.name}</span>
        <span className="text-[10px] opacity-70">
          {formatBytes(attachment.size)}
        </span>
      </div>
      <Download className="size-4 shrink-0 opacity-80" />
    </a>
  );
}

function LocationView({
  location,
  outgoing,
}: {
  location: LocalLocation;
  outgoing: boolean;
}) {
  const cardClass = outgoing
    ? "border-white/30 bg-white/10 hover:bg-white/15"
    : "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800";

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  const coords = `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  const accuracy =
    location.accuracy && Number.isFinite(location.accuracy)
      ? ` · ±${Math.round(location.accuracy)}m`
      : "";

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      className={`flex w-64 items-center gap-3 rounded-md border px-3 py-2 transition-colors ${cardClass}`}
    >
      <MapPin className="size-7 shrink-0 opacity-80" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium">📍 Location</span>
        <span className="truncate font-mono text-[10px] opacity-80">
          {coords}
          {accuracy}
        </span>
      </div>
      <ExternalLink className="size-4 shrink-0 opacity-80" />
    </a>
  );
}

function VoiceContent({
  audioBlob,
  transcript,
  outgoing,
}: {
  audioBlob: Blob;
  transcript: string | null;
  outgoing: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(audioBlob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [audioBlob]);

  const captionClass = outgoing ? "text-amber-100" : "text-zinc-500";

  return (
    <div className="flex flex-col gap-1">
      {url && (
        <audio
          src={url}
          controls
          preload="metadata"
          className="w-64 max-w-full"
        />
      )}
      <div className={`text-xs ${captionClass}`}>
        {transcript === null ? (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> transcribing…
          </span>
        ) : transcript === "" ? (
          <span className="italic opacity-60">no speech detected</span>
        ) : (
          <span>{transcript}</span>
        )}
      </div>
    </div>
  );
}
