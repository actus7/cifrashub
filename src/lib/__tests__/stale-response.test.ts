import { describe, expect, it } from "vitest";
import { isStaleResponse } from "../stale-response";

describe("isStaleResponse", () => {
  it("returns false when no mutation happened since the request started", () => {
    expect(isStaleResponse(2, 2)).toBe(false);
  });

  it("returns true when a mutation happened after the request started", () => {
    expect(isStaleResponse(2, 3)).toBe(true);
  });
});
