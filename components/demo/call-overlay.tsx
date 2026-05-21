"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "./avatar";
import { useCall } from "./call-provider";

type SinkableAudio = HTMLAudioElement & {
  setSinkId?: (id: string) => Promise<void>;
};

export function CallOverlay() {
  const {
    state,
    localStream,
    remoteStream,
    accept,
    decline,
    hangup,
    toggleMute,
    toggleCamera,
  } = useCall();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);

  const isVideo = state.phase !== "idle" && state.kind === "video";

  // Attach the remote stream to the matching element.
  useEffect(() => {
    if (!remoteStream) return;
    const target = isVideo ? remoteVideoRef.current : remoteAudioRef.current;
    if (!target) return;
    target.srcObject = remoteStream;
    target.play().catch((err) => {
      console.warn("Remote stream play blocked", err);
    });
  }, [remoteStream, isVideo]);

  // PiP local video preview.
  useEffect(() => {
    if (!isVideo || !localStream || !localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream;
    localVideoRef.current.play().catch(() => {});
  }, [localStream, isVideo]);

  // Duration ticker.
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

  async function toggleSpeaker() {
    const audio = remoteAudioRef.current as SinkableAudio | null;
    const next = !speakerOn;
    setSpeakerOn(next);
    if (!audio) return;
    audio.volume = next ? 1 : 0.4;
    if (!audio.setSinkId) return;
    try {
      if (next) {
        await audio.setSinkId("");
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const earpiece = devices.find(
        (d) =>
          d.kind === "audiooutput" &&
          /earpiece|receiver|handset/i.test(d.label),
      );
      if (earpiece) await audio.setSinkId(earpiece.deviceId);
    } catch (err) {
      console.warn("setSinkId failed", err);
    }
  }

  if (state.phase === "idle") return null;

  const peer = state.peer;
  const seconds = Math.floor(elapsed / 1000);
  const durationLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  // Backdrop gradient varies by phase so users can read the situation at
  // a glance from peripheral vision — emerald for "someone wants you",
  // sky for "calling out", neutral dark once you're talking.
  const backdropClass =
    state.phase === "incoming"
      ? "bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(34,211,238,0.18),_transparent_55%),#020617]"
      : state.phase === "outgoing"
        ? "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.18),_transparent_55%),#020617]"
        : "bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_60%),#020617]";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col text-white ${backdropClass}`}
    >
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {isVideo ? (
        <VideoLayout
          state={state}
          peer={peer}
          remoteStream={remoteStream}
          localStream={localStream}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          durationLabel={durationLabel}
          speakerOn={speakerOn}
          accept={accept}
          decline={decline}
          hangup={hangup}
          toggleMute={toggleMute}
          toggleCamera={toggleCamera}
          toggleSpeaker={toggleSpeaker}
        />
      ) : (
        <AudioLayout
          state={state}
          peer={peer}
          durationLabel={durationLabel}
          speakerOn={speakerOn}
          remoteStream={remoteStream}
          accept={accept}
          decline={decline}
          hangup={hangup}
          toggleMute={toggleMute}
          toggleSpeaker={toggleSpeaker}
        />
      )}
    </div>
  );
}

type CallState = ReturnType<typeof useCall>["state"];

interface SharedProps {
  state: Exclude<CallState, { phase: "idle" }>;
  peer: string;
  durationLabel: string;
  speakerOn: boolean;
  remoteStream: MediaStream | null;
  accept: () => Promise<void>;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

function AudioLayout(props: SharedProps) {
  const { state, peer, durationLabel, remoteStream } = props;
  const ringing = state.phase === "incoming" || state.phase === "outgoing";
  const directionLabel =
    state.phase === "incoming"
      ? "Incoming voice call"
      : state.phase === "outgoing"
        ? "Calling…"
        : remoteStream
          ? "On call"
          : "Connecting…";

  return (
    <>
      {/* Header with the big, breathless status badge */}
      <header className="relative z-10 flex items-center justify-center px-6 pb-2 pt-12">
        <StatusBadge phase={state.phase} kind="audio" />
      </header>

      {/* Avatar + name */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <AvatarStage peer={peer} ringing={ringing} phase={state.phase} />
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-3xl font-semibold">{peer}</span>
          <span className="text-sm text-zinc-300">
            {state.phase === "active" && remoteStream
              ? `🎧 ${directionLabel} · ${durationLabel}`
              : directionLabel}
            {state.phase === "outgoing" && <AnimatedDots />}
          </span>
        </div>
      </div>

      {/* Controls */}
      <Controls {...props} isVideo={false} />
    </>
  );
}

function VideoLayout({
  remoteVideoRef,
  localVideoRef,
  ...props
}: SharedProps & {
  localStream: MediaStream | null;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  toggleCamera: () => void;
}) {
  const { state, peer, durationLabel, localStream, remoteStream } = props;
  const ringing = state.phase === "incoming" || state.phase === "outgoing";
  const directionLabel =
    state.phase === "incoming"
      ? "Incoming video call"
      : state.phase === "outgoing"
        ? "Calling…"
        : remoteStream
          ? "On call"
          : "Connecting…";

  return (
    <>
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 h-full w-full bg-zinc-950 object-cover"
      />

      {/* Pre-connection overlay — caller portrait with rings */}
      {!remoteStream && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-zinc-950/85 px-6">
          <StatusBadge phase={state.phase} kind="video" />
          <AvatarStage peer={peer} ringing={ringing} phase={state.phase} />
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-3xl font-semibold">{peer}</span>
            <span className="text-sm text-zinc-300">
              {directionLabel}
              {state.phase === "outgoing" && <AnimatedDots />}
            </span>
          </div>
        </div>
      )}

      {/* PiP local video */}
      {localStream && remoteStream && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-32 right-4 z-20 h-32 w-24 rounded-xl border-2 border-white/20 bg-black object-cover shadow-2xl sm:h-48 sm:w-36"
        />
      )}

      {/* Top status strip when remote is in */}
      {remoteStream && (
        <header className="relative z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-4">
          <div className="flex items-center gap-2">
            <Avatar phone={peer} size={36} />
            <div className="flex flex-col">
              <span className="font-mono text-sm font-semibold">{peer}</span>
              <span className="text-[10px] text-zinc-300">
                🎥 Video · {durationLabel}
              </span>
            </div>
          </div>
        </header>
      )}

      <div className="mt-auto" />
      <Controls {...props} isVideo />
    </>
  );
}

function StatusBadge({
  phase,
  kind,
}: {
  phase: "incoming" | "outgoing" | "active";
  kind: "audio" | "video";
}) {
  if (phase === "incoming") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.3em] text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.35)]">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
        Incoming {kind} call
      </div>
    );
  }
  if (phase === "outgoing") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.3em] text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.35)]">
        <span className="size-1.5 animate-pulse rounded-full bg-sky-400" />
        Outgoing {kind} call
      </div>
    );
  }
  return null;
}

function AvatarStage({
  peer,
  ringing,
  phase,
}: {
  peer: string;
  ringing: boolean;
  phase: "incoming" | "outgoing" | "active";
}) {
  const ringColor =
    phase === "incoming"
      ? "bg-emerald-400/30"
      : phase === "outgoing"
        ? "bg-sky-400/30"
        : "bg-zinc-400/20";
  return (
    <div className="relative flex items-center justify-center">
      {ringing && (
        <>
          <span
            className={`absolute size-44 animate-ping rounded-full ${ringColor}`}
            style={{ animationDuration: "1.8s" }}
            aria-hidden
          />
          <span
            className={`absolute size-56 animate-ping rounded-full ${ringColor}`}
            style={{ animationDuration: "2.4s", animationDelay: "0.6s" }}
            aria-hidden
          />
        </>
      )}
      <div className="relative rounded-full border-4 border-white/10 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <Avatar phone={peer} size={132} />
      </div>
    </div>
  );
}

function AnimatedDots() {
  return (
    <span className="inline-flex">
      <span className="animate-pulse" style={{ animationDelay: "0s" }}>
        .
      </span>
      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>
        .
      </span>
      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>
        .
      </span>
    </span>
  );
}

function Controls({
  state,
  speakerOn,
  isVideo,
  accept,
  decline,
  hangup,
  toggleMute,
  toggleSpeaker,
  toggleCamera,
}: SharedProps & { isVideo: boolean; toggleCamera?: () => void }) {
  if (state.phase === "incoming") {
    return (
      <div className="relative z-10 flex items-center justify-center gap-12 bg-gradient-to-t from-black/80 to-transparent px-6 pb-12 pt-10">
        <CallButton
          label="Decline"
          tone="red"
          icon={<PhoneOff className="size-7" />}
          onClick={decline}
        />
        <CallButton
          label="Accept"
          tone="emerald"
          icon={<Phone className="size-7" />}
          onClick={accept}
        />
      </div>
    );
  }
  return (
    <div className="relative z-10 flex items-center justify-center gap-6 bg-gradient-to-t from-black/80 to-transparent px-6 pb-12 pt-10">
      {state.phase === "active" && (
        <CallButton
          label={state.muted ? "Unmute" : "Mute"}
          tone="muted"
          icon={
            state.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />
          }
          onClick={toggleMute}
          size="medium"
        />
      )}
      {state.phase === "active" && !isVideo && (
        <CallButton
          label={speakerOn ? "Speaker on" : "Earpiece"}
          tone="muted"
          icon={
            speakerOn ? (
              <Volume2 className="size-5" />
            ) : (
              <VolumeX className="size-5" />
            )
          }
          onClick={toggleSpeaker}
          size="medium"
        />
      )}
      {state.phase === "active" && isVideo && toggleCamera && (
        <CallButton
          label={state.cameraOff ? "Camera on" : "Camera off"}
          tone="muted"
          icon={
            state.cameraOff ? (
              <VideoOff className="size-5" />
            ) : (
              <Video className="size-5" />
            )
          }
          onClick={toggleCamera}
          size="medium"
        />
      )}
      <CallButton
        label="End call"
        tone="red"
        icon={<PhoneOff className="size-7" />}
        onClick={hangup}
      />
    </div>
  );
}

function CallButton({
  label,
  icon,
  tone,
  onClick,
  size = "large",
}: {
  label: string;
  icon: React.ReactNode;
  tone: "emerald" | "red" | "muted";
  onClick: () => void;
  size?: "large" | "medium";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_32px_rgba(16,185,129,0.55)]"
      : tone === "red"
        ? "bg-red-600 hover:bg-red-500 shadow-[0_0_32px_rgba(239,68,68,0.55)]"
        : "bg-white/15 hover:bg-white/25 backdrop-blur";
  const sizeClass =
    size === "large" ? "size-16 sm:size-20" : "size-14";

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`${sizeClass} rounded-full text-white transition-all hover:scale-105 ${toneClass}`}
      >
        {icon}
      </Button>
      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-300">
        {label}
      </span>
    </div>
  );
}
