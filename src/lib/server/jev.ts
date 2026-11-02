const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";
/** No palco, uma resposta atrasada já não serve. */
const TIMEOUT_MS = 4_000;

export type JevChoiceAnswer = { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };

/** Uma chamada ao System One (Jev) da TypeSafe. A chave TYPESAFE_JEV fica só no servidor. */
export async function askJev(
  state: unknown,
  questions: Record<string, unknown>,
): Promise<Record<string, JevChoiceAnswer>> {
  const key = process.env.TYPESAFE_JEV;
  if (!key) throw new Error("TYPESAFE_JEV não configurada");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, state, questions }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Jev respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { answers: Record<string, JevChoiceAnswer> };
  return body.answers;
}
