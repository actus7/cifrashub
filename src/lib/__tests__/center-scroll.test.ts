import { describe, expect, it } from "vitest";
import { centerScrollDelta } from "../center-scroll";

// Celular: janela de 800 px, header de 60 px em cima, barra do setlist de 52 px embaixo → área visível 60..748.
const PHONE = { top: 60, bottom: 748 };

describe("centerScrollDelta", () => {
  it("centers on the visible band, not on the raw window", () => {
    // Centro da área visível = 404. Linha de 30 px em 600 → centro 615 → rolar 211.
    expect(centerScrollDelta({ top: 600, height: 30 }, PHONE)).toBe(211);
  });

  it("scrolls up when the line is above the center", () => {
    expect(centerScrollDelta({ top: 70, height: 30 }, PHONE)).toBe(-319);
  });

  it("does not move when the line is already near the center", () => {
    expect(centerScrollDelta({ top: 420, height: 30 }, PHONE)).toBe(0);
  });

  it("adapts to a tall desktop screen", () => {
    expect(centerScrollDelta({ top: 900, height: 40 }, { top: 64, bottom: 1080 })).toBe(348);
  });
});
