"use client";

import { useState } from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * App logo.
 *
 * Renders /public/app-logo.png if the file is present. If the file is
 * missing the `onError` handler falls back to a hand-rolled SVG that
 * approximates the artwork (chat bubble + WiFi-style signal arcs in a
 * cyan → blue → purple gradient), so the rest of the app still has a
 * recognisable mark while you're getting the real asset in place.
 *
 * To use your exact image, save it at:
 *
 *   UCS/public/app-logo.png
 *
 * The next page load will pick it up; no code change required.
 */
export function Logo({ size = 40, className }: LogoProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return <LogoFallback size={size} className={className} />;
  }

  return (
    <img
      src="/app-logo.png"
      alt="CommApp"
      width={size}
      height={size}
      onError={() => setImageFailed(true)}
      className={`shrink-0 object-contain ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}

function LogoFallback({ size, className }: LogoProps) {
  const gradId = "commapp-logo-grad";
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
          id={gradId}
          x1="20"
          y1="10"
          x2="85"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="45%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path
        d="M 22 38 A 28 28 0 0 1 78 38"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 32 40 A 18 18 0 0 1 68 40"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 42 41 A 8 8 0 0 1 58 41"
        stroke={`url(#${gradId})`}
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 30 51
           Q 30 44 37 44
           L 63 44
           Q 70 44 70 51
           L 70 77
           Q 70 84 63 84
           L 46 84
           L 32 94
           L 37 84
           Q 30 84 30 77
           Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
}

/**
 * Two-tone wordmark — "Comm" in foreground, "App" in gradient — used in
 * spots where we want the brand name next to the icon. Most callers now
 * just render <Logo /> on its own since the uploaded artwork already
 * contains the wordmark.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <Logo size={36} />
      <span className="text-2xl font-bold tracking-tight">
        <span className="text-foreground">Comm</span>
        <span className="bg-gradient-to-br from-blue-400 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
          App
        </span>
      </span>
    </div>
  );
}
