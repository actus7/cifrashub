import { describe, expect, it } from "vitest";
import { isUsableCifraHtml, waybackUrls } from "@/lib/server/cifra-sources";
import { pickUgTab, readUgStore, ugSlug, ugTabToCifraHtml } from "@/lib/server/ultimate-guitar";

describe("isUsableCifraHtml", () => {
  it("accepts a page with a chord <pre>", () => {
    expect(isUsableCifraHtml('<pre class="x"><b>C</b></pre>')).toBe(true);
  });

  it.each([
    "<HTML><HEAD>\n<TITLE>Access Denied</TITLE>\n</HEAD><BODY><pre></pre></BODY></HTML>",
    "<title>Just a moment...</title><pre></pre>",
    "<html><body>no chords</body></html>",
  ])("rejects block pages and pages without <pre>", (html) => {
    expect(isUsableCifraHtml(html)).toBe(false);
  });
});

describe("waybackUrls", () => {
  it("targets the latest raw snapshot of each Cifra Club url", () => {
    const urls = waybackUrls("legiao-urbana", "tempo-perdido", new Date("2026-10-15T20:08:38Z"));
    expect(urls[0]).toBe(
      "https://web.archive.org/web/20261015200838id_/https://www.cifraclub.com.br/legiao-urbana/tempo-perdido/imprimir.html",
    );
    expect(urls).toHaveLength(2);
  });
});

describe("ugSlug", () => {
  it.each([
    ["Legi&atilde;o Urbana", "legiao-urbana"],
    ["ANAVITÓRIA", "anavitoria"],
    ["Trevo (Tu)", "trevo-tu"],
    ["Jo&atilde;o &amp; Maria", "joao-maria"],
  ])("%s -> %s", (name, slug) => {
    expect(ugSlug(name)).toBe(slug);
  });
});

describe("pickUgTab", () => {
  const results = [
    { type: "Tabs", artist_name: "Legi&atilde;o Urbana", song_name: "Tempo Perdido", votes: 500, tab_url: "https://tabs.ultimate-guitar.com/tab/1" },
    { type: "Chords", artist_name: "Legi&atilde;o Urbana", song_name: "Tempo Perdido", votes: 3, tab_url: "https://tabs.ultimate-guitar.com/tab/2" },
    { type: "Chords", artist_name: "Legi&atilde;o Urbana", song_name: "Tempo Perdido", votes: 130, tab_url: "https://tabs.ultimate-guitar.com/tab/3" },
    { type: "Chords", artist_name: "Outra Banda", song_name: "Tempo Perdido", votes: 999, tab_url: "https://tabs.ultimate-guitar.com/tab/4" },
    { type: "Chords", artist_name: "Legi&atilde;o Urbana", song_name: "Tempo Perdido", votes: 9999, tab_url: "https://evil.example.com/tab/5" },
  ];

  it("picks the most voted chords tab of the same artist and song", () => {
    expect(pickUgTab(results, "legiao-urbana", "tempo-perdido")).toBe("https://tabs.ultimate-guitar.com/tab/3");
  });

  it("returns null when nothing matches the artist", () => {
    expect(pickUgTab(results, "nenhum-artista", "tempo-perdido")).toBeNull();
  });
});

describe("readUgStore", () => {
  it("decodes the escaped js-store payload", () => {
    const html = '<div class="js-store" data-content="{&quot;store&quot;:{&quot;page&quot;:{&quot;data&quot;:{&quot;x&quot;:&quot;N&amp;atilde;o&quot;}}}}"></div>';
    expect(readUgStore(html)).toEqual({ x: "N&atilde;o" });
  });

  it("returns null for pages without a store", () => {
    expect(readUgStore("<html></html>")).toBeNull();
  });
});

describe("ugTabToCifraHtml", () => {
  it("turns UG markup into <pre>/<b> chord html with key metadata", () => {
    const html = ugTabToCifraHtml({
      tab: { song_name: "Tempo Perdido", artist_name: "Legi&atilde;o Urbana", tonality_name: "Em" },
      tab_view: {
        meta: { capo: 2 },
        wiki_tab: { content: "[Intro]\r\n[tab][ch]C[/ch]   [ch]Am7[/ch]\nTodos os <dias>[/tab]" },
      },
    });

    expect(html).toContain("<h1>Tempo Perdido</h1><h2>Legi&atilde;o Urbana</h2>");
    expect(html).toContain('<div id="cifra_tom">Tom: <a>Em</a> (Capotraste na 2ª casa)</div>');
    expect(html).toContain("<pre>[Intro]\n<b>C</b>   <b>Am7</b>\nTodos os &lt;dias&gt;</pre>");
  });

  it("returns null when the tab has no content", () => {
    expect(ugTabToCifraHtml({ tab_view: { wiki_tab: { content: "  " } } })).toBeNull();
  });
});
