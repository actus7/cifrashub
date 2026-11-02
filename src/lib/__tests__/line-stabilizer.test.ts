import { describe, expect, it } from "vitest";
import { LineStabilizer } from "../line-stabilizer";

/** Trava a tela numa linha como se a pessoa tivesse começado ali (fase de reconhecimento). */
function lockAt(s: LineStabilizer, line: number) {
  feed(s, line, 0.95, 40);
  expect(s.line).toBe(line);
}

function feed(s: LineStabilizer, index: number, probability: number, frames: number) {
  for (let i = 0; i < frames; i++) s.update({ index, probability });
  return s.line;
}

describe("LineStabilizer", () => {
  it("moves to the next line quickly", () => {
    const s = new LineStabilizer();
    lockAt(s, 4);
    expect(feed(s, 5, 0.5, 3)).toBe(5);
  });

  it("does not flicker when the model alternates between two lines", () => {
    const s = new LineStabilizer();
    lockAt(s, 4);
    const shown: number[] = [];
    for (let i = 0; i < 40; i++) shown.push(s.update({ index: i % 2 ? 5 : 4, probability: 0.5 }));
    // No máximo uma troca (4 → 5) e nunca de volta.
    const changes = shown.filter((v, i) => i > 0 && v !== shown[i - 1]).length;
    expect(changes).toBeLessThanOrEqual(1);
    expect(shown.slice(shown.indexOf(5)).every((v) => v === 5 || shown.indexOf(5) === -1)).toBe(true);
  });

  it("ignores a backward pull that is not strong and sustained", () => {
    const s = new LineStabilizer();
    lockAt(s, 10);
    expect(feed(s, 3, 0.85, 40)).toBe(10); // forte, mas abaixo de 90%
    expect(feed(s, 3, 0.95, 20)).toBe(10); // 90%+, mas só 2 s
  });

  it("goes back only after ~3 s at 90%+ (the musician really jumped)", () => {
    const s = new LineStabilizer();
    lockAt(s, 10);
    expect(feed(s, 3, 0.95, 30)).toBe(3);
  });

  it("needs more evidence to skip ahead than to advance one line", () => {
    const s = new LineStabilizer();
    lockAt(s, 2);
    expect(feed(s, 5, 0.5, 20)).toBe(2);
    expect(feed(s, 5, 0.7, 8)).toBe(5);
  });

  it("locates the start of the song quickly but takes its time elsewhere", () => {
    const top = new LineStabilizer();
    expect(feed(top, 0, 0.55, 10)).toBe(0);
    const middle = new LineStabilizer();
    expect(feed(middle, 9, 0.8, 60)).toBe(-1); // 80% não basta para começar no meio
    expect(feed(middle, 9, 0.9, 39)).toBe(-1); // nem menos de 4 s
    expect(feed(middle, 9, 0.9, 1)).toBe(9);
  });

  it("confirms a trajectory: a candidate that keeps advancing keeps its count", () => {
    const s = new LineStabilizer();
    feed(s, 16, 0.95, 20);
    expect(feed(s, 17, 0.95, 20)).toBe(17);
  });
});
