interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 40, className }: LogoProps) {
  const bgId = "commapp-logo-bg";
  const bubbleId = "commapp-logo-bubble";
  const shineId = "commapp-logo-shine";
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CommApp"
      role="img"
    >
      <defs>
        <linearGradient
          id={bgId}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#a5b4fc" />
          <stop offset="0.45" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient
          id={bubbleId}
          x1="14"
          y1="14"
          x2="34"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0e7ff" />
        </linearGradient>
        <radialGradient
          id={shineId}
          cx="0.3"
          cy="0.2"
          r="0.9"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="white" stopOpacity="0.35" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Rounded-square base with indigo gradient */}
      <rect width="48" height="48" rx="12" fill={`url(#${bgId})`} />

      {/* Soft top-left highlight for depth */}
      <rect width="48" height="48" rx="12" fill={`url(#${shineId})`} />

      {/* Chat bubble with subtle gradient inside */}
      <path
        d="M14 19c0-2.761 2.239-5 5-5h10c2.761 0 5 2.239 5 5v6c0 2.761-2.239 5-5 5h-4.5l-5 4v-4h-0.5c-2.761 0-5-2.239-5-5v-6z"
        fill={`url(#${bubbleId})`}
      />

      {/* Three dots — typing / conversation cue */}
      <circle cx="19.5" cy="22" r="1.5" fill="#4f46e5" />
      <circle cx="24" cy="22" r="1.5" fill="#4f46e5" />
      <circle cx="28.5" cy="22" r="1.5" fill="#4f46e5" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Logo size={28} />
      <span className="bg-gradient-to-br from-indigo-300 via-indigo-400 to-violet-400 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
        CommApp
      </span>
    </div>
  );
}
