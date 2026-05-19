"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Search, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listProfiles, type ProfileRow } from "@/lib/demo/profiles";
import { AnimatedBackground } from "./animated-background";
import { Logo } from "./logo";

type State =
  | { phase: "login" }
  | { phase: "loading" }
  | {
      phase: "ready";
      profiles: ProfileRow[];
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
        <Logo size={56} />
        <h1 className="text-2xl font-semibold tracking-tight">CommApp Admin</h1>
        <p className="text-center text-sm text-zinc-500">
          Sign in to see every user that has joined CommApp.
        </p>
      </div>
      <Card className="relative z-10 w-full max-w-sm bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Shield className="size-4 text-indigo-600" />
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

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Link
          href="/demo"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="size-4" /> Demo
        </Link>
        <div className="flex flex-1 items-center gap-2">
          <Shield className="size-4 text-indigo-600" />
          <h1 className="text-base font-semibold tracking-tight">
            CommApp users
          </h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {state.profiles.length}
          </span>
        </div>
        <Button onClick={onRefresh} variant="ghost" size="sm">
          <RefreshCw className="size-4" /> Refresh
        </Button>
        <Button onClick={onSignOut} variant="outline" size="sm">
          Sign out
        </Button>
      </header>

      {/* Admin identity card */}
      <div className="border-b bg-card px-4 py-3">
        <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/30">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
              <Shield className="size-5" />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-xs text-zinc-500">Signed in as</span>
              <span className="font-mono text-sm font-medium">
                {state.admin.username}
              </span>
            </div>
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
              Admin
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
        <Search className="size-4 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search phone or display name"
          className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
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

function ProfileRowView({ profile }: { profile: ProfileRow }) {
  const initials = profile.phone.slice(-2);
  const dataUrl =
    profile.avatar_base64 && profile.avatar_mime
      ? `data:${profile.avatar_mime};base64,${profile.avatar_base64}`
      : null;
  const firstSeen = new Date(profile.first_seen_at).toLocaleString();
  const lastSeen = new Date(profile.last_seen_at).toLocaleString();

  return (
    <li className="flex items-center gap-3 border-b px-4 py-3">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={profile.phone}
          className="size-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-200">
          <User className="size-4" aria-hidden />
          <span className="sr-only">{initials}</span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-mono text-sm">{profile.phone}</span>
        {profile.display_name && (
          <span className="truncate text-xs text-zinc-500">
            {profile.display_name}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end text-[10px] text-zinc-500">
        <span>Last seen {lastSeen}</span>
        <span>First seen {firstSeen}</span>
      </div>
    </li>
  );
}
