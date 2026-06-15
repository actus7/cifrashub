import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { neonAuth } from "@/lib/auth-server";

function unauthorized() {
  return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof neonAuth.getSession>>["data"]>["user"];

function userValues(user: SessionUser) {
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

async function upsertLocalUser(user: SessionUser) {
  const values = userValues(user);
  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: values.name,
        email: values.email,
        image: values.image,
      },
    });
}

export async function requireUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const { data: session } = await neonAuth.getSession();
  const user = session?.user;

  if (!user?.id) return { error: unauthorized() };

  await upsertLocalUser(user);
  return { userId: user.id };
}
