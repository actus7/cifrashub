import { describe, expect, it } from "vitest";
import { LineStabilizer } from "../line-stabilizer";

function feed(s: LineStabilizer, index: number, probability: number, frames: number) {
  for (let i = 0; i < frames; i++) s.update({ index, probability });
  return s.line;
}

describe("LineStabilizer", () => {
  it("moves to the next line quickly", () => {
    const s = new LineStabilizer();
    feed(s, 4, 0.9, 3);
    expect(feed(s, 5, 0.5, 3)).toBe(5);
  });

  it("does not flicker when the model alternates between two lines", () => {
    const s = new LineStabilizer();
    feed(s, 4, 0.9, 3);
    const shown: number[] = [];
    for (let i = 0; i < 40; i++) shown.push(s.update({ index: i % 2 ? 5 : 4, probability: 0.5 }));
    // No máximo uma troca (4 → 5) e nunca de volta.
    const changes = shown.filter((v, i) => i > 0 && v !== shown[i - 1]).length;
    expect(changes).toBeLessThanOrEqual(1);
    expect(shown.slice(shown.indexOf(5)).every((v) => v === 5 || shown.indexOf(5) === -1)).toBe(true);
  });

  it("ignores a backward pull that is not strong and sustained", () => {
    const s = new LineStabilizer();
    feed(s, 10, 0.9, 3);
    expect(feed(s, 3, 0.85, 40)).toBe(10); // forte, mas abaixo de 90%
    expect(feed(s, 3, 0.95, 20)).toBe(10); // 90%+, mas só 2 s
  });

  it("goes back only after ~3 s at 90%+ (the musician really jumped)", () => {
    const s = new LineStabilizer();
    feed(s, 10, 0.9, 3);
    expect(feed(s, 3, 0.95, 30)).toBe(3);
  });

  it("needs more evidence to skip ahead than to advance one line", () => {
    const s = new LineStabilizer();
    feed(s, 2, 0.9, 3);
    expect(feed(s, 5, 0.5, 20)).toBe(2);
    expect(feed(s, 5, 0.7, 8)).toBe(5);
  });
});
