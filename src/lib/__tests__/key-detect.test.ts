import { describe, expect, it } from "vitest";
import type { Section } from "@/lib/types";
import { bestShift, chordPitchClasses, keyTemplate, spectrumChroma } from "../key-detect";

const SAMPLE_RATE = 48_000;
const FFT_SIZE = 16_384;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE;

const midiToFreq = (m: number, cents = 0) => 440 * 2 ** ((m - 69 + cents / 100) / 12);

/** Espectro (dB por bin) de notas com harmônicos, como um violão: f, 2f, 3f, 4f com amplitude caindo. */
function spectrum(midis: number[], cents = 0): Float32Array {
  const lin = new Float32Array(FFT_SIZE / 2);
  for (const m of midis) {
    const f0 = midiToFreq(m, cents);
    for (let h = 1; h <= 4; h++) {
      const bin = Math.round((f0 * h) / BIN_HZ);
      if (bin < lin.length) lin[bin] += 1 / h;
    }
  }
  return lin.map((v) => (v > 0 ? 20 * Math.log10(v) : -120));
}

function song(chords: string[]): Section[] {
  return [{ type: "verse", label: "", content: [chords.map((chord) => ({ chord, text: "la " }))] }];
}

// Acordes (com baixo) em Fá maior: F, Bb, C, Dm.
const F_PROGRESSION = [
  [41, 53, 57, 60],
  [46, 58, 62, 65],
  [48, 55, 60, 64],
  [50, 57, 62, 65],
];
const C_SONG = song(["C", "F", "G", "Am", "C", "G"]);

function accumulate(chords: number[][], cents = 0) {
  const total = new Array<number>(12).fill(0);
  for (const c of chords) {
    const { chroma } = spectrumChroma(spectrum(c, cents), SAMPLE_RATE, FFT_SIZE, cents);
    chroma.forEach((v, i) => (total[i] += v));
  }
  return total;
}

describe("chordPitchClasses", () => {
  it("parses common chord qualities", () => {
    expect(chordPitchClasses("C")).toEqual([0, 4, 7]);
    expect(chordPitchClasses("Am7")).toEqual([9, 0, 4, 7]);
    expect(chordPitchClasses("Bb")).toEqual([10, 2, 5]);
    expect(chordPitchClasses("G/B")).toEqual([7, 11, 2]);
    expect(chordPitchClasses("F#m")).toEqual([6, 9, 1]);
    expect(chordPitchClasses("D7M")).toEqual([2, 6, 9, 1]);
  });
});

describe("spectrumChroma", () => {
  it("puts an F major chord's energy on F, A and C", () => {
    const { chroma } = spectrumChroma(spectrum([53, 57, 60]), SAMPLE_RATE, FFT_SIZE, 0);
    const top3 = chroma.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, i]) => i).sort((a, b) => a - b);
    expect(top3).toEqual([0, 5, 9]);
  });

  it("estimates tuning offset of a detuned instrument", () => {
    const { tuningCents } = spectrumChroma(spectrum([53, 57, 60], -30), SAMPLE_RATE, FFT_SIZE, 0);
    expect(tuningCents).toBeGreaterThan(-40);
    expect(tuningCents).toBeLessThan(-20);
  });
});

describe("bestShift", () => {
  it("detects F (+5) when a song written in C is played in F", () => {
    const result = bestShift(accumulate(F_PROGRESSION), keyTemplate(C_SONG, "C"));
    expect(result.shift).toBe(5);
  });

  it("does not confuse F with E when the guitar is 30 cents flat", () => {
    const result = bestShift(accumulate(F_PROGRESSION, -30), keyTemplate(C_SONG, "C"));
    expect(result.shift).toBe(5);
  });

  it("returns 0 when played in the written key", () => {
    const inC = [
      [36, 48, 52, 55],
      [41, 53, 57, 60],
      [43, 55, 59, 62],
      [45, 57, 60, 64],
    ];
    expect(bestShift(accumulate(inC), keyTemplate(C_SONG, "C")).shift).toBe(0);
  });

  it("detects a semitone below (E, -1)", () => {
    const inE = F_PROGRESSION.map((c) => c.map((m) => m - 1));
    expect(bestShift(accumulate(inE), keyTemplate(C_SONG, "C")).shift).toBe(4);
  });

  it("reports zero confidence for silence", () => {
    expect(bestShift(new Array(12).fill(0), keyTemplate(C_SONG, "C")).confidence).toBe(0);
  });
});
