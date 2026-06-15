"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PwaInstallState = {
  canPrompt: boolean;
  isIos: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
};

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isNavigatorStandalone() {
  return (navigator as { standalone?: boolean }).standalone === true;
}

function getIsInstalled() {
  if (typeof window === "undefined") return false;
  return isStandaloneDisplay() || isNavigatorStandalone();
}

function isIosDevice() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isSafariOnIos() {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
}

function getIsIos(standalone: boolean) {
  if (typeof window === "undefined") return false;
  return isIosDevice() && isSafariOnIos() && !standalone;
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(getIsInstalled);
  const [isIos] = useState(() => getIsIos(getIsInstalled()));

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return { canPrompt: !!deferredPrompt, isIos, isInstalled, promptInstall };
}
