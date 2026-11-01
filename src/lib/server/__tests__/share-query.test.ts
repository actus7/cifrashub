import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { sanitizePublicSharePayload } from "@/lib/server/share-query";
import type { ShareSnapshotPayload } from "@/lib/share-payload";

const invite = (ownerName: string | null): ShareSnapshotPayload => ({
  type: "folder-invite",
  folderId: "f1",
  ownerId: "u1",
  ownerName,
  title: "Pasta",
});

describe("sanitizePublicSharePayload", () => {
  it("removes ownerId and keeps other fields", () => {
    const out = sanitizePublicSharePayload(invite("Ana"));
    expect(out).toEqual({ type: "folder-invite", folderId: "f1", ownerName: "Ana", title: "Pasta" });
    expect("ownerId" in out).toBe(false);
  });

  it("nulls e-mail-looking owner names", () => {
    expect(sanitizePublicSharePayload(invite("ana@x.com"))).toMatchObject({ ownerName: null });
  });

  it("leaves non-invite payloads untouched", () => {
    const p: ShareSnapshotPayload = { type: "setlist", title: "S", description: null, items: [] };
    expect(sanitizePublicSharePayload(p)).toBe(p);
  });
});
