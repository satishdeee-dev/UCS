import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface Body {
  phone?: string;
  displayName?: string | null;
  avatar?: { base64: string; mime: string } | null;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const phone = body.phone?.trim();
  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  // Look up the existing row to increment sign_in_count atomically. The
  // demo's load is tiny so a select-then-upsert race is acceptable; for
  // production this would be a postgres function or `update ... returning`.
  const { data: existing } = await supabase
    .from("commapp_profiles")
    .select("sign_in_count")
    .eq("phone", phone)
    .maybeSingle();

  type Row = {
    phone: string;
    display_name?: string | null;
    avatar_base64?: string | null;
    avatar_mime?: string | null;
    sign_in_count: number;
    last_seen_at: string;
  };

  const row: Row = {
    phone,
    sign_in_count: (existing?.sign_in_count ?? 0) + 1,
    last_seen_at: new Date().toISOString(),
  };
  if (body.displayName !== undefined) row.display_name = body.displayName;
  if (body.avatar !== undefined) {
    row.avatar_base64 = body.avatar?.base64 ?? null;
    row.avatar_mime = body.avatar?.mime ?? null;
  }

  const { error } = await supabase
    .from("commapp_profiles")
    .upsert(row, { onConflict: "phone" });

  if (error) {
    console.error("profile upsert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
