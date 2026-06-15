"use client";

import { authClient } from "@/lib/auth";

/** Compatível com o formato usado no app (loading | authenticated | unauthenticated). */
type SessionResult = ReturnType<typeof authClient.useSession>;

type SessionRefetch = SessionResult["refetch"];

function loadingSession(refetch: SessionRefetch) {
  return {
    data: null,
    status: "loading" as const,
    update: refetch,
  };
}

function authenticatedSession(data: NonNullable<SessionResult["data"]>, refetch: SessionRefetch) {
  return {
    data: {
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image ?? null,
      },
    },
    status: "authenticated" as const,
    update: refetch,
  };
}

function unauthenticatedSession(error: SessionResult["error"], refetch: SessionRefetch) {
  return {
    data: null,
    status: "unauthenticated" as const,
    update: refetch,
    error,
  };
}

export function useSession() {
  const { data, isPending, error, refetch } = authClient.useSession();

  if (isPending) return loadingSession(refetch);
  if (data?.user) return authenticatedSession(data, refetch);
  return unauthenticatedSession(error, refetch);
}

export function signIn(
  provider: "google",
): ReturnType<typeof authClient.signIn.social> {
  const callbackURL =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}` || "/"
      : "/";

  return authClient.signIn.social({
    provider,
    callbackURL,
  });
}

function finishSignOut(callbackUrl?: string) {
  if (typeof window === "undefined") return;
  if (callbackUrl) {
    window.location.replace(callbackUrl);
    return;
  }
  window.location.reload();
}

export async function signOut(options?: { callbackUrl?: string }): Promise<void> {
  try {
    await authClient.signOut();
  } catch (error) {
    console.error("Sign out failed:", error);
  }

  // authClient.signOut() revokes the session server-side but does not reliably
  // expire the httpOnly __Secure-neon-auth.* cookies in production, which leaves
  // the user looking logged in after the reload. Force a server-side clear.
  try {
    await fetch("/api/sign-out", { method: "POST", credentials: "include" });
  } catch (error) {
    console.error("Session cookie cleanup failed:", error);
  }

  finishSignOut(options?.callbackUrl);
}
