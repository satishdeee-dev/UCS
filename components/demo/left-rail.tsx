"use client";

import { MessageCircle, Phone, User } from "lucide-react";
import { Logo } from "./logo";
import type { Tab } from "./bottom-bar";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "profile", label: "Profile", icon: User },
];

export function LeftRail({ active, onChange }: Props) {
  return (
    <aside className="hidden flex-col items-center gap-2 border-r bg-card py-3 md:flex">
      <div className="mb-3 flex size-10 items-center justify-center">
        <Logo size={36} />
      </div>
      <nav className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex w-14 flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-medium transition-all ${
                isActive
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              }`}
              aria-pressed={isActive}
              aria-label={tab.label}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-amber-500"
                  aria-hidden
                />
              )}
              <Icon
                className="size-5"
                fill={isActive ? "currentColor" : "none"}
                strokeWidth={isActive ? 1.5 : 2}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
