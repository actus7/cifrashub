import type { Folder, LocalSetlistStored, StoredSong } from "./types";

export const STORAGE_FOLDERS = "cifrashub_folders";
export const STORAGE_RECENTES = "cifrashub_recentes";
export const STORAGE_SETLISTS = "cifrashub_setlists_v1";

/** Chave por usuário: primeira sincronização local → nuvem já feita. */
export function cloudSyncDoneKey(userId: string) {
  return `cifrashub_cloud_sync_${userId}`;
}

export * from "./cloud-api";

function safeSetItem(key: string, value: string): boolean {
  if (!canUseLocalStorage()) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    warnStorageError(key, error);
    return false;
  }
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined";
}

function warnStorageError(key: string, error: unknown) {
  if (isQuotaExceeded(error)) {
    console.warn(`localStorage quota exceeded for key "${key}"`);
  }
}

function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException && isQuotaExceededCode(error);
}

function isQuotaExceededCode(error: DOMException): boolean {
  return error.name === "QuotaExceededError" || error.code === 22;
}

function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown): boolean {
  return safeSetItem(key, JSON.stringify(value));
}

type LegacyFolder = Omit<Folder, "title" | "songs"> & {
  title?: string;
  name?: string;
  songs?: StoredSong[];
};

function normalizeFolder(folder: LegacyFolder): Folder | null {
  const title = folderTitle(folder);
  return folder.id && title ? normalizedFolder(folder, title) : null;
}

function folderTitle(folder: LegacyFolder) {
  return (folder.title ?? folder.name)?.trim();
}

function normalizedFolder(folder: LegacyFolder, title: string): Folder {
  return {
    id: folder.id,
    title,
    songs: folderSongs(folder),
    isDefault: folder.isDefault,
  };
}

function folderSongs(folder: LegacyFolder) {
  return Array.isArray(folder.songs) ? folder.songs : [];
}

export function loadFolders(): Folder[] | null {
  const folders = loadJson<LegacyFolder[]>(STORAGE_FOLDERS);
  if (!Array.isArray(folders)) return null;

  const normalized = normalizedFolders(folders);
  if (shouldPersistNormalizedFolders(folders, normalized)) saveFolders(normalized);
  return normalized;
}

function normalizedFolders(folders: LegacyFolder[]) {
  return folders
    .map((folder) => normalizeFolder(folder))
    .filter((folder): folder is Folder => folder !== null);
}

function shouldPersistNormalizedFolders(folders: LegacyFolder[], normalized: Folder[]) {
  return hasLegacyFolderShape(folders) || normalized.length !== folders.length;
}

function hasLegacyFolderShape(folders: LegacyFolder[]) {
  return folders.some((folder) => !folder.title && Boolean(folder.name));
}

export function saveFolders(folders: Folder[]): boolean {
  return saveJson(STORAGE_FOLDERS, folders);
}

export function loadRecentes(): StoredSong[] | null {
  return loadJson<StoredSong[]>(STORAGE_RECENTES);
}

export function saveRecentes(songs: StoredSong[]): boolean {
  return saveJson(STORAGE_RECENTES, songs);
}

export function loadLocalSetlists(): LocalSetlistStored[] | null {
  return loadJson<LocalSetlistStored[]>(STORAGE_SETLISTS);
}

export function saveLocalSetlists(setlists: LocalSetlistStored[]): boolean {
  return saveJson(STORAGE_SETLISTS, setlists);
}

export const DEFAULT_FOLDERS: Folder[] = [
  { id: "default", title: "Favoritos", songs: [], isDefault: true },
];
