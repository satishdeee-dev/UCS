"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

interface Props {
  phone: string;
  size?: number;
  className?: string;
}

export function Avatar({ phone, size = 40, className }: Props) {
  const user = useLiveQuery(() => db.users.get(phone), [phone]);
  const blob = user?.avatarBlob;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const initials = phone.slice(-2);
  const style = { width: size, height: size };

  if (url) {
    return (
      <img
        src={url}
        alt={phone}
        width={size}
        height={size}
        style={style}
        className={`rounded-full object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      style={{ ...style, fontSize: size * 0.36 }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-200 ${className ?? ""}`}
    >
      {initials}
    </div>
  );
}
