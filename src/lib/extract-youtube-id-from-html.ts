import { isValidYoutubeId } from "./youtube";

export function extractYoutubeIdFromHtml(htmlContent: string): string | undefined {
  return (
    firstValidYoutubeId(htmlContent, curatedYoutubePatterns()) ??
    firstValidYoutubeId(htmlContent, urlYoutubePatterns()) ??
    youtubeIdFromDom(htmlContent) ??
    firstValidYoutubeId(htmlContent, fallbackVideoIdPatterns())
  );
}

function firstValidYoutubeId(htmlContent: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const id = htmlContent.match(pattern)?.[1]?.trim();
    if (isValidYoutubeId(id)) return id;
  }
  return undefined;
}

function curatedYoutubePatterns(): RegExp[] {
  return [
    /["']youtubeId["']\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
    /youtubeId\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
  ];
}

function urlYoutubePatterns(): RegExp[] {
  return [
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /data-video(?:id)?=["']([a-zA-Z0-9_-]{11})["']/i,
    /aria-label=["']https?:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];
}

function fallbackVideoIdPatterns(): RegExp[] {
  return [
    /["']videoId["']\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
    /videoId\s*:\s*["']([a-zA-Z0-9_-]{11})["']/,
  ];
}

function youtubeIdFromDom(htmlContent: string): string | undefined {
  if (typeof DOMParser === "undefined") return undefined;

  const doc = new DOMParser().parseFromString(htmlContent, "text/html");
  return youtubeIdFromIframe(doc) ?? youtubeIdFromWatchLink(doc);
}

function youtubeIdFromIframe(doc: Document): string | undefined {
  return youtubeIdFromIframeSrc(youtubeIframeSrc(doc));
}

function youtubeIframeSrc(doc: Document): string {
  return doc.querySelector("iframe[src*='youtube']")?.getAttribute("src") ?? "";
}

function youtubeIdFromIframeSrc(src: string): string | undefined {
  return validMatchedId(src.match(/embed\/([a-zA-Z0-9_-]{11})/)?.[1])
    ?? validMatchedId(src.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1]);
}

function youtubeIdFromWatchLink(doc: Document): string | undefined {
  const selector = "a[href*='youtube.com/watch?v='], a[aria-label*='youtube.com/watch?v=']";
  const el = doc.querySelector(selector);
  const value = el?.getAttribute("href") ?? el?.getAttribute("aria-label") ?? "";
  return validMatchedId(value.match(/v=([a-zA-Z0-9_-]{11})/)?.[1]);
}

function validMatchedId(id: string | undefined): string | undefined {
  return isValidYoutubeId(id) ? id : undefined;
}
