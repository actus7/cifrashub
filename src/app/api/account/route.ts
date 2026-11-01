import { NextResponse } from "next/server";
import { sql } from "@/db";
import { requireApiUserId } from "@/lib/server/api-route";
import { clearAuthCookies } from "@/lib/server/auth-cookies";

export async function DELETE() {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth.response;
  const { userId } = auth;

  try {
    await sql.transaction((tx) => [
      tx`
        DELETE FROM public.share_token
        WHERE snapshot_id IN (
          SELECT id FROM public.share_snapshot
          WHERE created_by_user_id = ${userId}
        )
      `,
      tx`
        DELETE FROM public.share_snapshot
        WHERE created_by_user_id = ${userId}
      `,
      tx`
        DELETE FROM public.user_setlist_item
        WHERE setlist_id IN (
          SELECT id FROM public.user_setlist
          WHERE user_id = ${userId}
        )
      `,
      tx`
        DELETE FROM public.user_setlist
        WHERE user_id = ${userId}
      `,
      tx`
        DELETE FROM public.user_song
        WHERE user_id = ${userId}
      `,
      tx`
        DELETE FROM public.user_folder
        WHERE user_id = ${userId}
      `,
      tx`
        DELETE FROM public."user"
        WHERE id = ${userId}
      `,
      tx`
        DELETE FROM neon_auth."user"
        WHERE id = ${userId}
      `,
    ]);

    const response = NextResponse.json({ ok: true });
    response.headers.set("Clear-Site-Data", "\"cookies\", \"storage\"");
    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error("[account] Failed to delete account:", error);
    return NextResponse.json(
      { error: "Erro ao excluir conta." },
      { status: 500 },
    );
  }
}
