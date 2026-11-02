import { describe, expect, it } from "vitest";
import { commandQuestion, toStageCommand } from "../stage-commands";

describe("commandQuestion", () => {
  it("lists fixed commands, one option per song and a no-match option", () => {
    const q = commandQuestion([
      { position: 0, title: "Gratidão", artist: "FHOP" },
      { position: 3, title: "Maranata", artist: "AVB" },
    ]);
    expect(Object.keys(q.criteria)).toEqual([
      "proxima",
      "anterior",
      "subir_tom",
      "descer_tom",
      "pausar",
      "musica_0",
      "musica_3",
      "nenhum",
    ]);
  });
});

describe("toStageCommand", () => {
  it("maps confident choices to commands", () => {
    expect(toStageCommand("proxima", 0.98)).toEqual({ type: "next" });
    expect(toStageCommand("descer_tom", 0.9)).toEqual({ type: "tone_down" });
    expect(toStageCommand("musica_3", 0.95)).toEqual({ type: "go_to", position: 3 });
  });

  it("ignores low confidence, no-match and unknown ids", () => {
    expect(toStageCommand("proxima", 0.55)).toBeNull();
    expect(toStageCommand("nenhum", 0.99)).toBeNull();
    expect(toStageCommand("inventado", 0.99)).toBeNull();
  });
});
