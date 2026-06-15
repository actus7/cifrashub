import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/api-auth";

export async function requireApiUserId(): Promise<
  { userId: string } | { response: NextResponse }
> {
  const authResult = await requireUserId();
  if ("error" in authResult) return { response: authResult.error };
  return { userId: authResult.userId };
}

export async function readJsonBody<T>(
  req: Request,
): Promise<{ body: T } | { response: NextResponse }> {
  try {
    return { body: await req.json() as T };
  } catch {
    return { response: NextResponse.json({ error: "JSON inválido" }, { status: 400 }) };
  }
}

export async function requireApiUserJson<T>(
  req: Request,
): Promise<{ userId: string; body: T } | { response: NextResponse }> {
  const auth = await requireApiUserId();
  if ("response" in auth) return auth;

  const json = await readJsonBody<T>(req);
  if ("response" in json) return json;

  return { userId: auth.userId, body: json.body };
}

export function requireTrimmedText(
  value: string | undefined,
  message: string,
): { value: string } | { response: NextResponse } {
  const text = value?.trim();
  if (!text) {
    return { response: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { value: text };
}
