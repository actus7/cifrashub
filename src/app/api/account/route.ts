import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { neonAuth } from "@/lib/auth-server";
import { clearAuthCookies } from "@/lib/server/auth-cookies";

let sqlClient: ReturnType<typeof neon> | null = null;

function getSqlClient() {
  if (sqlClient) return sqlClient;

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  sqlClient = neon(connectionString);
  return sqlClient;
}

export async function DELETE() {
  const { data: session } = await neonAuth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    const sql = getSqlClient();

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
