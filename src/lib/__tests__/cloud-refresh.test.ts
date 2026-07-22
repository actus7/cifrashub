import { describe, expect, it, vi } from "vitest";
import { subscribeToCloudRefresh } from "@/lib/cloud-refresh";

class FakeEventTarget {
  visibilityState: DocumentVisibilityState = "hidden";
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Event = new Event(type)) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function storageEvent(key: string, newValue: string | null) {
  const event = new Event("storage");
  Object.defineProperties(event, {
    key: { value: key },
    newValue: { value: newValue },
  });
  return event;
}

describe("subscribeToCloudRefresh", () => {
  it("refreshes only for user-driven or cross-tab events", () => {
    const windowTarget = new FakeEventTarget();
    const documentTarget = new FakeEventTarget();
    const refresh = vi.fn();
    const unsubscribe = subscribeToCloudRefresh("sync:user", refresh, {
      windowTarget,
      documentTarget,
    });

    expect(refresh).not.toHaveBeenCalled();

    documentTarget.dispatch("visibilitychange");
    windowTarget.dispatch("storage", storageEvent("other", "1"));
    windowTarget.dispatch("storage", storageEvent("sync:user", null));
    expect(refresh).not.toHaveBeenCalled();

    documentTarget.visibilityState = "visible";
    documentTarget.dispatch("visibilitychange");
    windowTarget.dispatch("focus");
    windowTarget.dispatch("online");
    windowTarget.dispatch("storage", storageEvent("sync:user", "1"));
    expect(refresh).toHaveBeenCalledTimes(4);

    unsubscribe();
    windowTarget.dispatch("focus");
    expect(refresh).toHaveBeenCalledTimes(4);
  });
});
