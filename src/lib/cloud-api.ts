import type {
  Folder,
  SetlistDetailView,
  SetlistSummary,
  StoredSong,
  StoredSongUiPrefs,
} from "./types";

const pendingRequests = new Map<string, Promise<unknown>>();

const isGetRequest = (init?: RequestInit) => !init?.method || init.method === "GET";

function requestKey(path: string, init?: RequestInit) {
  return `${init?.method || "GET"}:${path}`;
}

async function responseErrorMessage(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

async function fetchJson<T>(path: string, init: RequestInit | undefined, signal: AbortSignal) {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    cache: "no-store",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    throw new Error(await responseErrorMessage(res));
  }

  return res.json() as Promise<T>;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const reqKey = requestKey(path, init);
  const shouldCache = isGetRequest(init);
  const pending = shouldCache ? pendingRequests.get(reqKey) : null;

  if (pending) return pending as Promise<T>;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const requestPromise = fetchJson<T>(path, init, controller.signal).finally(() => {
    clearTimeout(timeoutId);
    if (shouldCache) pendingRequests.delete(reqKey);
  });

  if (shouldCache) pendingRequests.set(reqKey, requestPromise);

  return requestPromise;
}

export async function cloudSync(payload: {
  folders: Folder[];
  recentes: StoredSong[];
}): Promise<{ folders: Folder[]; recentes: StoredSong[] }> {
  return apiJson("/api/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cloudFetchLibrary(): Promise<{
  folders: Folder[];
  recentes: StoredSong[];
}> {
  return apiJson("/api/sync");
}

export async function cloudCreateFolder(
  title: string,
): Promise<{ folders: Folder[] }> {
  return apiJson("/api/folders", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function cloudDeleteFolder(
  id: string,
): Promise<{ folders: Folder[] }> {
  return apiJson(`/api/folders/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function cloudAddSongToFolder(
  folderId: string,
  song: StoredSong,
): Promise<{ folders: Folder[] }> {
  return apiJson(`/api/folders/${encodeURIComponent(folderId)}/songs`, {
    method: "POST",
    body: JSON.stringify(song),
  });
}

export async function cloudRemoveSongFromFolder(
  folderId: string,
  arrangementId: string,
): Promise<{ folders: Folder[] }> {
  const q = new URLSearchParams({ arrangementId });
  return apiJson(
    `/api/folders/${encodeURIComponent(folderId)}/songs?${q.toString()}`,
    { method: "DELETE" },
  );
}

export async function cloudSaveRecentes(
  songs: StoredSong[],
): Promise<{ recentes: StoredSong[] }> {
  return apiJson("/api/recentes", {
    method: "POST",
    body: JSON.stringify({ songs }),
  });
}

export async function cloudClearRecentes(): Promise<{
  recentes: StoredSong[];
}> {
  return apiJson("/api/recentes", { method: "DELETE" });
}

export async function cloudFetchSetlists(): Promise<{ setlists: SetlistSummary[] }> {
  return apiJson("/api/setlists");
}

export type SharedSummary = {
  folders: Array<{ id: string; title: string; ownerName: string | null }>;
  setlists: Array<{ id: string; title: string; description: string | null; ownerName: string | null }>;
};

export async function cloudFetchSharedSummary(): Promise<SharedSummary> {
  return apiJson("/api/shared/summary");
}

export async function cloudCreateSetlist(
  title: string,
  description?: string | null,
): Promise<{
  setlist: { id: string };
  setlists: SetlistSummary[];
}> {
  return apiJson("/api/setlists", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  });
}

export async function cloudDeleteSetlist(
  id: string,
): Promise<{ setlists: SetlistSummary[] }> {
  return apiJson(`/api/setlists/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function cloudCreateSetlistShareLink(
  setlistId: string,
): Promise<{ token: string; snapshotId: string }> {
  return apiJson("/api/share", {
    method: "POST",
    body: JSON.stringify({ resourceType: "setlist-invite", setlistId }),
  });
}

export async function cloudLeaveSetlist(id: string): Promise<{ ok: true }> {
  return apiJson(`/api/setlists/${encodeURIComponent(id)}/membership`, {
    method: "DELETE",
  });
}

export async function cloudGetSetlist(id: string): Promise<SetlistDetailView> {
  return apiJson(`/api/setlists/${encodeURIComponent(id)}`);
}

export async function cloudAddSetlistItem(
  setlistId: string,
  arrangementId: string,
  notes?: string | null,
): Promise<SetlistDetailView> {
  return apiJson(`/api/setlists/${encodeURIComponent(setlistId)}/items`, {
    method: "POST",
    body: JSON.stringify({ arrangementId, notes }),
  });
}

export async function cloudRemoveSetlistItem(
  setlistId: string,
  itemId: string,
): Promise<SetlistDetailView> {
  const q = new URLSearchParams({ itemId });
  return apiJson(
    `/api/setlists/${encodeURIComponent(setlistId)}/items?${q.toString()}`,
    { method: "DELETE" },
  );
}

export async function cloudReorderSetlistItems(
  setlistId: string,
  orderedItemIds: string[],
): Promise<SetlistDetailView> {
  return apiJson(`/api/setlists/${encodeURIComponent(setlistId)}/items`, {
    method: "PATCH",
    body: JSON.stringify({ orderedItemIds }),
  });
}

export async function cloudUpdateSongPrefs(
  arrangementId: string,
  prefs: { tone: number; capo: number; uiPrefs: StoredSongUiPrefs },
  song?: StoredSong,
): Promise<{ ok: true }> {
  return apiJson("/api/songs/prefs", {
    method: "PATCH",
    body: JSON.stringify({ arrangementId, ...prefs, song }),
  });
}

/**
 * Sincroniza o conteúdo editado de uma música em TODAS as linhas existentes
 * para esse arranjo (pasta(s) + recentes) — não só na que estava "ativa" ao
 * salvar. Sem isso, editar uma música aberta sem contexto de pasta (ex.: pelo
 * setlist) só atualiza a cópia de "recentes", e telas que priorizam a cópia
 * de pasta continuam mostrando a versão antiga.
 */
export async function cloudSyncSongContent(
  arrangementId: string,
  song: StoredSong,
): Promise<{ ok: true }> {
  return apiJson("/api/songs/prefs", {
    method: "PATCH",
    body: JSON.stringify({ arrangementId, song }),
  });
}
