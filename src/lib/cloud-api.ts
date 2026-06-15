import type {
  Folder,
  SetlistDetailView,
  SetlistSummary,
  StoredSong,
} from "./types";

const pendingRequests = new Map<string, Promise<unknown>>();

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const reqKey = `${init?.method || "GET"}:${path}`;

  if ((!init?.method || init.method === "GET") && pendingRequests.has(reqKey)) {
    return pendingRequests.get(reqKey) as Promise<T>;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const requestPromise = (async () => {
    try {
      const res = await fetch(path, {
        ...init,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers as Record<string, string> | undefined),
        },
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
      if (!init?.method || init.method === "GET") {
        pendingRequests.delete(reqKey);
      }
    }
  })();

  if (!init?.method || init.method === "GET") {
    pendingRequests.set(reqKey, requestPromise);
  }

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
  const [fa, ra] = await Promise.all([
    apiJson<{ folders: Folder[] }>("/api/folders"),
    apiJson<{ recentes: StoredSong[] }>("/api/recentes"),
  ]);
  return { folders: fa.folders, recentes: ra.recentes };
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

