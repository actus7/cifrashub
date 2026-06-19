"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Columns2,
  FlipHorizontal,
  Guitar,
  Magnet,
  Minus,
  Plus,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRelativeKeyToggle, transposeRootNote } from "@/lib/music";
import type { Section } from "@/lib/types";
import { useSongViewContext } from "./song-context";

function firstChordRoot(songData: Section[]): string | undefined {
  for (const section of songData) {
    const root = firstSectionChordRoot(section);
    if (root) return root;
  }
  return undefined;
}

function firstSectionChordRoot(section: Section) {
  for (const line of section.content) {
    const root = firstLineChordRoot(line);
    if (root) return root;
  }
  return undefined;
}

function firstLineChordRoot(line: Section["content"][number]) {
  for (const block of line) {
    const root = block.chord?.match(/^([A-G][#b]?)/)?.[1];
    if (root) return root;
  }
  return undefined;
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="icon"
      className={cn(
        "relative z-10 size-10 shrink-0 rounded-xl shadow-md transition-all",
        active ? "shadow-primary/20 bg-primary/95 text-primary-foreground hover:bg-primary" : "bg-background/95 backdrop-blur",
        className,
      )}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

function ExpandButton({
  onClick,
  children,
  title,
  ariaLabel,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={disabled}
      title={title}
      className={cn(
        "size-9 shrink-0 rounded-xl shadow-md text-foreground",
        disabled && "opacity-50",
      )}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

function ToolbarPopoverGroup({
  open,
  setExpanded,
  popoverContent,
  children,
}: {
  open: boolean;
  setExpanded: (v: string | null) => void;
  popoverContent?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setExpanded(null);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, setExpanded]);

  return (
    <div ref={ref} className="relative flex items-center justify-end">
      {popoverContent && (
        <div
          className={cn(
            "absolute right-full mr-2 flex items-center gap-1.5 transition-all duration-300",
            open
              ? "pointer-events-auto translate-x-0 opacity-100"
              : "pointer-events-none translate-x-4 opacity-0",
          )}
        >
          {popoverContent}
        </div>
      )}
      {children}
    </div>
  );
}

export const SongToolbar = memo(function SongToolbar() {
  const { zenMode } = useSongViewContext();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (zenMode) return null;

  const toggleMenu = (menu: string) => setExpanded((prev) => (prev === menu ? null : menu));

  return (
    <div className="no-print fixed right-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom,1rem)))] sm:bottom-auto sm:top-1/2 z-40 sm:-translate-y-1/2 flex flex-col items-end sm:items-center gap-2 sm:right-4">
      <ToneControl expanded={expanded} setExpanded={setExpanded} toggleMenu={toggleMenu} />
      <CapoControl expanded={expanded} setExpanded={setExpanded} toggleMenu={toggleMenu} />
      <ToolbarSeparator />
      <LayoutControls expanded={expanded} setExpanded={setExpanded} toggleMenu={toggleMenu} />
      <ToolbarSeparator />
      <DisplayModeControls setExpanded={setExpanded} />
    </div>
  );
});

function ToneControl({
  expanded,
  setExpanded,
  toggleMenu,
}: {
  expanded: string | null;
  setExpanded: (v: string | null) => void;
  toggleMenu: (menu: string) => void;
}) {
  const { tone, setTone, currentSong, songData } = useSongViewContext();
  const writtenKey = currentSong.cifraWrittenKey;
  const displayKey = writtenKey ?? currentSong.cifraSoundingKey ?? firstChordRoot(songData);
  const relToggle = writtenKey ? getRelativeKeyToggle(writtenKey, tone) : null;

  return (
    <ToolbarPopoverGroup
      open={expanded === "tone"}
      setExpanded={setExpanded}
      popoverContent={<TonePopoverContent tone={tone} setTone={setTone} relToggle={relToggle} setExpanded={setExpanded} />}
    >
      <ToolbarButton active={tone !== 0} onClick={() => toggleMenu("tone")} title="Tom" className="flex-col gap-0 p-0">
        <ToneButtonLabel displayKey={displayKey} tone={tone} />
      </ToolbarButton>
    </ToolbarPopoverGroup>
  );
}

function TonePopoverContent({
  tone,
  setTone,
  relToggle,
  setExpanded,
}: {
  tone: number;
  setTone: (tone: number) => void;
  relToggle: ReturnType<typeof getRelativeKeyToggle> | null;
  setExpanded: (v: string | null) => void;
}) {
  return (
    <>
      <ExpandButton onClick={() => setTone(tone - 1)}><Minus className="size-3.5" /></ExpandButton>
      <ExpandButton onClick={() => setTone(tone + 1)}><Plus className="size-3.5" /></ExpandButton>
      {relToggle && <RelativeToneButton relToggle={relToggle} setTone={setTone} setExpanded={setExpanded} />}
    </>
  );
}

function ToneButtonLabel({ displayKey, tone }: { displayKey: string | undefined; tone: number }) {
  return (
    <>
      <span className={cn("text-[8px] font-medium leading-none", tone !== 0 ? "text-primary-foreground/70" : "text-muted-foreground")}>Tom</span>
      <span className="text-xs font-bold leading-none">{toneLabel(displayKey, tone)}</span>
    </>
  );
}

function RelativeToneButton({
  relToggle,
  setTone,
  setExpanded,
}: {
  relToggle: NonNullable<ReturnType<typeof getRelativeKeyToggle>>;
  setTone: (tone: number) => void;
  setExpanded: (v: string | null) => void;
}) {
  return (
    <>
      <div className="mx-1 h-5 w-px bg-border/50" />
      <Button
        type="button"
        size="sm"
        variant={relToggle.isAtRelative ? "default" : "outline"}
        className="h-9 gap-1.5 rounded-xl px-3 text-[10px] font-bold"
        onClick={() => {
          setTone(relToggle.targetTone);
          setExpanded(null);
        }}
      >
        <ArrowLeftRight className="size-3" />
        {relToggle.label}
      </Button>
    </>
  );
}

function toneLabel(displayKey: string | undefined, tone: number) {
  if (displayKey) return transposeRootNote(displayKey, tone);
  if (tone === 0) return "—";
  return tone > 0 ? `+${tone}` : `${tone}`;
}

function CapoControl({
  expanded,
  setExpanded,
  toggleMenu,
}: {
  expanded: string | null;
  setExpanded: (v: string | null) => void;
  toggleMenu: (menu: string) => void;
}) {
  const { capo, setCapo } = useSongViewContext();

  return (
    <ToolbarPopoverGroup
      open={expanded === "capo"}
      setExpanded={setExpanded}
      popoverContent={
        <>
          <ExpandButton onClick={() => setCapo(Math.max(0, capo - 1))} disabled={capo <= 0}><Minus className="size-3.5" /></ExpandButton>
          <ExpandButton onClick={() => setCapo(Math.min(12, capo + 1))} disabled={capo >= 12}><Plus className="size-3.5" /></ExpandButton>
        </>
      }
    >
      <ToolbarButton active={capo !== 0} onClick={() => toggleMenu("capo")} title="Capotraste" className="flex-col gap-0 p-0">
        <CapoButtonContent capo={capo} />
      </ToolbarButton>
    </ToolbarPopoverGroup>
  );
}

function CapoButtonContent({ capo }: { capo: number }) {
  if (capo !== 0) {
    return (
      <>
        <span className="text-[10px] font-bold leading-none">Cp</span>
        <span className="text-xs font-bold leading-none">{capo}</span>
      </>
    );
  }

  return (
    <>
      <Magnet className="mb-[1px] size-3" />
      <span className="text-[10px] font-bold leading-none">Cp</span>
    </>
  );
}

function LayoutControls({
  expanded,
  setExpanded,
  toggleMenu,
}: {
  expanded: string | null;
  setExpanded: (v: string | null) => void;
  toggleMenu: (menu: string) => void;
}) {
  return (
    <>
      <FontControl expanded={expanded} setExpanded={setExpanded} toggleMenu={toggleMenu} />
      <SpacingControl expanded={expanded} setExpanded={setExpanded} toggleMenu={toggleMenu} />
      <ColumnsControl expanded={expanded} setExpanded={setExpanded} toggleMenu={toggleMenu} />
    </>
  );
}

function FontControl({ expanded, setExpanded, toggleMenu }: ControlProps) {
  const { fontSizeOffset, setFontSizeOffset } = useSongViewContext();
  const fontScale = Math.round((1 + fontSizeOffset / 16) * 100);

  return (
    <ToolbarPopoverGroup
      open={expanded === "font"}
      setExpanded={setExpanded}
      popoverContent={
        <>
          <ExpandButton onClick={() => setFontSizeOffset(Math.max(-8, fontSizeOffset - 2))}><Minus className="size-3.5" /></ExpandButton>
          <ExpandButton onClick={() => setFontSizeOffset(Math.min(24, fontSizeOffset + 2))}><Plus className="size-3.5" /></ExpandButton>
        </>
      }
    >
      <ToolbarButton active={fontSizeOffset !== 0} onClick={() => toggleMenu("font")} title="Tamanho da fonte" className="flex-col gap-0 p-0">
        <Type className="size-3" />
        <span className="mt-[1px] text-[9px] font-bold leading-none">{fontScale}%</span>
      </ToolbarButton>
    </ToolbarPopoverGroup>
  );
}

function SpacingControl({ expanded, setExpanded, toggleMenu }: ControlProps) {
  const { spacingOffset, setSpacingOffset } = useSongViewContext();

  return (
    <ToolbarPopoverGroup
      open={expanded === "spacing"}
      setExpanded={setExpanded}
      popoverContent={
        <>
          <ExpandButton onClick={() => setSpacingOffset(Math.max(-8, spacingOffset - 2))} disabled={spacingOffset <= -8}><Minus className="size-3.5" /></ExpandButton>
          <ExpandButton onClick={() => setSpacingOffset(Math.min(32, spacingOffset + 2))} disabled={spacingOffset >= 32}><Plus className="size-3.5" /></ExpandButton>
        </>
      }
    >
      <ToolbarButton active={spacingOffset !== 0} onClick={() => toggleMenu("spacing")} title="Espaçamento entre linhas" className="flex-col gap-0 p-0">
        {spacingOffset !== 0 ? <span className="text-xs font-bold leading-none">{spacingOffset}</span> : <ArrowUpDown className="size-4" />}
      </ToolbarButton>
    </ToolbarPopoverGroup>
  );
}

function ColumnsControl({ expanded, setExpanded, toggleMenu }: ControlProps) {
  const { columns, setColumns } = useSongViewContext();

  return (
    <ToolbarPopoverGroup
      open={expanded === "columns"}
      setExpanded={setExpanded}
      popoverContent={
        <>
          <ExpandButton onClick={() => setColumns(Math.max(1, columns - 1))} disabled={columns <= 1}><Minus className="size-3.5" /></ExpandButton>
          <ExpandButton onClick={() => setColumns(Math.min(6, columns + 1))} disabled={columns >= 6}><Plus className="size-3.5" /></ExpandButton>
        </>
      }
    >
      <ToolbarButton active={columns > 1} onClick={() => toggleMenu("columns")} title="Colunas em telas grandes" className={cn(columns > 1 && "flex-col gap-0 p-0")}>
        {columns > 1 ? (
          <>
            <Columns2 className="mb-[1px] size-3" />
            <span className="text-xs font-bold leading-none">{columns}</span>
          </>
        ) : <Columns2 className="size-4" />}
      </ToolbarButton>
    </ToolbarPopoverGroup>
  );
}

type ControlProps = {
  expanded: string | null;
  setExpanded: (v: string | null) => void;
  toggleMenu: (menu: string) => void;
};

function DisplayModeControls({ setExpanded }: { setExpanded: (v: string | null) => void }) {
  const { showTabs, setShowTabs, simplified, setSimplified, nashvilleNumbers, setNashvilleNumbers, mirrored, setMirrored } = useSongViewContext();
  const close = () => setExpanded(null);

  return (
    <>
      <ToolbarButton active={showTabs} onClick={() => { setShowTabs(!showTabs); close(); }} title={showTabs ? "Ocultar tablaturas" : "Mostrar tablaturas"} className="font-mono text-[10px] font-extrabold tracking-widest">
        TAB
      </ToolbarButton>
      <ToolbarButton active={simplified} onClick={() => { setSimplified(!simplified); close(); }} title={simplified ? "Mostrar acordes originais" : "Simplificar acordes"}>
        <Guitar className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={nashvilleNumbers} onClick={() => { setNashvilleNumbers(!nashvilleNumbers); close(); }} title={nashvilleNumbers ? "Mostrar cifras" : "Mostrar graus"} className="font-mono text-xs font-extrabold">
        Nº
      </ToolbarButton>
      <ToolbarButton active={mirrored} onClick={() => { setMirrored(!mirrored); close(); }} title={mirrored ? "Mão direita (padrão)" : "Mão esquerda (canhoto)"}>
        <FlipHorizontal className="size-4 -scale-x-100" />
      </ToolbarButton>
    </>
  );
}

function ToolbarSeparator() {
  return <div className="my-0.5 h-px w-6 bg-border/40" />;
}
