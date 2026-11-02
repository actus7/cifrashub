import { describe, expect, it } from "vitest";
import {
  detectToneShift,
  estimateTonic,
  pitchClass,
  pitchClassHistogram,
  pitchFromFrame,
  toneShift,
} from "../key-detect";

const SAMPLE_RATE = 44100;

function sine(freq: number, length = 2048): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) buf[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  return buf;
}

const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);
// Melodia em Ré maior (D E F# G A B C# D), com a tônica e a dominante mais frequentes.
const D_MAJOR_MELODY = [62, 64, 66, 67, 69, 71, 73, 74, 62, 69, 66, 62, 69, 74, 67, 62].map(midiToFreq);

describe("pitchFromFrame", () => {
  it("detects A4 from a 440 Hz sine", () => {
    const f = pitchFromFrame(sine(440), SAMPLE_RATE);
    expect(f).not.toBeNull();
    expect(pitchClass(f!)).toBe(9);
  });

  it("detects a low voice note (G3)", () => {
    expect(pitchClass(pitchFromFrame(sine(196), SAMPLE_RATE)!)).toBe(7);
  });

  it("returns null for silence", () => {
    expect(pitchFromFrame(new Float32Array(2048), SAMPLE_RATE)).toBeNull();
  });
});

describe("estimateTonic / toneShift", () => {
  it("finds D as tonic of a D major melody", () => {
    expect(estimateTonic(pitchClassHistogram(D_MAJOR_MELODY), false)).toBe(2);
  });

  it("maps written key to the shortest shift", () => {
    expect(toneShift("C", 2)).toBe(2);
    expect(toneShift("C", 11)).toBe(-1);
    expect(toneShift("Am", 9)).toBe(0);
    expect(toneShift("Bb", 0)).toBe(2);
  });

  it("returns +2 for a song written in C sung in D", () => {
    const freqs = Array.from({ length: 3 }, () => D_MAJOR_MELODY).flat();
    expect(detectToneShift(freqs, "C")).toBe(2);
  });

  it("returns null without enough samples", () => {
    expect(detectToneShift(D_MAJOR_MELODY.slice(0, 5), "C")).toBeNull();
  });
});
