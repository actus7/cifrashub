type BackRouter = {
  back: () => void;
  replace: (href: string) => void;
};

type NavigationHistory = {
  canGoBack?: boolean;
};

function browserCanGoBack() {
  if (typeof window === "undefined") return false;

  const navigation = (window as Window & { navigation?: NavigationHistory }).navigation;
  if (typeof navigation?.canGoBack === "boolean") return navigation.canGoBack;

  return window.history.length > 1;
}

export function navigateBackOrFallback(router: BackRouter, fallbackHref = "/") {
  if (browserCanGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackHref);
}
