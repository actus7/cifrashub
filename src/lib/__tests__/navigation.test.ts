import { afterEach, describe, expect, it, vi } from "vitest";
import { navigateBackOrFallback } from "@/lib/navigation";

function routerMock() {
  return {
    back: vi.fn(),
    replace: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("navigateBackOrFallback", () => {
  it("uses the fallback when the Navigation API reports no previous entry", () => {
    vi.stubGlobal("window", {
      history: { length: 2 },
      navigation: { canGoBack: false },
    });
    const router = routerMock();

    navigateBackOrFallback(router);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("returns through history when a previous entry is available", () => {
    vi.stubGlobal("window", {
      history: { length: 3 },
      navigation: { canGoBack: true },
    });
    const router = routerMock();

    navigateBackOrFallback(router);

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("falls back to history length when the Navigation API is unavailable", () => {
    vi.stubGlobal("window", {
      history: { length: 1 },
    });
    const router = routerMock();

    navigateBackOrFallback(router, "/inicio");

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/inicio");
  });
});
