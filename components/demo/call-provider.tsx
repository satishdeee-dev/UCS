"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CallKind = "audio" | "video";

type CallState =
  | { phase: "idle" }
  | { phase: "outgoing"; peer: string; callId: string; kind: CallKind }
  | {
      phase: "incoming";
      peer: string;
      callId: string;
      kind: CallKind;
      offer: RTCSessionDescriptionInit;
    }
  | {
      phase: "active";
      peer: string;
      callId: string;
      kind: CallKind;
      startedAt: number;
      muted: boolean;
      cameraOff: boolean;
    };

interface CallApi {
  state: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  call: (peer: string, kind?: CallKind) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallApi | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside <CallProvider>");
  return ctx;
}

type Signal =
  | {
      type: "call-offer";
      from: string;
      to: string;
      callId: string;
      kind: CallKind;
      sdp: string;
    }
  | {
      type: "call-answer";
      from: string;
      to: string;
      callId: string;
      sdp: string;
    }
  | {
      type: "ice-candidate";
      from: string;
      to: string;
      callId: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: "call-end";
      from: string;
      to: string;
      callId: string;
      reason: "declined" | "ended" | "busy";
    };

const CHANNEL = "commapp-call-signaling";
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export function CallProvider({
  self,
  children,
}: {
  self: string | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<CallState>({ phase: "idle" });
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const stateRef = useRef<CallState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    pendingIceRef.current = [];
    setRemoteStream(null);
  }, []);

  const sendSignal = useCallback((signal: Signal) => {
    channelRef.current?.postMessage(signal);
  }, []);

  const setupPeerConnection = useCallback(
    (peer: string, callId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate && self) {
          sendSignal({
            type: "ice-candidate",
            from: self,
            to: peer,
            callId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (stream) setRemoteStream(stream);
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          if (stateRef.current.phase === "active") {
            cleanup();
            setState({ phase: "idle" });
          }
        }
      };

      return pc;
    },
    [self, sendSignal, cleanup],
  );

  const acquireMedia = useCallback(
    async (pc: RTCPeerConnection, kind: CallKind) => {
      const constraints: MediaStreamConstraints =
        kind === "video"
          ? { audio: true, video: { width: 640, height: 480 } }
          : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    },
    [],
  );

  const drainPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    for (const c of pendingIceRef.current) {
      try {
        await pc.addIceCandidate(c);
      } catch (err) {
        console.error("addIceCandidate (drain) failed", err);
      }
    }
    pendingIceRef.current = [];
  }, []);

  const call = useCallback(
    async (peer: string, kind: CallKind = "audio") => {
      if (!self || stateRef.current.phase !== "idle") return;
      const callId = crypto.randomUUID();
      setState({ phase: "outgoing", peer, callId, kind });

      try {
        const pc = setupPeerConnection(peer, callId);
        await acquireMedia(pc, kind);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendSignal({
          type: "call-offer",
          from: self,
          to: peer,
          callId,
          kind,
          sdp: offer.sdp ?? "",
        });
      } catch (err) {
        console.error("call() failed", err);
        cleanup();
        setState({ phase: "idle" });
      }
    },
    [self, setupPeerConnection, acquireMedia, sendSignal, cleanup],
  );

  const accept = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== "incoming" || !self) return;

    try {
      const pc = setupPeerConnection(current.peer, current.callId);
      await acquireMedia(pc, current.kind);
      await pc.setRemoteDescription(current.offer);
      await drainPendingIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignal({
        type: "call-answer",
        from: self,
        to: current.peer,
        callId: current.callId,
        sdp: answer.sdp ?? "",
      });

      setState({
        phase: "active",
        peer: current.peer,
        callId: current.callId,
        kind: current.kind,
        startedAt: Date.now(),
        muted: false,
        cameraOff: false,
      });
    } catch (err) {
      console.error("accept() failed", err);
      cleanup();
      setState({ phase: "idle" });
    }
  }, [
    self,
    setupPeerConnection,
    acquireMedia,
    drainPendingIce,
    sendSignal,
    cleanup,
  ]);

  const decline = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== "incoming" || !self) return;
    sendSignal({
      type: "call-end",
      from: self,
      to: current.peer,
      callId: current.callId,
      reason: "declined",
    });
    setState({ phase: "idle" });
  }, [self, sendSignal]);

  const hangup = useCallback(() => {
    const current = stateRef.current;
    if (current.phase === "idle" || !self) return;
    sendSignal({
      type: "call-end",
      from: self,
      to: current.peer,
      callId: current.callId,
      reason: "ended",
    });
    cleanup();
    setState({ phase: "idle" });
  }, [self, sendSignal, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    const nextMuted = audioTrack.enabled; // currently on → will be muted
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    setState((s) => (s.phase === "active" ? { ...s, muted: nextMuted } : s));
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    const nextOff = videoTrack.enabled;
    stream.getVideoTracks().forEach((t) => (t.enabled = !nextOff));
    setState((s) => (s.phase === "active" ? { ...s, cameraOff: nextOff } : s));
  }, []);

  // Wire up the signaling channel.
  useEffect(() => {
    if (!self) return;
    const ch = new BroadcastChannel(CHANNEL);
    channelRef.current = ch;

    ch.onmessage = async (event: MessageEvent<Signal>) => {
      const msg = event.data;
      if (msg.to !== self) return;
      const current = stateRef.current;

      if (msg.type === "call-offer") {
        if (current.phase !== "idle") {
          sendSignal({
            type: "call-end",
            from: self,
            to: msg.from,
            callId: msg.callId,
            reason: "busy",
          });
          return;
        }
        setState({
          phase: "incoming",
          peer: msg.from,
          callId: msg.callId,
          kind: msg.kind,
          offer: { type: "offer", sdp: msg.sdp },
        });
        return;
      }

      if (msg.type === "call-answer") {
        const pc = pcRef.current;
        if (!pc || current.phase !== "outgoing" || current.callId !== msg.callId) return;
        try {
          await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
          await drainPendingIce(pc);
          setState({
            phase: "active",
            peer: current.peer,
            callId: current.callId,
            kind: current.kind,
            startedAt: Date.now(),
            muted: false,
            cameraOff: false,
          });
        } catch (err) {
          console.error("setRemoteDescription (answer) failed", err);
          cleanup();
          setState({ phase: "idle" });
        }
        return;
      }

      if (msg.type === "ice-candidate") {
        const pc = pcRef.current;
        if (!pc || current.phase === "idle") return;
        if (current.callId !== msg.callId) return;
        if (!pc.remoteDescription) {
          pendingIceRef.current.push(msg.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(msg.candidate);
        } catch (err) {
          console.error("addIceCandidate failed", err);
        }
        return;
      }

      if (msg.type === "call-end") {
        if (current.phase === "idle" || current.callId !== msg.callId) return;
        cleanup();
        setState({ phase: "idle" });
        return;
      }
    };

    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [self, sendSignal, drainPendingIce, cleanup]);

  // Stop everything if the user signs out.
  useEffect(() => {
    if (self === null && stateRef.current.phase !== "idle") {
      cleanup();
      setState({ phase: "idle" });
    }
  }, [self, cleanup]);

  return (
    <CallContext.Provider
      value={{
        state,
        localStream,
        remoteStream,
        call,
        accept,
        decline,
        hangup,
        toggleMute,
        toggleCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}
