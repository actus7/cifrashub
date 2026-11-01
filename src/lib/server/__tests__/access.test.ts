import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { displayNameFromUserRow } from "@/lib/server/access";

describe("displayNameFromUserRow", () => {
  it("returns the trimmed name when present", () => {
    expect(displayNameFromUserRow({ name: " Ana ", email: "a@x.com" })).toBe("Ana");
  });

  it("returns null instead of the e-mail when the name is empty", () => {
    expect(displayNameFromUserRow({ name: "  ", email: "a@x.com" })).toBeNull();
    expect(displayNameFromUserRow({ name: null, email: "a@x.com" })).toBeNull();
  });

  it("returns null when there is no row", () => {
    expect(displayNameFromUserRow(undefined)).toBeNull();
  });
});
