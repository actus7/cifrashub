import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/server/auth-cookies";

/**
 * Forces the Neon Auth session cookies to expire. The client's
 * `authClient.signOut()` revokes the session server-side but does not reliably
 * clear the httpOnly `__Secure-neon-auth.*` cookies in production, so the
 * "Sair" action calls this afterwards to actually log the user out.
 */
export function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Clear-Site-Data", "\"cookies\"");
  clearAuthCookies(response);
  return response;
}
