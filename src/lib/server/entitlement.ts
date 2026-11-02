import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userEntitlements } from "@/db/schema";
import { requireApiUserId } from "@/lib/server/api-route";

export async function hasActiveSubscription(userId: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ activeUntil: userEntitlements.activeUntil })
    .from(userEntitlements)
    .where(eq(userEntitlements.userId, userId))
    .limit(1);
  if (!row) return false;
  return row.activeUntil === null || row.activeUntil > now;
}

export async function requireSubscriber(): Promise<{ userId: string } | { response: NextResponse }> {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth;
  if (!(await hasActiveSubscription(auth.userId))) {
    return {
      response: NextResponse.json(
        { error: "Recurso exclusivo para assinantes." },
        { status: 403 },
      ),
    };
  }
  return auth;
}
