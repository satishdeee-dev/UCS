interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * App logo: blue gradient tile with a stylised white letterform.
 *
 * Drop a higher-fidelity PNG at /public/app-logo.png and swap the inner
 * SVG for `<img src="/app-logo.png" />` if you want the exact uploaded
 * artwork.
 */
export function Logo({ size = 40, className }: LogoProps) {
  const bgId = "commapp-logo-bg";
  return (
    <svg
      viewBox="0 0 100 100"
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
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      <rect width="100" height="100" rx="14" fill={`url(#${bgId})`} />

      {/* Stylised letterform: two stacked round bumps joined by a sharp
          diagonal stroke, like the uploaded mark. */}
      <path
        d="M 30 16
           L 62 16
           A 16 16 0 0 1 78 32
           A 16 16 0 0 1 62 48
           L 34 48
           L 62 52
           A 16 16 0 0 1 78 68
           A 16 16 0 0 1 62 84
           L 30 84"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <Logo size={36} />
      <span className="bg-gradient-to-br from-sky-300 via-blue-400 to-blue-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
        CommApp
      </span>
    </div>
  );
}
