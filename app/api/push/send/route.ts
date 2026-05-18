import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

interface Body {
  to?: string[];
  title?: string;
  body?: string;
  conversationId?: string;
  tag?: string;
  url?: string;
}

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:noreply@commapp.local";

let vapidConfigured = false;
function configureVapid(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
  return true;
}

interface SubRow {
  phone: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function POST(req: NextRequest) {
  if (!configureVapid()) {
    return NextResponse.json(
      { error: "VAPID not configured" },
      { status: 503 },
    );
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { to, title, body, conversationId, tag, url } = payload;
  if (!Array.isArray(to) || to.length === 0 || !title) {
    return NextResponse.json({ error: "to + title required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("phone, endpoint, p256dh, auth")
    .in("phone", to);

  if (error) {
    console.error("push send select", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const subs = (data ?? []) as SubRow[];
  if (subs.length === 0) {
    return NextResponse.json({ sent: 0, removed: 0 });
  }

  const wirePayload = JSON.stringify({
    title,
    body,
    conversationId,
    tag,
    url,
  });

  let sent = 0;
  const expired: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          wirePayload,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          expired.push(s.endpoint);
        } else {
          console.warn("push delivery error", status, err);
        }
      }
    }),
  );

  if (expired.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expired);
  }

  return NextResponse.json({ sent, removed: expired.length });
}
