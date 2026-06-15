export async function fetchChordsHtml(
  artistSlug: string,
  slug: string,
  signal?: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({ artistSlug, slug });
  const res = await fetch(`/api/cifra-html?${params}`, { signal });

  if (!res.ok) {
    try {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Não foi possível carregar a cifra no momento.");
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Não foi possível carregar a cifra no momento.");
    }
  }

  const data = (await res.json()) as { html?: string | null; error?: string };
  if (!data.html) {
    throw new Error(data.error ?? "Não foi possível carregar a cifra no momento.");
  }

  return data.html;
}
