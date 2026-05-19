import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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

  const { data, error } = await supabase
    .from("commapp_profiles")
    .select("phone, display_name, avatar_base64, avatar_mime, first_seen_at, last_seen_at")
    .order("last_seen_at", { ascending: false });

  if (error) {
    console.error("profile list", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profiles: data ?? [], admin: { username } });
}
