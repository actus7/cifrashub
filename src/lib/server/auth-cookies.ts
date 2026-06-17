import type { NextResponse } from "next/server";

/**
 * Neon Auth session cookies. They are httpOnly + Secure, so the browser can
 * only drop them when the server returns a matching expiry — `authClient.signOut()`
 * alone does not reliably expire them in production, which leaves the user
 * looking logged in after a reload.
 */
const NEON_AUTH_COOKIES = [
  "__Secure-neon-auth.session_token",
  "__Secure-neon-auth.local.session_data",
  "__Secure-neon-auth.session_challange",
] as const;

export function clearAuthCookies(response: NextResponse) {
  for (const name of NEON_AUTH_COOKIES) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  }
}
