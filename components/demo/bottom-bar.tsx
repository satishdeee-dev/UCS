"use client";

import { MessageCircle, Phone, User } from "lucide-react";

export type Tab = "chats" | "calls" | "profile";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "profile", label: "Profile", icon: User },
];

export function BottomBar({ active, onChange }: Props) {
  return (
    <nav className="flex shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 px-3 pb-2 pt-2.5 text-[11px] font-medium transition-colors ${
              isActive
                ? "text-indigo-600 dark:text-indigo-300"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
            aria-pressed={isActive}
          >
            <span
              className={`flex size-9 items-center justify-center rounded-full transition-all ${
                isActive
                  ? "bg-indigo-100 dark:bg-indigo-950/60"
                  : ""
              }`}
            >
              <Icon
                className="size-5"
                fill={isActive ? "currentColor" : "none"}
                strokeWidth={isActive ? 1.5 : 2}
              />
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
