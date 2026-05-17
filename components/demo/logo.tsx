interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 40, className }: LogoProps) {
  const id = `commapp-grad`;
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CommApp"
      role="img"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${id})`} />
      <path
        d="M12 16C12 13.7909 13.7909 12 16 12H24C26.2091 12 28 13.7909 28 16V20C28 22.2091 26.2091 24 24 24H20.5L15.5 27.5V24H16C13.7909 24 12 22.2091 12 20V16Z"
        fill="white"
      />
      <circle cx="20" cy="18" r="1.6" fill="#4338ca" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Logo size={28} />
      <span className="text-lg font-semibold tracking-tight">CommApp</span>
    </div>
  );
}
