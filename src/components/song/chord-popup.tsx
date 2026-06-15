"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHORD_DB } from "@/lib/chord-db";
import { normalizeChord, simplifyChord } from "@/lib/music";
import type { ChordShape } from "@/lib/types";

type ChordPopupProps = {
  chord: string | null;
  onClose: () => void;
  mirrored: boolean;
  capo?: number;
};

type ChordDiagramProps = {
  chordInfo: ChordShape;
  mirrored: boolean;
  capo: number;
};

const STRING_LABELS = {
  leftHanded: ["e", "B", "G", "D", "A", "E"],
  rightHanded: ["E", "A", "D", "G", "B", "e"],
};

export function ChordPopup({ chord, onClose, mirrored, capo = 0 }: ChordPopupProps) {
  const chordInfo = useMemo(() => findChordInfo(chord), [chord]);

  if (!chord) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="no-print max-w-[280px] gap-4 border-border bg-card p-6 sm:max-w-[280px]"
      >
        <ChordPopupHeader chord={chord} capo={capo} onClose={onClose} />
        {chordInfo ? (
          <ChordDiagram chordInfo={chordInfo} mirrored={mirrored} capo={capo} />
        ) : (
          <p className="my-6 text-center text-xs text-muted-foreground">Diagrama indisponível</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function findChordInfo(chord: string | null) {
  if (!chord) return null;
  const normalized = normalizeChord(chord);
  const simplified = simplifyChord(normalized);
  return CHORD_DB[normalized] ?? CHORD_DB[simplified] ?? null;
}

function ChordPopupHeader({ chord, capo, onClose }: { chord: string; capo: number; onClose: () => void }) {
  return (
    <DialogHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
      <div>
        <DialogTitle className="text-2xl font-bold">{chord}</DialogTitle>
        {capo > 0 ? (
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            Capotraste na {capo}ª casa. À esquerda: casas absolutas no braço (a forma do diagrama é a mesma da cifra).
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 rounded-full bg-muted"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
    </DialogHeader>
  );
}

function ChordDiagram({ chordInfo, mirrored, capo }: ChordDiagramProps) {
  const stringLabels = mirrored ? STRING_LABELS.leftHanded : STRING_LABELS.rightHanded;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full pl-6 pr-2">
        <OpenStringLabels chordInfo={chordInfo} mirrored={mirrored} />
        <Fretboard chordInfo={chordInfo} mirrored={mirrored} capo={capo} />
        <StringNames labels={stringLabels} />
      </div>
    </div>
  );
}

function OpenStringLabels({ chordInfo, mirrored }: { chordInfo: ChordShape; mirrored: boolean }) {
  const indicators = mirrored ? [...chordInfo.frets].reverse() : chordInfo.frets;

  return (
    <div className="relative mb-1 h-4 w-full">
      {indicators.map((fret, index) => (
        <span
          key={index}
          className={`absolute -ml-2 w-4 text-center text-[10px] font-bold ${
            fret === "x" ? "text-muted-foreground" : "text-foreground/80"
          }`}
          style={{ left: `${(index / 5) * 100}%` }}
        >
          {openStringLabel(fret)}
        </span>
      ))}
    </div>
  );
}

function openStringLabel(fret: ChordShape["frets"][number]) {
  if (fret === "x") return "X";
  if (fret === 0) return "O";
  return "";
}

function Fretboard({ chordInfo, mirrored, capo }: ChordDiagramProps) {
  return (
    <div className="relative h-36 w-full border-x border-muted-foreground/60 bg-muted/30">
      <NutLine base={chordInfo.base} />
      <FretLines />
      <StringLines />
      <FretNumbers base={chordInfo.base} capo={capo} />
      {chordInfo.barre ? <Barre chordInfo={chordInfo} mirrored={mirrored} /> : null}
      <FingerDots chordInfo={chordInfo} mirrored={mirrored} />
    </div>
  );
}

function NutLine({ base }: { base: number | undefined }) {
  const isBaseOne = !base || base === 1;
  return (
    <div
      className={`absolute top-0 left-0 w-full ${
        isBaseOne ? "h-2 bg-foreground/80" : "h-px bg-muted-foreground"
      }`}
    />
  );
}

function FretLines() {
  return [1, 2, 3, 4, 5].map((fret) => (
    <div
      key={fret}
      className="absolute w-full bg-foreground/50"
      style={{ top: `${(fret / 5) * 100}%`, height: "1px" }}
    />
  ));
}

function StringLines() {
  return [0, 1, 2, 3, 4, 5].map((str) => (
    <div
      key={str}
      className="absolute h-full bg-foreground/40"
      style={{ left: `${(str / 5) * 100}%`, width: "1px" }}
    />
  ));
}

function FretNumbers({ base, capo }: { base: number | undefined; capo: number }) {
  return [0, 1, 2, 3, 4].map((index) => (
    <span
      key={index}
      className="absolute -left-7 w-4 translate-y-[-50%] text-right text-[10px] font-bold text-muted-foreground"
      style={{ top: `${(index + 0.5) * 20}%` }}
    >
      {(base ?? 1) + index + capo}ª
    </span>
  ));
}

function Barre({ chordInfo, mirrored }: { chordInfo: ChordShape; mirrored: boolean }) {
  if (!chordInfo.barre) return null;
  const visual = barreVisualRange(chordInfo.barre, mirrored);

  return (
    <div
      className="absolute flex items-center rounded-full bg-primary shadow-lg"
      style={{
        top: `${((chordInfo.barre.fret - 0.5) / 5) * 100}%`,
        left: `calc(${(visual.from / 5) * 100}% - 6px)`,
        width: `calc(${((visual.to - visual.from) / 5) * 100}% + 12px)`,
        height: "14px",
        transform: "translateY(-50%)",
      }}
    >
      <span className="ml-[5px] text-[9px] font-bold text-primary-foreground">
        {chordInfo.fingers[chordInfo.barre.from]}
      </span>
    </div>
  );
}

function barreVisualRange(barre: NonNullable<ChordShape["barre"]>, mirrored: boolean) {
  if (!mirrored) return { from: barre.from, to: barre.to };
  return { from: 5 - barre.to, to: 5 - barre.from };
}

function FingerDots({ chordInfo, mirrored }: { chordInfo: ChordShape; mirrored: boolean }) {
  return chordInfo.frets.map((fret, stringIndex) => {
    if (!shouldRenderFingerDot(chordInfo, fret, stringIndex)) return null;
    const visualIndex = mirrored ? 5 - stringIndex : stringIndex;
    const numericFret = fret as number;
    return (
      <div
        key={stringIndex}
        className="absolute flex size-[14px] translate-y-[-50%] translate-x-[-50%] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-md"
        style={{
          left: `${(visualIndex / 5) * 100}%`,
          top: `${((numericFret - 0.5) / 5) * 100}%`,
        }}
      >
        {chordInfo.fingers[stringIndex]}
      </div>
    );
  });
}

function shouldRenderFingerDot(
  chordInfo: ChordShape,
  fret: ChordShape["frets"][number],
  stringIndex: number,
) {
  if (fret === "x" || fret === 0) return false;
  if (!chordInfo.barre) return true;
  return fret !== chordInfo.barre.fret || stringIndex < chordInfo.barre.from || stringIndex > chordInfo.barre.to;
}

function StringNames({ labels }: { labels: string[] }) {
  return (
    <div className="relative mt-2 h-4 w-full">
      {labels.map((name, index) => (
        <span
          key={index}
          className="absolute -ml-2 w-4 text-center font-mono text-[10px] text-muted-foreground"
          style={{ left: `${(index / 5) * 100}%` }}
        >
          {name}
        </span>
      ))}
    </div>
  );
}
