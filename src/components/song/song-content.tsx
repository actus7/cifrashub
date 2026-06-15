"use client";

import { memo, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { simplifyChord, transposeChord } from "@/lib/music";
import { cn } from "@/lib/utils";
import type { LyricLine, Section } from "@/lib/types";

type SongContentProps = {
  songData: Section[];
  showTabs: boolean;
  simplified: boolean;
  effectiveTransposition: number;
  fontSizeOffset: number;
  columns: number;
  spacingOffset: number;
  onChordClick: (chord: string) => void;
  expandTabs?: boolean;
};

type ContentChunk =
  | { type: "lyrics"; lines: LyricLine[] }
  | { type: "tabs"; lines: LyricLine[] };

function lineChunkType(line: LyricLine): ContentChunk["type"] {
  return line.length > 0 && Boolean(line[0]?.isTab) ? "tabs" : "lyrics";
}

function appendLineChunk(chunks: ContentChunk[], line: LyricLine) {
  const type = lineChunkType(line);
  const last = chunks[chunks.length - 1];
  if (last?.type === type) {
    last.lines.push(line);
    return;
  }
  chunks.push({ type, lines: [line] });
}

function chunkLinesByTab(content: LyricLine[]): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  for (const line of content) appendLineChunk(chunks, line);
  return chunks;
}

const SECTION_COLOR: Record<string, string> = {
  chorus: "text-primary",
  solo: "text-chart-4",
  "pre-chorus": "text-chart-2",
  bridge: "text-chart-5",
  intro: "text-muted-foreground/80",
  outro: "text-muted-foreground/80",
};

const BAR_COLOR: Record<string, string> = {
  chorus: "bg-primary",
  solo: "bg-chart-4",
  "pre-chorus": "bg-chart-2",
};

type LineHasChord = (line: LyricLine) => boolean;

type LineRenderProps = {
  line: LyricLine;
  rowKey: string;
  isLineTab: boolean;
  lineSpacing: number;
  lineRowGap: number;
  chordTextGap: number;
  lineHasChord: LineHasChord;
  onChordClick: (chord: string) => void;
  simplified: boolean;
  effectiveTransposition: number;
};

function resolveChord(
  raw: string | undefined,
  simplified: boolean,
  effectiveTransposition: number,
) {
  if (!raw) return undefined;
  let c = raw;
  if (simplified) c = simplifyChord(c);
  c = transposeChord(c, effectiveTransposition);
  return c || undefined;
}

function ChordBlock({
  block,
  displayChord,
  isLineTab,
  chordTextGap,
  onChordClick,
}: {
  block: LyricLine[number];
  displayChord: string | undefined;
  isLineTab: boolean;
  chordTextGap: number;
  onChordClick: (chord: string) => void;
}) {
  return (
    <div className={cn("flex flex-col", chordBlockSpacing(block))}>
      <ChordName displayChord={displayChord} onChordClick={onChordClick} />
      <ChordText block={block} isLineTab={isLineTab} chordTextGap={chordTextGap} />
    </div>
  );
}

function chordBlockSpacing(block: LyricLine[number]): string | false {
  return block.spaceAfter !== false && "mr-2 md:mr-3";
}

function ChordName({
  displayChord,
  onChordClick,
}: {
  displayChord: string | undefined;
  onChordClick: (chord: string) => void;
}) {
  return (
    <span
      role="button"
      tabIndex={displayChord ? 0 : -1}
      aria-label={displayChord ? `Acorde ${displayChord}` : undefined}
      className="chord-name -ml-0.5 cursor-pointer rounded-sm px-0.5 font-mono text-[1.05em] font-bold text-primary select-none whitespace-pre transition-colors hover:bg-primary/15"
      onClick={(e) => activateChord(e, displayChord, onChordClick)}
      onKeyDown={(e) => handleChordKeyDown(e, displayChord, onChordClick)}
    >
      {displayChord || "\u00A0"}
    </span>
  );
}

function activateChord(
  event: { stopPropagation: () => void },
  displayChord: string | undefined,
  onChordClick: (chord: string) => void,
) {
  event.stopPropagation();
  if (displayChord) onChordClick(displayChord);
}

function handleChordKeyDown(
  event: KeyboardEvent,
  displayChord: string | undefined,
  onChordClick: (chord: string) => void,
) {
  if (!isChordActivationKey(event.key)) return;
  event.preventDefault();
  activateChord(event, displayChord, onChordClick);
}

function isChordActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

