"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PhoneMissed,
  Video,
  Phone as PhoneIcon,
} from "lucide-react";
import { db, type LocalCallRecord } from "@/lib/db";
import { Avatar } from "./avatar";

interface Props {
  onOpenChat: (peer: string) => void;
}

export function CallsView({ onOpenChat }: Props) {
  const calls = useLiveQuery(
    () => db.callHistory.orderBy("startedAt").reverse().toArray(),
    [],
  );

  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Calls</h1>
        {calls && calls.length > 0 && (
          <span className="ml-auto text-xs text-zinc-500">
            {calls.length} record{calls.length === 1 ? "" : "s"}
          </span>
        )}
      </header>

      <ul className="flex flex-1 flex-col overflow-y-auto">
        {!calls && (
          <li className="px-4 py-12 text-center text-sm text-zinc-500">Loading…</li>
        )}
        {calls && calls.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-zinc-500">
            No call history yet. Start a call from any chat.
          </li>
        )}
        {calls?.map((call) => (
          <CallRow
            key={call.id}
            call={call}
            onClick={() => onOpenChat(call.peer)}
          />
        ))}
      </ul>
    </main>
  );
}

function CallRow({
  call,
  onClick,
}: {
  call: LocalCallRecord;
  onClick: () => void;
}) {
  const missed = !call.connected;
  const seconds = call.connected
    ? Math.max(1, Math.floor((call.endedAt - call.startedAt) / 1000))
    : 0;
  const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const time = new Date(call.startedAt).toLocaleString();

  const directionIcon = missed ? (
    <PhoneMissed className="size-3.5 text-red-500" />
  ) : call.direction === "outgoing" ? (
    <ArrowUpRight className="size-3.5 text-emerald-600" />
  ) : (
    <ArrowDownLeft className="size-3.5 text-emerald-600" />
  );

  const mediaIcon =
    call.mediaKind === "video" ? (
      <Video className="size-4 text-zinc-500" />
    ) : (
      <PhoneIcon className="size-4 text-zinc-500" />
    );

  const subline = missed
    ? call.direction === "outgoing"
      ? "Not answered"
      : "Missed call"
    : duration;

  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30"
      >
        <Avatar phone={call.peer} size={40} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate font-mono text-sm ${missed ? "text-red-600 dark:text-red-400" : ""}`}>
            {call.peer}
          </span>
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            {directionIcon}
            <span>{subline}</span>
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-zinc-400">{time}</span>
          {mediaIcon}
        </div>
      </button>
    </li>
  );
}
