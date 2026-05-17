"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCall } from "./call-provider";

export function CallOverlay() {
  const { state, remoteStream, accept, decline, hangup, toggleMute } = useCall();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch((err) => {
        console.warn("Audio play blocked", err);
      });
    }
  }, [remoteStream]);

  useEffect(() => {
    if (state.phase !== "active") {
      setElapsed(0);
      return;
    }
    const tick = setInterval(() => {
      setElapsed(Date.now() - state.startedAt);
    }, 500);
    return () => clearInterval(tick);
  }, [state]);

  if (state.phase === "idle") return null;

  const peer = state.peer;
  const seconds = Math.floor(elapsed / 1000);
  const durationLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-zinc-900/95 px-6 py-10 text-white backdrop-blur">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div className="flex flex-col items-center gap-4 pt-12">
        <div className="flex size-24 items-center justify-center rounded-full bg-emerald-600 text-2xl font-semibold">
          {peer.slice(-2)}
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-lg">{peer}</span>
          <span className="text-sm text-zinc-400">
            {state.phase === "outgoing" && "Calling…"}
            {state.phase === "incoming" && "Incoming call"}
            {state.phase === "active" &&
              (remoteStream ? durationLabel : "Connecting…")}
          </span>
        </div>
      </div>

      <div className="flex w-full max-w-xs items-center justify-center gap-6 pb-6">
        {state.phase === "incoming" ? (
          <>
            <button
              onClick={decline}
              className="flex size-16 items-center justify-center rounded-full bg-red-600 transition-transform hover:scale-105"
              aria-label="Decline call"
            >
              <PhoneOff className="size-6" />
            </button>
            <button
              onClick={accept}
              className="flex size-16 items-center justify-center rounded-full bg-emerald-500 transition-transform hover:scale-105"
              aria-label="Accept call"
            >
              <Phone className="size-6" />
            </button>
          </>
        ) : (
          <>
            {state.phase === "active" && (
              <Button
                onClick={toggleMute}
                variant="secondary"
                size="icon"
                className="size-14 rounded-full"
                aria-label={state.muted ? "Unmute" : "Mute"}
              >
                {state.muted ? (
                  <MicOff className="size-5" />
                ) : (
                  <Mic className="size-5" />
                )}
              </Button>
            )}
            <button
              onClick={hangup}
              className="flex size-16 items-center justify-center rounded-full bg-red-600 transition-transform hover:scale-105"
              aria-label="Hang up"
            >
              <PhoneOff className="size-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
