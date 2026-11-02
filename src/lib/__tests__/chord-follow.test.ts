import { describe, expect, it } from "vitest";
import { ChordFollower, fillChordless, lineChordTemplate } from "../chord-follow";
import { chordPitchClasses } from "../key-detect";

/** Cromagrama de um acorde tocado (notas do acorde + um pouco de ruído). */
function chordChroma(chord: string, shift = 0, noise = 0.15, seed = 1): number[] {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const v = new Array<number>(12).fill(0).map(() => rnd() * noise);
  chordPitchClasses(chord).forEach((n, i) => (v[(n + shift + 12) % 12] += i === 0 ? 1.2 : 1));
  return v;
}

// Verso 1 e verso 2 têm OS MESMOS acordes; refrão diferente; uma linha sem acorde.
const SONG: string[][] = [
  ["C", "G"], ["Am", "F"], ["C", "G"], ["F", "G"], // verso 1
  ["F", "C"], ["G", "Am"], [], ["F", "G"], // refrão (linha 6 sem acorde)
  ["C", "G"], ["Am", "F"], ["C", "G"], ["F", "G"], // verso 2
];

/** Toca cada linha por ~4 s (2 s em cada acorde) e conta em quantas linhas a posição estava certa no fim. */
function play(shift: number, framesPerChord = 20): number {
  const follower = new ChordFollower(SONG, shift);
  const filled = fillChordless(SONG);
  let correct = 0;
  let seed = 7;
  filled.forEach((chords, line) => {
    for (const chord of chords) for (let f = 0; f < framesPerChord; f++) follower.step(chordChroma(chord, shift, 0.15, seed++));
    if (follower.best().index === line) correct++;
  });
  return correct;
}

describe("lineChordTemplate", () => {
  it("transposes the chart's chords to the sounding key", () => {
    const t = lineChordTemplate(["C"], 2); // D maior
    expect([2, 6, 9].every((n) => t[n] > 0)).toBe(true);
    expect(t[0]).toBe(0);
  });
});

describe("ChordFollower", () => {
  // Tolerância de 1 linha: a linha 6 não tem acorde (herda o Am da 5), então pelo som não dá para saber quando o
  // cantor passou de uma para a outra.
  it("follows the song line by line, including a second verse with the same chords", () => {
    expect(play(0)).toBeGreaterThanOrEqual(SONG.length - 1);
  });

  it("works when the song is played in another key (shift)", () => {
    expect(play(5)).toBeGreaterThanOrEqual(SONG.length - 1);
  });

  it("finds a unique part when the player starts in the middle (chorus)", () => {
    const f = new ChordFollower(SONG, 0);
    for (const chord of ["F", "C", "G", "Am"]) for (let i = 0; i < 20; i++) f.step(chordChroma(chord, 0, 0.15, i + 3));
    // Linha 5 ("G Am") ou a 6 (sem acorde, herda o Am): pelo som as duas são iguais.
    expect([5, 6]).toContain(f.best().index);
  });

  it("tolerates faster playing than the expected line length", () => {
    expect(play(0, 12)).toBeGreaterThanOrEqual(SONG.length - 2);
  });

  it("keeps the position through silence", () => {
    const f = new ChordFollower(SONG, 0, 4);
    for (let i = 0; i < 20; i++) f.step(null);
    expect(f.best().index).toBe(4);
  });

});

describe("ChordFollower — fusion with words and tempo", () => {
  /** Letras das linhas (o verso 2 tem os mesmos acordes do verso 1, mas outra letra). */
  const LYRICS = [
    "nada novo achei pra dizer", "como expressar gratidao", "posso cantar alguma cancao", "vai acabar tua nao",
    "entao vou levantar", "minhas maos louvar", "tudo que tenho aleluia", "simples pra um rei",
    "resposta ti ha acao", "render aqui adoracao", "resposta ti ha acao", "render aqui adoracao",
  ].map((l) => l.split(" "));
  const scores = (heard: string) =>
    LYRICS.map((line) => {
      const h = heard.split(" ");
      const m = line.filter((w) => h.includes(w)).length;
      return m >= 2 ? m / line.length : 0;
    });

  it("words disambiguate a verse whose chords repeat another verse", () => {
    const f = new ChordFollower(SONG, 0);
    // Começa direto no verso 2 (linha 8): só pelos acordes ele acharia que é o verso 1 (linha 0).
    for (let i = 0; i < 20; i++) f.step(chordChroma("C", 0, 0.15, i));
    expect(f.best().index).toBe(0);
    f.observeWords(scores("em resposta a ti ha uma acao"));
    for (let i = 0; i < 20; i++) f.step(chordChroma("G", 0, 0.15, i + 40));
    expect(f.best().index).toBe(8);
  });

  it("words place a line that has no chord of its own", () => {
    const f = new ChordFollower(SONG, 0, 5);
    for (let i = 0; i < 10; i++) f.step(chordChroma("Am", 0, 0.15, i));
    f.observeWords(scores("tudo o que tenho e um aleluia"));
    expect(f.best().index).toBe(6);
  });

  it("learns a faster tempo from the playing", () => {
    const f = new ChordFollower(SONG, 0, 0);
    let seed = 1;
    for (const chords of fillChordless(SONG)) for (const c of chords) for (let i = 0; i < 10; i++) f.step(chordChroma(c, 0, 0.15, seed++));
    expect(f.secondsPerChord()).toBeLessThan(1.6);
  });

  it("names the chord being heard for diagnostics", () => {
    const f = new ChordFollower(SONG, 0);
    expect(f.heardChord(chordChroma("Am", 0, 0.05)).chord).toBe("Am");
  });
});
