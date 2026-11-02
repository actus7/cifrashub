import { describe, expect, it } from "vitest";
import { ChordFollower, fillChordless, lineChordTemplate } from "../chord-follow";
import { chordPitchClasses } from "../key-detect";
import { LineStabilizer } from "../line-stabilizer";

/** O mesmo ciclo do app: a tela decide a partir do modelo e a linha mostrada vira a âncora do modelo. */
function anchorAndShow(f: ChordFollower, screen: LineStabilizer): number {
  const shown = screen.update(f.best(screen.line));
  f.setAnchor(shown);
  return shown;
}

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

describe("follower + stabilizer (what the screen shows)", () => {
  it("never moves the screen backwards and keeps most lines right with noisy audio", () => {
    const f = new ChordFollower(SONG, 0);
    const screen = new LineStabilizer();
    let seed = 11;
    let backwards = 0;
    let previous = -1;
    let correct = 0;
    fillChordless(SONG).forEach((chords, line) => {
      for (const c of chords) {
        for (let i = 0; i < 20; i++) {
          f.step(chordChroma(c, 0, 0.45, seed++));
          const shown = anchorAndShow(f, screen);
          if (previous >= 0 && shown < previous) backwards++;
          previous = shown;
        }
      }
      if (screen.line === line) correct++;
    });
    expect(backwards).toBe(0);
    expect(correct).toBeGreaterThanOrEqual(SONG.length - 2);
  });

});

describe("re-routing when the player jumps to another part", () => {
  // Partes com harmonias diferentes: verso (C G Am F), refrão (D A Bm G), ponte (E B C#m A).
  const SECTIONS: string[][] = [
    ["C", "G"], ["Am", "F"], ["C", "G"], ["Am", "F"],
    ["D", "A"], ["Bm", "G"], ["D", "A"], ["Bm", "G"],
    ["E", "B"], ["C#m", "A"], ["E", "B"], ["C#m", "A"],
  ];

  /** Toca o começo do verso (linhas 0–1) e PULA para a ponte (linha 8), seguindo até o fim. */
  function jump() {
    const f = new ChordFollower(SECTIONS, 0);
    const screen = new LineStabilizer();
    let seed = 5;
    const play = (line: number) => {
      const shown: number[] = [];
      for (const c of SECTIONS[line]) for (let i = 0; i < 20; i++) {
        f.step(chordChroma(c, 0, 0.15, seed++));
        shown.push(anchorAndShow(f, screen));
      }
      return shown;
    };
    [0, 1].forEach(play);
    const afterJump = [8, 9, 10, 11].map(play);
    return { afterJump, screen };
  }

  it("re-routes to the new part within ~2 s of the jump", () => {
    const { afterJump } = jump();
    const at = afterJump[0].findIndex((shown) => shown === 8);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThanOrEqual(20);
  });

  it("then keeps following the new route", () => {
    expect(jump().screen.line).toBe(11);
  });

});

describe("calibration: no false jumps while playing in order", () => {
  // Música mais longa (verso, refrão, verso, refrão, ponte, refrão), com partes repetidas.
  const VERSE = [["C", "G"], ["Am", "F"], ["C", "G"], ["Am", "F"]];
  const CHORUS = [["F", "C"], ["G", "Am"], ["F", "C"], ["G", "G"]];
  const BRIDGE = [["Dm", "Em"], ["F", "G"]];
  const LONG = [...VERSE, ...CHORUS, ...VERSE, ...CHORUS, ...BRIDGE, ...CHORUS];
  const WRONG = ["E", "D", "Bm", "A", "B"];

  /** Toca em ordem, com ruído forte e 10% de quadros com um acorde errado; conta saltos falsos da tela. */
  function falseJumps(seed0: number) {
    const f = new ChordFollower(LONG, 0);
    const screen = new LineStabilizer();
    let seed = seed0;
    let previous = -1;
    let jumps = 0;
    for (const chords of LONG) {
      for (const c of chords) {
        for (let i = 0; i < 20; i++) {
          seed++;
          const wrong = seed % 10 === 0;
          f.step(chordChroma(wrong ? WRONG[seed % WRONG.length] : c, 0, 0.4, seed));
          const shown = anchorAndShow(f, screen);
          if (previous >= 0 && shown !== previous && (shown < previous || shown > previous + 1)) jumps++;
          previous = shown;
        }
      }
    }
    return { jumps, end: screen.line };
  }

  it("makes no out-of-sequence jumps over a whole song (5 runs)", () => {
    const total = [1, 2, 3, 4, 5].reduce((sum, s) => sum + falseJumps(s * 97).jumps, 0);
    expect(total).toBe(0);
  });

  it("still ends on the last line", () => {
    expect(falseJumps(7).end).toBeGreaterThanOrEqual(LONG.length - 2);
  });

});

describe("acquisition: understand where we are before moving the screen", () => {
  const VERSE = [["C", "G"], ["Am", "F"], ["C", "G"], ["Am", "F"]];
  const CHORUS = [["F", "C"], ["G", "Am"], ["F", "C"], ["G", "G"]];
  const BRIDGE = [["Dm", "Em"], ["F", "G"]];
  const LONG = [...VERSE, ...CHORUS, ...VERSE, ...CHORUS, ...BRIDGE, ...CHORUS];
  const WRONG = ["E", "D", "Bm", "A", "B"];

  /** Toca a partir de `startLine`; devolve a primeira linha mostrada e quando (quadro). */
  function firstShown(startLine: number, seed0: number) {
    const f = new ChordFollower(LONG, 0);
    const screen = new LineStabilizer();
    let seed = seed0;
    let frame = 0;
    for (const [offset, chords] of LONG.slice(startLine).entries()) {
      for (const c of chords) {
        for (let i = 0; i < 20; i++) {
          seed++;
          frame++;
          f.step(chordChroma(seed % 10 === 0 ? WRONG[seed % 5] : c, 0, 0.4, seed));
          const shown = anchorAndShow(f, screen);
          if (shown >= 0) return { line: shown, frame, playing: startLine + offset };
        }
      }
    }
    return { line: -1, frame, playing: -1 };
  }

  it("starting from the top, the first line shown is at the top (10 runs)", () => {
    for (let r = 1; r <= 10; r++) expect(firstShown(0, r * 131).line).toBeLessThanOrEqual(1);
  });

  it("starting at the bridge (unique chords), it locates it — taking its time", () => {
    const { line, frame, playing } = firstShown(16, 77);
    expect(line).toBe(playing); // a linha que está tocando quando decide
    expect(frame).toBeGreaterThanOrEqual(30); // não decide no susto
    expect(frame).toBeLessThanOrEqual(80); // mas decide em até ~8 s
  });
});
