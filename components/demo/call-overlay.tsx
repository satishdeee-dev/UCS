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

  const isVideo =
    state.phase !== "idle" && state.kind === "video";

  async function toggleSpeaker() {
    const audio = remoteAudioRef.current as SinkableAudio | null;
    const next = !speakerOn;
    setSpeakerOn(next);
    if (!audio) return;
    // Best-effort routing: setSinkId is supported in Chromium and recent
    // Firefox; iOS Safari ignores it. We at least swap volume so the user
    // gets a tangible difference even when the API isn't available.
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

  // Attach remote stream to the right element.
  useEffect(() => {
    if (!remoteStream) return;
    const target = isVideo ? remoteVideoRef.current : remoteAudioRef.current;
    if (!target) return;
    target.srcObject = remoteStream;
    target.play().catch((err) => {
      console.warn("Remote stream play blocked", err);
    });
  }, [remoteStream, isVideo]);

  // Attach local stream to the picture-in-picture video.
  useEffect(() => {
    if (!isVideo || !localStream || !localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream;
    localVideoRef.current.play().catch(() => {});
  }, [localStream, isVideo]);

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
  const statusLabel =
    state.phase === "outgoing"
      ? `Calling… (${state.kind})`
      : state.phase === "incoming"
        ? `Incoming ${state.kind} call`
        : remoteStream
          ? durationLabel
          : "Connecting…";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {isVideo ? (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full bg-zinc-900 object-cover"
          />
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
              <div className="flex flex-col items-center gap-3">
                <Avatar phone={peer} size={96} />
                <span className="font-mono text-lg">{peer}</span>
                <span className="text-sm text-zinc-400">{statusLabel}</span>
              </div>
            </div>
          )}
          {localStream && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-24 right-4 h-32 w-24 rounded-lg border border-white/10 bg-black object-cover shadow-lg sm:h-48 sm:w-36"
            />
          )}
          <header className="relative z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-4">
            <div className="flex flex-col">
              <span className="font-mono text-base">{peer}</span>
              <span className="text-xs text-zinc-300">{statusLabel}</span>
            </div>
          </header>
          <div className="mt-auto" />
          <CallControls
            phase={state.phase}
            muted={state.phase === "active" ? state.muted : false}
            cameraOff={state.phase === "active" ? state.cameraOff : false}
            isVideo
            speakerOn={speakerOn}
            onAccept={accept}
            onDecline={decline}
            onHangup={hangup}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleSpeaker={toggleSpeaker}
          />
        </>
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <Avatar phone={peer} size={112} />
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-lg">{peer}</span>
              <span className="text-sm text-zinc-400">{statusLabel}</span>
            </div>
          </div>
          <CallControls
            phase={state.phase}
            muted={state.phase === "active" ? state.muted : false}
            cameraOff={false}
            isVideo={false}
            speakerOn={speakerOn}
            onAccept={accept}
            onDecline={decline}
            onHangup={hangup}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleSpeaker={toggleSpeaker}
          />
        </>
      )}
    </div>
  );
}

interface ControlsProps {
  phase: "outgoing" | "incoming" | "active";
  muted: boolean;
  cameraOff: boolean;
  isVideo: boolean;
  speakerOn: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
}

function CallControls({
  phase,
  muted,
  cameraOff,
  isVideo,
  speakerOn,
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
}: ControlsProps) {
  return (
    <div className="relative z-10 flex items-center justify-center gap-6 bg-gradient-to-t from-black/80 to-transparent px-6 pb-10 pt-8">
      {phase === "incoming" ? (
        <>
          <button
            onClick={onDecline}
            className="flex size-16 items-center justify-center rounded-full bg-red-600 transition-transform hover:scale-105"
            aria-label="Decline call"
          >
            <PhoneOff className="size-6" />
          </button>
          <button
            onClick={onAccept}
            className="flex size-16 items-center justify-center rounded-full bg-emerald-500 transition-transform hover:scale-105"
            aria-label="Accept call"
          >
            <Phone className="size-6" />
          </button>
        </>
      ) : (
        <>
          {phase === "active" && (
            <Button
              onClick={onToggleMute}
              variant="secondary"
              size="icon"
              className="size-14 rounded-full"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
          )}
          {phase === "active" && !isVideo && (
            <Button
              onClick={onToggleSpeaker}
              variant="secondary"
              size="icon"
              className="size-14 rounded-full"
              aria-label={speakerOn ? "Speaker off" : "Speaker on"}
              aria-pressed={speakerOn}
            >
              {speakerOn ? (
                <Volume2 className="size-5" />
              ) : (
                <VolumeX className="size-5" />
              )}
            </Button>
          )}
          {phase === "active" && isVideo && (
            <Button
              onClick={onToggleCamera}
              variant="secondary"
              size="icon"
              className="size-14 rounded-full"
              aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
            >
              {cameraOff ? (
                <VideoOff className="size-5" />
              ) : (
                <Video className="size-5" />
              )}
            </Button>
          )}
          <button
            onClick={onHangup}
            className="flex size-16 items-center justify-center rounded-full bg-red-600 transition-transform hover:scale-105"
            aria-label="Hang up"
          >
            <PhoneOff className="size-6" />
          </button>
        </>
      )}
    </div>
  );
}
