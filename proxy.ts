import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/middleware";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // /demo is the offline-first demo (no auth). / redirects there.
  // /api/push and /api/profile are demo backends, also no Supabase auth.
  if (
    path === "/" ||
    path.startsWith("/demo") ||
    path.startsWith("/api/push") ||
    path.startsWith("/api/profile")
  ) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
