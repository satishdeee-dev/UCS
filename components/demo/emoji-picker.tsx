"use client";

import { useEffect, useRef, useState } from "react";
import {
  EMOJI_CATEGORIES,
  getRecentEmojis,
  pushRecentEmoji,
} from "@/lib/demo/emojis";

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string>(EMOJI_CATEGORIES[0].id);

  useEffect(() => {
    setRecents(getRecentEmojis());
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function pick(emoji: string) {
    pushRecentEmoji(emoji);
    setRecents(getRecentEmojis());
    onSelect(emoji);
  }

  const activeEmojis =
    activeId === "recents"
      ? recents
      : (EMOJI_CATEGORIES.find((c) => c.id === activeId)?.emojis ?? []);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-2 z-30 mb-2 flex w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
    >
      <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto p-2">
        {activeEmojis.length === 0 ? (
          <p className="col-span-8 px-2 py-6 text-center text-xs text-zinc-500">
            No emojis here yet.
          </p>
        ) : (
          activeEmojis.map((e, i) => (
            <button
              key={`${e}-${i}`}
              type="button"
              onClick={() => pick(e)}
              className="flex aspect-square items-center justify-center rounded text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {e}
            </button>
          ))
        )}
      </div>
      <div className="flex border-t bg-zinc-50 dark:bg-zinc-900">
        {recents.length > 0 && (
          <CategoryTab
            label="Recents"
            sample="🕒"
            active={activeId === "recents"}
            onClick={() => setActiveId("recents")}
          />
        )}
        {EMOJI_CATEGORIES.map((c) => (
          <CategoryTab
            key={c.id}
            label={c.label}
            sample={c.emojis[0]}
            active={activeId === c.id}
            onClick={() => setActiveId(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryTab({
  label,
  sample,
  active,
  onClick,
}: {
  label: string;
  sample: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex flex-1 items-center justify-center py-1.5 text-base transition-colors ${
        active
          ? "border-b-2 border-amber-600 bg-white dark:border-amber-400 dark:bg-zinc-950"
          : "border-b-2 border-transparent hover:bg-white/60 dark:hover:bg-zinc-950/60"
      }`}
    >
      {sample}
    </button>
  );
}
