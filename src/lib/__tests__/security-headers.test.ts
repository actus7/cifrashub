import { describe, expect, it } from "vitest";
import config, { SECURITY_HEADERS } from "../../../next.config";

describe("security headers", () => {
  it("includes the baseline header set", () => {
    const keys = SECURITY_HEADERS.map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Content-Security-Policy-Report-Only",
      ]),
    );
  });

  it("applies no-referrer on share routes", async () => {
    const rules = await config.headers!();
    const share = rules.find((r) => r.source === "/s/:token*");
    expect(share?.headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
  });
});
