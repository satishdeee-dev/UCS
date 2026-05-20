interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 40, className }: LogoProps) {
  const hexBgId = "commapp-hex-bg";
  const emblemId = "commapp-emblem";
  const glowId = "commapp-glow";
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
          id={hexBgId}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1e293b" />
          <stop offset="0.55" stopColor="#0f172a" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient
          id={emblemId}
          x1="14"
          y1="10"
          x2="34"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fde68a" />
          <stop offset="0.45" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <filter
          id={glowId}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hexagonal mech-shield base */}
      <polygon
        points="24,3 42.5,13 42.5,35 24,45 5.5,35 5.5,13"
        fill={`url(#${hexBgId})`}
        stroke="#334155"
        strokeWidth="1"
      />

      {/* Inner hex outline for layered depth */}
      <polygon
        points="24,8 38,16 38,32 24,40 10,32 10,16"
        fill="none"
        stroke="rgba(251,191,36,0.18)"
        strokeWidth="0.8"
      />

      {/* Twin-chevron emblem (Autobot-vibe, not the logo) */}
      <path
        d="M14 24 L24 16 L34 24 L24 22.5 Z"
        fill={`url(#${emblemId})`}
        filter={`url(#${glowId})`}
      />
      <path
        d="M16 30 L24 24 L32 30 L24 28.5 Z"
        fill={`url(#${emblemId})`}
        opacity="0.85"
      />

      {/* Energy core */}
      <circle cx="24" cy="22.5" r="1.4" fill="#fef9c3" />
      <circle cx="24" cy="22.5" r="2.4" fill="#fef9c3" opacity="0.35" />

      {/* Side energy ports */}
      <circle cx="9" cy="24" r="0.9" fill="#22d3ee" opacity="0.7" />
      <circle cx="39" cy="24" r="0.9" fill="#22d3ee" opacity="0.7" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Logo size={28} />
      <span className="bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
        CommApp
      </span>
    </div>
  );
}
