import type { StoredSong } from "@/lib/types";

export type ShareSnapshotPayload =
  | { type: "arrangement"; song: StoredSong }
  | {
      type: "setlist";
      title: string;
      description: string | null;
      items: Array<{
        position: number;
        arrangementId: string;
        notes: string | null;
        song: StoredSong | null;
      }>;
    }
  | { type: "folder-invite"; folderId: string; ownerId: string; ownerName: string | null; title: string }
  | { type: "setlist-invite"; setlistId: string; ownerId: string; ownerName: string | null; title: string };