function ChordText({
  block,
  isLineTab,
  chordTextGap,
}: {
  block: LyricLine[number];
  isLineTab: boolean;
  chordTextGap: number;
}) {
  return (
    <div
      className={cn(
        "text-[1em] leading-relaxed whitespace-pre text-foreground/85",
        isLineTab && "font-mono text-[0.9em] text-muted-foreground",
      )}
      style={{ marginTop: `${chordTextGap}px` }}
    >
      {block.text || "\u00A0"}
    </div>
  );
}

function CompactTabRow({ line }: { line: LyricLine }) {
  return (
    <div className="flex min-w-0 max-w-max flex-wrap items-center">
      {line.map((block, bIdx) => (
        <div
          key={bIdx}
          className={cn(block.spaceAfter !== false && "mr-2 md:mr-3")}
        >
          <div className="whitespace-pre font-mono text-[0.9em] leading-[1.35] text-muted-foreground">
            {block.text || "\u00A0"}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChordRow({
  line,
  isLineTab,
  lineSpacing,
  lineRowGap,
  chordTextGap,
  simplified,
  effectiveTransposition,
  onChordClick,
}: Omit<LineRenderProps, "lineHasChord" | "rowKey">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end",
        isLineTab && "min-w-0 max-w-max",
      )}
      style={{ marginBottom: `${lineSpacing}px`, rowGap: `${lineRowGap}px` }}
    >
      {line.map((block, bIdx) => {
        const displayChord = resolveChord(
          block.chord,
          simplified,
          effectiveTransposition,
        );
        return (
          <ChordBlock
            key={bIdx}
            block={block}
            displayChord={displayChord}
            isLineTab={isLineTab}
            chordTextGap={chordTextGap}
            onChordClick={onChordClick}
          />
        );
      })}
    </div>
  );
}

function renderLineRow(props: LineRenderProps) {
  const { line, rowKey, isLineTab, lineHasChord } = props;

  if (isLineTab && !lineHasChord(line)) {
    return <CompactTabRow key={rowKey} line={line} />;
  }

  return <ChordRow key={rowKey} {...props} />;
}

function TabsChunkPanel({
  chunk,
  idx,
  cIdx,
  showTabs,
  expandTabs,
  renderLineProps,
}: {
  chunk: ContentChunk;
  idx: number;
  cIdx: number;
  showTabs: boolean;
  expandTabs: boolean;
  renderLineProps: Omit<LineRenderProps, "line" | "rowKey" | "isLineTab">;
}) {
  if (!showTabs) return null;

  const nLines = chunk.lines.length;
  return (
    <details
      key={`tab-${idx}-${cIdx}`}
      open={expandTabs ? true : undefined}
      className={cn(
        "song-tab-accordion group/tab-acc no-print mb-3 w-full min-w-0 max-w-full break-inside-avoid rounded-lg border border-border/60 bg-card/40 shadow-sm",
        "open:border-border open:bg-card/60",
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-2",
          "text-[11px] font-semibold tracking-wide text-muted-foreground uppercase",
          "select-none hover:bg-muted/50",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span>
          Tablatura
          {nLines > 1 ? (
            <span className="ml-1.5 font-normal normal-case text-muted-foreground/80">
              ({nLines} linhas)
            </span>
          ) : null}
        </span>
        <ChevronDown className="song-tab-chevron size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/tab-acc:rotate-180" />
      </summary>
      <div
        className={cn(
          "song-tab-body border-t border-border/50 px-2 pb-2.5 pt-2",
          "motion-reduce:transition-none",
        )}
      >
        <div className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain">
          <div className="w-max max-w-none pr-1">
            {chunk.lines.map((line, lIdx) =>
              renderLineRow({
                ...renderLineProps,
                line,
                rowKey: `tb-${idx}-${cIdx}-${lIdx}`,
                isLineTab: true,
              }),
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

function sectionOnlyHasTabs(section: Section) {
  return (
    section.content.length > 0 &&
    section.content.every((line) => line.length > 0 && line[0]?.isTab)
  );
}

function SectionBar({ type }: { type: string }) {
  const barColor = BAR_COLOR[type];
  if (!barColor) return null;

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 -left-4 hidden w-[3px] rounded-full md:block no-print",
        barColor,
      )}
    />
  );
}

function sectionLabel(section: Section) {
  return section.label?.replace(/^\[|\]$/g, "") ?? "";
}

function sectionSummaryClassName(section: Section, label: string) {
  return cn(
    "mb-3 flex cursor-pointer list-none items-center gap-1.5 select-none",
    "[&::-webkit-details-marker]:hidden",
    label ? visibleSectionLabelClass(section.type) : "pointer-events-none opacity-0 h-0 mb-0 overflow-hidden",
  );
}

function visibleSectionLabelClass(type: string) {
  return cn(
    "text-[0.7em] font-semibold tracking-[0.1em] uppercase",
    "transition-opacity hover:opacity-75",
    SECTION_COLOR[type] ?? "text-muted-foreground",
  );
}

function SectionSummary({ section }: { section: Section }) {
  const label = sectionLabel(section);

  return (
    <summary className={sectionSummaryClassName(section, label)}>
      {label || null}
      {label && (
        <ChevronDown className="no-print size-[1.1em] shrink-0 opacity-50 transition-transform duration-200 group-open/section:rotate-180" />
      )}
    </summary>
  );
}

function SectionChunk({
  chunk,
  idx,
  cIdx,
  showTabs,
  expandTabs,
  renderLineProps,
}: {
  chunk: ContentChunk;
  idx: number;
  cIdx: number;
  showTabs: boolean;
  expandTabs: boolean;
  renderLineProps: Omit<LineRenderProps, "line" | "rowKey" | "isLineTab">;
}) {
  if (chunk.type === "tabs") {
    return (
      <TabsChunkPanel
        key={`tab-${idx}-${cIdx}`}
        chunk={chunk}
        idx={idx}
        cIdx={cIdx}
        showTabs={showTabs}
        expandTabs={expandTabs}
        renderLineProps={renderLineProps}
      />
    );
  }

  return chunk.lines.map((line, lIdx) =>
    renderLineRow({
      ...renderLineProps,
      line,
      rowKey: `ly-${idx}-${cIdx}-${lIdx}`,
      isLineTab: false,
    }),
  );
}

function SectionBlock({
  section,
  idx,
  sectionSpacing,
  showTabs,
  expandTabs,
  renderLineProps,
}: {
  section: Section;
  idx: number;
  sectionSpacing: number;
  showTabs: boolean;
  expandTabs: boolean;
  renderLineProps: Omit<LineRenderProps, "line" | "rowKey" | "isLineTab">;
}) {
  if (sectionOnlyHasTabs(section) && !showTabs) return null;

  return (
    <div
      key={idx}
      className={cn("relative min-w-0 break-inside-avoid", idx > 0 && "mt-6")}
      style={{ marginBottom: `${sectionSpacing}px` }}
    >
      <SectionBar type={section.type} />
      <details
        open
        className="song-section-accordion group/section relative pl-0 md:pl-6"
      >
        <SectionSummary section={section} />
        {chunkLinesByTab(section.content).map((chunk, cIdx) => (
          <SectionChunk
            key={`${chunk.type}-${idx}-${cIdx}`}
            chunk={chunk}
            idx={idx}
            cIdx={cIdx}
            showTabs={showTabs}
            expandTabs={expandTabs}
            renderLineProps={renderLineProps}
          />
        ))}
      </details>
    </div>
  );
}

export const SongContent = memo(function SongContent({
  songData,
  showTabs,
  simplified,
  effectiveTransposition,
  fontSizeOffset,
  columns,
  spacingOffset,
  onChordClick,
  expandTabs = false,
}: SongContentProps) {
  const sectionSpacing = 16 + spacingOffset;
  const lineSpacing = spacingOffset;
  const lineRowGap = spacingOffset * 0.5;
  const chordTextGap = spacingOffset * 0.25;

  const lineHasChord: LineHasChord = (line) =>
    line.some((block) => {
      let c = block.chord;
      if (!c) return false;
      if (simplified) c = simplifyChord(c);
      c = transposeChord(c, effectiveTransposition);
      return Boolean(c);
    });

  const renderLineProps: Omit<LineRenderProps, "line" | "rowKey" | "isLineTab"> = {
    lineSpacing,
    lineRowGap,
    chordTextGap,
    lineHasChord,
    onChordClick,
    simplified,
    effectiveTransposition,
  };

  return (
    <div
      className="relative z-10 min-w-0 transition-all duration-300"
      style={{
        fontSize: `calc(1rem + ${fontSizeOffset}px)`,
        columnCount: columns,
        columnGap: "3rem",
      }}
    >
      {songData.map((section, idx) => (
        <SectionBlock
          key={idx}
          section={section}
          idx={idx}
          sectionSpacing={sectionSpacing}
          showTabs={showTabs}
          expandTabs={expandTabs ?? false}
          renderLineProps={renderLineProps}
        />
      ))}
    </div>
  );
});
