import { NextResponse } from "next/server";
import { neonAuth } from "@/lib/auth-server";

function unauthorized() {
  return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
}

export async function requireUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const { data: session } = await neonAuth.getSession();
  const user = session?.user;

  if (!user?.id) return { error: unauthorized() };

  return { userId: user.id };
}
