"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  TrendingUp,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listProfiles,
  type ProfileRow,
  type ProfileStats,
} from "@/lib/demo/profiles";
import { AnimatedBackground } from "./animated-background";
import { Logo } from "./logo";

type State =
  | { phase: "login" }
  | { phase: "loading" }
  | {
      phase: "ready";
      profiles: ProfileRow[];
      stats: ProfileStats;
      admin: { username: string };
      credentials: { username: string; password: string };
    }
  | { phase: "error"; message: string };

export function AdminView() {
  const [state, setState] = useState<State>({ phase: "login" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("Enter your username and password");
      return;
    }
    setError(null);
    setState({ phase: "loading" });
    const result = await listProfiles(username, password);
    if (result.ok) {
      setState({
        phase: "ready",
        profiles: result.profiles,
        stats: result.stats,
        admin: result.admin,
        credentials: { username, password },
      });
    } else if (result.status === 401) {
      setError("Wrong username or password");
      setState({ phase: "login" });
    } else {
      setState({ phase: "error", message: result.error });
    }
  }

  async function refresh() {
    if (state.phase !== "ready") return;
    const { username: u, password: p } = state.credentials;
    const result = await listProfiles(u, p);
    if (result.ok) {
      setState({
        phase: "ready",
        profiles: result.profiles,
        stats: result.stats,
        admin: result.admin,
        credentials: state.credentials,
      });
    } else {
      setState({ phase: "error", message: result.error });
    }
  }

  function signOut() {
    setUsername("");
    setPassword("");
    setError(null);
    setState({ phase: "login" });
  }

  if (state.phase === "error") {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col items-center justify-center gap-3 p-6">
        <h2 className="text-base font-semibold">Couldn&apos;t load</h2>
        <p className="text-sm text-zinc-500">{state.message}</p>
        <Button onClick={signOut} variant="outline">
          Back to login
        </Button>
      </main>
    );
  }

  if (state.phase === "ready") {
    return (
      <RosterScreen
        state={state}
        search={search}
        setSearch={setSearch}
        onRefresh={refresh}
        onSignOut={signOut}
      />
    );
  }

  return (
    <LoginScreen
      username={username}
      password={password}
      setUsername={setUsername}
      setPassword={setPassword}
      error={error}
      onSubmit={signIn}
      busy={state.phase === "loading"}
    />
  );
}

function LoginScreen({
  username,
  password,
  setUsername,
  setPassword,
  error,
  onSubmit,
  busy,
}: {
  username: string;
  password: string;
  setUsername: (v: string) => void;
  setPassword: (v: string) => void;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
}) {
  return (
    <main className="relative flex min-h-svh w-full flex-col items-center justify-center px-6 py-12">
      <AnimatedBackground />
      <div className="relative z-10 mb-6 flex flex-col items-center gap-3">
        <Logo size={72} />
        <h1 className="text-3xl font-bold tracking-tight">CommApp Admin</h1>
        <p className="text-center text-sm text-zinc-500">
          Sign in to see every user that has joined CommApp.
        </p>
      </div>
      <Card className="relative z-10 w-full max-w-sm bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Shield className="size-4 text-amber-600" />
            Admin sign in
          </h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-username">Username</Label>
              <Input
                id="admin-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/demo"
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <ArrowLeft className="size-3" /> Back to demo
              </Link>
              <Button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Admin credentials live on the server (
              <span className="font-mono">ADMIN_USERNAME</span> +{" "}
              <span className="font-mono">ADMIN_PASSWORD</span> env vars).
              Regular phone users can&apos;t reach this dashboard.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function RosterScreen({
  state,
  search,
  setSearch,
  onRefresh,
  onSignOut,
}: {
  state: Extract<State, { phase: "ready" }>;
  search: string;
  setSearch: (v: string) => void;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.profiles;
    return state.profiles.filter(
      (p) =>
        p.phone.toLowerCase().includes(q) ||
        (p.display_name ?? "").toLowerCase().includes(q),
    );
  }, [search, state.profiles]);

  const { stats } = state;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Link
          href="/demo"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="size-4" /> Demo
        </Link>
        <div className="flex flex-1 items-center gap-2">
          <Shield className="size-4 text-amber-600" />
          <h1 className="text-base font-semibold tracking-tight">
            CommApp users
          </h1>
        </div>
        <Button onClick={onRefresh} variant="ghost" size="sm">
          <RefreshCw className="size-4" /> Refresh
        </Button>
        <Button onClick={onSignOut} variant="outline" size="sm">
          Sign out
        </Button>
      </header>

      <div className="flex flex-col gap-3 border-b bg-card px-4 py-3">
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/30">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white">
              <Shield className="size-5" />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-xs text-zinc-500">Signed in as</span>
              <span className="font-mono text-sm font-medium">
                {state.admin.username}
              </span>
            </div>
            <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
              Admin
            </span>
          </CardContent>
        </Card>

        <KpiGrid stats={stats} />
      </div>

      <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
        <Search className="size-4 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search phone or display name"
          className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        <span className="text-xs text-zinc-500">
          {filtered.length} / {state.profiles.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          {state.profiles.length === 0
            ? "No users have signed in yet."
            : "No matches."}
        </div>
      ) : (
        <ul className="flex flex-1 flex-col overflow-y-auto">
          {filtered.map((p) => (
            <ProfileRowView key={p.phone} profile={p} />
          ))}
        </ul>
      )}
    </main>
  );
}

