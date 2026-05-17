"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Common = {
  createdAt: number;
  outgoing: boolean;
};

export type BubbleProps =
  | (Common & { kind: "text"; body: string })
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
    ? "rounded-br-sm bg-emerald-600 text-white"
    : "rounded-bl-sm bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

  const timeClass = props.outgoing ? "text-emerald-100" : "text-zinc-500";

  return (
    <div className={`flex ${props.outgoing ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${bubbleClass}`}>
        {props.kind === "text" ? (
          <p className="whitespace-pre-wrap break-words text-sm">{props.body}</p>
        ) : (
          <VoiceContent
            audioBlob={props.audioBlob}
            transcript={props.transcript}
            outgoing={props.outgoing}
          />
        )}
        <div className={`mt-1 text-[10px] ${timeClass}`}>{time}</div>
      </div>
    </div>
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

  const captionClass = outgoing ? "text-emerald-100" : "text-zinc-500";

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
