type RefreshEventTarget = {
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
};

type VisibilityEventTarget = RefreshEventTarget & {
  visibilityState: DocumentVisibilityState;
};

type CloudRefreshTargets = {
  windowTarget: RefreshEventTarget;
  documentTarget: VisibilityEventTarget;
};

function browserTargets(): CloudRefreshTargets {
  return {
    windowTarget: window,
    documentTarget: document,
  };
}

/**
 * Atualiza sob demanda quando a aba volta a ser usada ou outra aba altera a
 * biblioteca. Evita polling periódico de snapshots completos da conta.
 */
export function subscribeToCloudRefresh(
  syncSignalKey: string,
  refreshCloudState: () => void,
  targets: CloudRefreshTargets = browserTargets(),
) {
  const { windowTarget, documentTarget } = targets;
  const runRefresh: EventListener = () => refreshCloudState();
  const handleVisibility: EventListener = () => {
    if (documentTarget.visibilityState === "visible") refreshCloudState();
  };
  const handleStorage: EventListener = (event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key === syncSignalKey && storageEvent.newValue) {
      refreshCloudState();
    }
  };

  windowTarget.addEventListener("focus", runRefresh);
  windowTarget.addEventListener("online", runRefresh);
  windowTarget.addEventListener("storage", handleStorage);
  documentTarget.addEventListener("visibilitychange", handleVisibility);

  return () => {
    windowTarget.removeEventListener("focus", runRefresh);
    windowTarget.removeEventListener("online", runRefresh);
    windowTarget.removeEventListener("storage", handleStorage);
    documentTarget.removeEventListener("visibilitychange", handleVisibility);
  };
}
