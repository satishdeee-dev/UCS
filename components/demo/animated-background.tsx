interface Props {
  className?: string;
}

/**
 * Slowly-drifting amber/orange/red/cyan blobs — Transformers-inspired
 * accent palette over the dark slate base. GPU-only (transform +
 * opacity), pauses on prefers-reduced-motion.
 */
export function AnimatedBackground({ className }: Props) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className ?? ""}`}
    >
      <div
        className="commapp-blob absolute -top-24 -left-24 h-72 w-72 rounded-full bg-amber-400/40 blur-3xl"
        style={{ animation: "commapp-blob 18s ease-in-out infinite" }}
      />
      <div
        className="commapp-blob absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-orange-500/35 blur-3xl"
        style={{ animation: "commapp-blob 22s ease-in-out -6s infinite" }}
      />
      <div
        className="commapp-blob absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-cyan-400/25 blur-3xl"
        style={{ animation: "commapp-blob 26s ease-in-out -12s infinite" }}
      />
      <div
        className="commapp-blob absolute bottom-10 right-10 h-64 w-64 rounded-full bg-red-500/25 blur-3xl"
        style={{ animation: "commapp-blob 30s ease-in-out -3s infinite" }}
      />
    </div>
  );
}
