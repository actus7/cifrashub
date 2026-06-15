import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { shareSnapshots, shareTokens } from "@/db/schema";
import type { ShareSnapshotPayload } from "@/lib/share-payload";

export async function fetchSharePayloadByToken(
  token: string,
): Promise<ShareSnapshotPayload | null> {
  const tokenTrim = token?.trim();
  if (!tokenTrim) return null;

  const [row] = await db
    .select({ payload: shareSnapshots.payload })
    .from(shareTokens)
    .innerJoin(shareSnapshots, eq(shareSnapshots.id, shareTokens.snapshotId))
    .where(
      and(
        eq(shareTokens.token, tokenTrim),
        isNull(shareTokens.revokedAt),
        or(isNull(shareTokens.expiresAt), gt(shareTokens.expiresAt, new Date())),
      ),
    )
    .limit(1);

  return (row?.payload as ShareSnapshotPayload) ?? null;
}
