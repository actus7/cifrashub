"use client";

import { useEffect, useRef } from "react";

type ShortcutHandlers = {
  onToggleAutoScroll: () => void;
  onToggleZen: () => void;
  onScrollDown: () => void;
  onScrollUp: () => void;
};

type ShortcutAction = (handlers: ShortcutHandlers) => void;

const SHORTCUT_ACTIONS: Record<string, ShortcutAction> = {
  Space: handlers => handlers.onToggleAutoScroll(),
  ArrowDown: handlers => handlers.onScrollDown(),
  ArrowUp: handlers => handlers.onScrollUp(),
};

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(target.tagName);
}

function shortcutAction(e: KeyboardEvent): ShortcutAction | undefined {
  // Match the zen toggle by produced character so it works on non-QWERTY
  // layouts (Dvorak/AZERTY); the rest are layout-independent keys matched by code.
  if (e.key === "f" || e.key === "F") return handlers => handlers.onToggleZen();
  return SHORTCUT_ACTIONS[e.code];
}

export function useSongKeyboardShortcuts(options: {
  enabled: boolean;
} & ShortcutHandlers) {
  const { enabled } = options;
  const handlersRef = useRef<ShortcutHandlers>(options);

  useEffect(() => {
    handlersRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const action = shortcutAction(e);
      if (!action) return;

      e.preventDefault();
      action(handlersRef.current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
