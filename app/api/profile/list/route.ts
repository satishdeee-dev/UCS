import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface RawProfile {
  phone: string;
  display_name: string | null;
  avatar_base64: string | null;
  avatar_mime: string | null;
  sign_in_count: number | null;
  first_seen_at: string;
  last_seen_at: string;
}

export async function GET(req: NextRequest) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin credentials not configured on server" },
      { status: 503 },
    );
  }

  const username = req.headers.get("x-admin-username");
  const password = req.headers.get("x-admin-password");
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  const [profilesResult, subsResult] = await Promise.all([
    supabase
      .from("commapp_profiles")
      .select(
        "phone, display_name, avatar_base64, avatar_mime, sign_in_count, first_seen_at, last_seen_at",
      )
      .order("last_seen_at", { ascending: false }),
    supabase.from("push_subscriptions").select("phone"),
  ]);

  if (profilesResult.error) {
    console.error("profile list", profilesResult.error);
    return NextResponse.json(
      { error: profilesResult.error.message },
      { status: 500 },
    );
  }

  const rawProfiles = (profilesResult.data ?? []) as RawProfile[];
  const subs = (subsResult.data ?? []) as { phone: string }[];

  // Count devices per phone (push subs are per browser+device).
  const deviceCounts = new Map<string, number>();
  for (const s of subs) {
    deviceCounts.set(s.phone, (deviceCounts.get(s.phone) ?? 0) + 1);
  }

  const now = Date.now();
  const profiles = rawProfiles.map((p) => {
    const firstMs = new Date(p.first_seen_at).getTime();
    const lastMs = new Date(p.last_seen_at).getTime();
    return {
      phone: p.phone,
      display_name: p.display_name,
      avatar_base64: p.avatar_base64,
      avatar_mime: p.avatar_mime,
      sign_in_count: p.sign_in_count ?? 1,
      first_seen_at: p.first_seen_at,
      last_seen_at: p.last_seen_at,
      device_count: deviceCounts.get(p.phone) ?? 0,
      days_active: Math.max(
        1,
        Math.ceil((lastMs - firstMs) / DAY_MS) || 1,
      ),
    };
  });

  // Aggregate KPIs.
  let active24h = 0;
  let active7d = 0;
  let new7d = 0;
  let withPhoto = 0;
  let withPush = 0;
  let totalSignIns = 0;
  for (const p of profiles) {
    const last = new Date(p.last_seen_at).getTime();
    const first = new Date(p.first_seen_at).getTime();
    if (now - last <= DAY_MS) active24h++;
    if (now - last <= WEEK_MS) active7d++;
    if (now - first <= WEEK_MS) new7d++;
    if (p.avatar_base64) withPhoto++;
    if (p.device_count > 0) withPush++;
    totalSignIns += p.sign_in_count;
  }

  return NextResponse.json({
    admin: { username },
    profiles,
    stats: {
      total: profiles.length,
      active_24h: active24h,
      active_7d: active7d,
      new_7d: new7d,
      with_photo: withPhoto,
      with_push: withPush,
      total_devices: subs.length,
      total_sign_ins: totalSignIns,
    },
  });
}
