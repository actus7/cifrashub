import { describe, expect, it } from "vitest";
import { normalizeNote } from "../setlist-local";

describe("normalizeNote", () => {
  it("trims text", () => expect(normalizeNote("  oi  ")).toBe("oi"));
  it("maps empty/blank/null to null", () => {
    expect(normalizeNote("   ")).toBeNull();
    expect(normalizeNote(null)).toBeNull();
  });
  it("accepts 280 chars and rejects 281", () => {
    expect(normalizeNote("a".repeat(280))).toBe("a".repeat(280));
    expect(normalizeNote("a".repeat(281))).toBeUndefined();
  });
  it("rejects non-strings", () => expect(normalizeNote(5)).toBeUndefined());
});