function KpiGrid({ stats }: { stats: ProfileStats }) {
  const items: { icon: typeof Users; label: string; value: number }[] = [
    { icon: Users, label: "Total users", value: stats.total },
    { icon: TrendingUp, label: "Active 24h", value: stats.active_24h },
    { icon: TrendingUp, label: "Active 7d", value: stats.active_7d },
    { icon: UserPlus, label: "New 7d", value: stats.new_7d },
    { icon: ImageIcon, label: "With photo", value: stats.with_photo },
    { icon: Smartphone, label: "Devices", value: stats.total_devices },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.label}
            className="flex flex-col gap-1 rounded-md border bg-card px-3 py-2"
          >
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Icon className="size-3" />
              {kpi.label}
            </div>
            <span className="text-xl font-semibold tabular-nums">
              {kpi.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function relativeTime(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 0) return "in the future";
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return `${Math.floor(ms / 604_800_000)}w ago`;
}

function ProfileRowView({ profile }: { profile: ProfileRow }) {
  const [expanded, setExpanded] = useState(false);
  const initials = profile.phone.slice(-2);
  const dataUrl =
    profile.avatar_base64 && profile.avatar_mime
      ? `data:${profile.avatar_mime};base64,${profile.avatar_base64}`
      : null;
  const firstSeen = new Date(profile.first_seen_at).toLocaleString();
  const lastSeen = new Date(profile.last_seen_at).toLocaleString();
  const isActive24h =
    Date.now() - new Date(profile.last_seen_at).getTime() < 86_400_000;

  return (
    <li className="border-b">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <div className="relative shrink-0">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={profile.phone}
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700 dark:bg-amber-900/70 dark:text-amber-200">
              <User className="size-4" aria-hidden />
              <span className="sr-only">{initials}</span>
            </div>
          )}
          {isActive24h && (
            <span
              className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500"
              title="Active in last 24h"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-mono text-sm">{profile.phone}</span>
          {profile.display_name && (
            <span className="truncate text-xs text-zinc-500">
              {profile.display_name}
            </span>
          )}
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
            <Badge
              icon={<RefreshCw className="size-2.5" />}
              label={`${profile.sign_in_count} sign-in${profile.sign_in_count === 1 ? "" : "s"}`}
            />
            <Badge
              icon={<Smartphone className="size-2.5" />}
              label={`${profile.device_count} device${profile.device_count === 1 ? "" : "s"}`}
            />
            <Badge
              icon={<Calendar className="size-2.5" />}
              label={`${profile.days_active} day${profile.days_active === 1 ? "" : "s"} active`}
            />
          </div>
        </div>

        <div className="hidden flex-col items-end gap-0.5 text-[10px] text-zinc-500 sm:flex">
          <span className="text-xs text-zinc-700 dark:text-zinc-300">
            {relativeTime(profile.last_seen_at)}
          </span>
          <span>Joined {relativeTime(profile.first_seen_at)}</span>
        </div>

        <ChevronDown
          className={`size-4 shrink-0 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-3 border-t bg-zinc-50/60 px-4 py-3 text-xs sm:grid-cols-2 dark:bg-zinc-900/40">
          <DetailField label="Phone" value={profile.phone} mono />
          <DetailField
            label="Display name"
            value={profile.display_name ?? "—"}
          />
          <DetailField label="Sign-ins" value={String(profile.sign_in_count)} />
          <DetailField
            label="Devices (push)"
            value={String(profile.device_count)}
          />
          <DetailField
            label="Days active"
            value={String(profile.days_active)}
          />
          <DetailField
            label="Has photo"
            value={profile.avatar_base64 ? "Yes" : "No"}
          />
          <DetailField label="First seen" value={firstSeen} />
          <DetailField label="Last seen" value={lastSeen} />
        </div>
      )}
    </li>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      {icon}
      {label}
    </span>
  );
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>{value}</span>
    </div>
  );
}
