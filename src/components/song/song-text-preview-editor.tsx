"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Eye, Minus, Plus, TextCursorInput, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  cleanSongSections,
  joinSectionPlainTexts,
  parsePlainTextCifra,
  sectionToPlainText,
  sectionsToPlainText,
} from "@/lib/parse-plain-cifra";
import { SONG_ARTICLE_WIDTH_CLASS } from "@/lib/song-article-layout";
import type { Section } from "@/lib/types";
import { SongContent } from "@/components/song/song-content";

function isEditorTextCanonical(fullText: string, songData: Section[]): boolean {
  const canonical = sectionsToPlainText(songData)
    .replace(/\r\n/g, "\n")
    .trimEnd();
  const text = fullText.replace(/\r\n/g, "\n").trimEnd();
  return text === canonical;
}

function sectionHeaderLabel(block: string, index: number): string {
  const first = block.split("\n")[0]?.trim() ?? "";
  if (/^\[[^\]]+\]$/.test(first)) return first;
  return `Seção ${index + 1}`;
}

const SECTION_SNIPPETS: { label: string; text: string }[] = [
  { label: "[Intro]", text: "[Intro]\n" },
  { label: "[Verso]", text: "[Verso]\n" },
  { label: "[Pré-Refrão]", text: "[Pré-Refrão]\n" },
  { label: "[Refrão]", text: "[Refrão]\n" },
  { label: "[Ponte]", text: "[Ponte]\n" },
  { label: "[Solo]", text: "[Solo]\n" },
  { label: "[Tablatura]", text: "[Tablatura]\n" },
  { label: "[Outro]", text: "[Outro]\n" },
];

type SongPreviewDisplayPrefs = {
  tone: number;
  capo: number;
  simplified: boolean;
  columns: number;
  spacingOffset: number;
};

type SongTextPreviewEditorProps = {
  songData: Section[];
  onApply: (next: Section[]) => void;
  onCancel: () => void;
  baseFontSizeOffsetPx?: number;
  previewDisplay?: SongPreviewDisplayPrefs;
  wrapStickyChrome?: (editorChrome: ReactNode, actionButtons: ReactNode) => ReactNode;
};

type PreviewPrefs = Required<SongPreviewDisplayPrefs> & {
  effectiveTransposition: number;
  fontSizeOffset: number;
};

const DEFAULT_PREVIEW_PREFS: Required<SongPreviewDisplayPrefs> = {
  tone: 0,
  capo: 0,
  simplified: false,
  columns: 1,
  spacingOffset: 0,
};

type TextareaRefs = React.RefObject<(HTMLTextAreaElement | null)[]>;

type SectionParseResult = ReturnType<typeof parsePlainTextCifra>;

type SectionListProps = {
  editorFontBoostPx: number;
  onAddSection: (index: number) => void;
  previewPrefs: PreviewPrefs;
  registerTextarea: (index: number, element: HTMLTextAreaElement | null) => void;
  removeSection: (index: number) => void;
  sectionParsed: SectionParseResult[];
  sectionTexts: string[];
  setActiveSectionIndex: (index: number) => void;
  setApplyError: (error: string | null) => void;
  updateSectionText: (index: number, value: string) => void;
};

export function SongTextPreviewEditor(props: SongTextPreviewEditorProps) {
  const editor = useSongTextPreviewEditor(props);

  return (
    <div className="no-print flex min-h-0 flex-1 flex-col">
      <StickyEditorChrome
        editorFontBoostPx={editor.editorFontBoostPx}
        insertAtCursor={editor.insertAtCursor}
        onApply={editor.handleApply}
        onCancel={props.onCancel}
        setEditorFontBoostPx={editor.setEditorFontBoostPx}
        wrapStickyChrome={props.wrapStickyChrome}
      />
      <EditorMain
        activeSectionIndex={editor.activeSectionIndex}
        editorFontBoostPx={editor.editorFontBoostPx}
        isCanonical={editor.isCanonical}
        onAddSection={editor.setAddSectionAfterIndex}
        parsed={editor.parsed}
        previewPrefs={editor.previewPrefs}
        registerTextarea={editor.registerTextarea}
        removeSection={editor.removeSection}
        sectionParsed={editor.sectionParsed}
        sectionTexts={editor.sectionTexts}
        setActiveSectionIndex={editor.setActiveSectionIndex}
        setApplyError={editor.setApplyError}
        updateSectionText={editor.updateSectionText}
      />
      {editor.applyError ? <ApplyErrorMessage error={editor.applyError} /> : null}
      <AddSectionDialog
        addSectionAfterIndex={editor.addSectionAfterIndex}
        insertSectionAfter={editor.insertSectionAfter}
        setAddSectionAfterIndex={editor.setAddSectionAfterIndex}
      />
    </div>
  );
}

function useSongTextPreviewEditor({
  songData,
  onApply,
  baseFontSizeOffsetPx = 0,
  previewDisplay,
}: SongTextPreviewEditorProps) {
  const state = useEditorState(songData);
  const derived = useEditorDerived(state.sectionTexts, songData, previewDisplay, baseFontSizeOffsetPx);
  const actions = useEditorActions(state, derived.fullText, onApply);

  return {
    ...state,
    ...derived,
    ...actions,
  };
}

function useEditorState(songData: Section[]) {
  const [sectionTexts, setSectionTexts] = useState<string[]>(() => songData.map(sectionToPlainText));
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [editorFontBoostPx, setEditorFontBoostPx] = useState(0);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [addSectionAfterIndex, setAddSectionAfterIndex] = useState<number | null>(null);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const registerTextarea = useCallback((index: number, element: HTMLTextAreaElement | null) => {
    textareaRefs.current[index] = element;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSectionTexts(songData.map(sectionToPlainText));
    setActiveSectionIndex(0);
    setApplyError(null);
  }, [songData]);

  return {
    activeSectionIndex,
    addSectionAfterIndex,
    applyError,
    editorFontBoostPx,
    registerTextarea,
    sectionTexts,
    setActiveSectionIndex,
    setAddSectionAfterIndex,
    setApplyError,
    setEditorFontBoostPx,
    setSectionTexts,
    textareaRefs,
  };
}

function useEditorDerived(
  sectionTexts: string[],
  songData: Section[],
  previewDisplay: SongPreviewDisplayPrefs | undefined,
  baseFontSizeOffsetPx: number,
) {
  const fullText = useMemo(() => joinSectionPlainTexts(sectionTexts), [sectionTexts]);
  const sectionParsed = useMemo(() => sectionTexts.map((text) => parsePlainTextCifra(text)), [sectionTexts]);
  const parsed = useMemo(() => parsePlainTextCifra(fullText), [fullText]);
  const previewPrefs = usePreviewPrefs(previewDisplay, baseFontSizeOffsetPx);

  return {
    fullText,
    isCanonical: isEditorTextCanonical(fullText, songData),
    parsed,
    previewPrefs,
    sectionParsed,
  };
}

type EditorState = ReturnType<typeof useEditorState>;

function useEditorActions(state: EditorState, fullText: string, onApply: (next: Section[]) => void) {
  const updateSectionText = useUpdateSectionText(state.setSectionTexts);
  const insertSectionAfter = useInsertSectionAfter(
    state.setSectionTexts,
    state.setApplyError,
    state.setActiveSectionIndex,
    state.textareaRefs,
  );
  const removeSection = useRemoveSection(state.setSectionTexts, state.setApplyError, state.setActiveSectionIndex);
  const insertAtCursor = useInsertAtCursor(
    state.sectionTexts,
    state.activeSectionIndex,
    state.textareaRefs,
    updateSectionText,
  );
  const handleApply = useHandleApply(fullText, state.setApplyError, onApply);

  return {
    handleApply,
    insertAtCursor,
    insertSectionAfter,
    removeSection,
    updateSectionText,
  };
}

function useUpdateSectionText(setSectionTexts: React.Dispatch<React.SetStateAction<string[]>>) {
  return useCallback((index: number, value: string) => {
    setSectionTexts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, [setSectionTexts]);
}

function useInsertSectionAfter(
  setSectionTexts: React.Dispatch<React.SetStateAction<string[]>>,
  setApplyError: React.Dispatch<React.SetStateAction<string | null>>,
  setActiveSectionIndex: React.Dispatch<React.SetStateAction<number>>,
  textareaRefs: TextareaRefs,
) {
  return useCallback((index: number, initialPlain: string) => {
    setSectionTexts((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, initialPlain);
      return next;
    });
    setApplyError(null);
    focusInsertedSection(textareaRefs, index + 1, initialPlain.length);
    setActiveSectionIndex(index + 1);
  }, [setActiveSectionIndex, setApplyError, setSectionTexts, textareaRefs]);
}

function useRemoveSection(
  setSectionTexts: React.Dispatch<React.SetStateAction<string[]>>,
  setApplyError: React.Dispatch<React.SetStateAction<string | null>>,
  setActiveSectionIndex: React.Dispatch<React.SetStateAction<number>>,
) {
  return useCallback((index: number) => {
    setSectionTexts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, sectionIndex) => sectionIndex !== index);
    });
    setApplyError(null);
    setActiveSectionIndex((prev) => nextActiveSectionIndex(prev, index));
  }, [setActiveSectionIndex, setApplyError, setSectionTexts]);
}

function useInsertAtCursor(
  sectionTexts: string[],
  activeSectionIndex: number,
  textareaRefs: TextareaRefs,
  updateSectionText: (index: number, value: string) => void,
) {
  return useCallback((snippet: string) => {
    const row = sectionTexts[activeSectionIndex];
    if (row === undefined) return;
    const textarea = textareaRefs.current[activeSectionIndex];
    if (!textarea) {
      updateSectionText(activeSectionIndex, row + snippet);
      return;
    }
    insertSnippetAtTextarea({ index: activeSectionIndex, row, snippet, textarea, textareaRefs, updateSectionText });
  }, [activeSectionIndex, sectionTexts, textareaRefs, updateSectionText]);
}

function useHandleApply(
  fullText: string,
  setApplyError: React.Dispatch<React.SetStateAction<string | null>>,
  onApply: (next: Section[]) => void,
) {
  return useCallback(() => {
    const result = parsePlainTextCifra(fullText);
    if (!result.ok) {
      setApplyError(result.error);
      return;
    }
    const cleaned = cleanSongSections(result.data);
    if (cleaned.length === 0) {
      setApplyError("A cifra ficou vazia após remover linhas em branco.");
      return;
    }
    setApplyError(null);
    onApply(cleaned);
  }, [fullText, onApply, setApplyError]);
}

function usePreviewPrefs(
  previewDisplay: SongPreviewDisplayPrefs | undefined,
  fontSizeOffset: number,
): PreviewPrefs {
  const prefs = { ...DEFAULT_PREVIEW_PREFS, ...previewDisplay };
  return {
    ...prefs,
    effectiveTransposition: prefs.tone - prefs.capo,
    fontSizeOffset,
  };
}

function nextActiveSectionIndex(activeIndex: number, removedIndex: number) {
  if (removedIndex < activeIndex) return activeIndex - 1;
  if (removedIndex === activeIndex) return Math.max(0, activeIndex - 1);
  return activeIndex;
}

function focusInsertedSection(textareaRefs: TextareaRefs, index: number, cursorPos: number) {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const textarea = textareaRefs.current[index];
        if (!textarea) return;
        textarea.focus({ preventScroll: true });
        const end = Math.min(cursorPos, textarea.value.length);
        textarea.setSelectionRange(end, end);
      });
    });
  });
}

function insertSnippetAtTextarea({
  index,
  row,
  snippet,
  textarea,
  textareaRefs,
  updateSectionText,
}: {
  index: number;
  row: string;
  snippet: string;
  textarea: HTMLTextAreaElement;
  textareaRefs: TextareaRefs;
  updateSectionText: (index: number, value: string) => void;
}) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const scrollTop = textarea.scrollTop;
  const scrollLeft = textarea.scrollLeft;
  updateSectionText(index, row.slice(0, start) + snippet + row.slice(end));
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      const nextTextarea = textareaRefs.current[index];
      if (!nextTextarea) return;
      nextTextarea.scrollTop = scrollTop;
      nextTextarea.scrollLeft = scrollLeft;
      nextTextarea.focus({ preventScroll: true });
      const pos = start + snippet.length;
      nextTextarea.setSelectionRange(pos, pos);
    });
  });
}

function StickyEditorChrome({
  editorFontBoostPx,
  insertAtCursor,
  onApply,
  onCancel,
  setEditorFontBoostPx,
  wrapStickyChrome,
}: {
  editorFontBoostPx: number;
  insertAtCursor: (snippet: string) => void;
  onApply: () => void;
  onCancel: () => void;
  setEditorFontBoostPx: React.Dispatch<React.SetStateAction<number>>;
  wrapStickyChrome?: (editorChrome: ReactNode, actionButtons: ReactNode) => ReactNode;
}) {
  const chromeBody = (
    <EditorChromeBody
      editorFontBoostPx={editorFontBoostPx}
      insertAtCursor={insertAtCursor}
      setEditorFontBoostPx={setEditorFontBoostPx}
    />
  );
  const actionButtons = <EditorActionButtons onApply={onApply} onCancel={onCancel} />;

  if (wrapStickyChrome) {
    return wrapStickyChrome(<div className="px-3 py-2 sm:px-4">{chromeBody}</div>, actionButtons);
  }

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-border/50 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        {chromeBody}
        {actionButtons}
      </div>
    </div>
  );
}

function EditorChromeBody({
  editorFontBoostPx,
  insertAtCursor,
  setEditorFontBoostPx,
}: {
  editorFontBoostPx: number;
  insertAtCursor: (snippet: string) => void;
  setEditorFontBoostPx: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <InsertSectionMenu insertAtCursor={insertAtCursor} />
      <Separator orientation="vertical" className="mx-0.5 hidden h-7 sm:block" />
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        Texto
      </span>
      <EditorFontControls
        editorFontBoostPx={editorFontBoostPx}
        setEditorFontBoostPx={setEditorFontBoostPx}
      />
    </div>
  );
}

function InsertSectionMenu({ insertAtCursor }: { insertAtCursor: (snippet: string) => void }) {
  const toolbarClass = "h-9 gap-1.5 rounded-lg px-2.5 text-xs sm:text-sm";
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(toolbarClass, buttonVariants({ variant: "outline", size: "sm" }))}
        title="Inserir cabeçalho de seção na posição do cursor"
      >
        <TextCursorInput className="size-4 opacity-80" />
        Inserir seção
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Snippet no cursor</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SECTION_SNIPPETS.map((snippet) => (
            <DropdownMenuItem
              key={snippet.label}
              onClick={() => insertAtCursor(snippet.text)}
            >
              {snippet.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditorFontControls({
  editorFontBoostPx,
  setEditorFontBoostPx,
}: {
  editorFontBoostPx: number;
  setEditorFontBoostPx: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title="Diminuir fonte do editor"
        disabled={editorFontBoostPx <= -4}
        onClick={() => setEditorFontBoostPx((size) => Math.max(-4, size - 2))}
      >
        <Minus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title="Aumentar fonte do editor"
        disabled={editorFontBoostPx >= 10}
        onClick={() => setEditorFontBoostPx((size) => Math.min(10, size + 2))}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function EditorActionButtons({ onApply, onCancel }: { onApply: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="button" size="sm" onClick={onApply}>
        Aplicar
      </Button>
    </div>
  );
}

function EditorMain({
  editorFontBoostPx,
  isCanonical,
  onAddSection,
  parsed,
  previewPrefs,
  registerTextarea,
  removeSection,
  sectionParsed,
  sectionTexts,
  setActiveSectionIndex,
  setApplyError,
  updateSectionText,
}: SectionListProps & {
  activeSectionIndex: number;
  isCanonical: boolean;
  parsed: SectionParseResult;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <EditorStatus parsed={parsed} isCanonical={isCanonical} />
      <SectionList
        editorFontBoostPx={editorFontBoostPx}
        onAddSection={onAddSection}
        previewPrefs={previewPrefs}
        registerTextarea={registerTextarea}
        removeSection={removeSection}
        sectionParsed={sectionParsed}
        sectionTexts={sectionTexts}
        setActiveSectionIndex={setActiveSectionIndex}
        setApplyError={setApplyError}
        updateSectionText={updateSectionText}
      />
    </div>
  );
}

function EditorStatus({ parsed, isCanonical }: { parsed: SectionParseResult; isCanonical: boolean }) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2 sm:px-4">
        <Eye className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Texto e pré-visualização alinhados por seção
        </span>
        {parsed.ok && !isCanonical ? (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
            ao vivo
          </span>
        ) : null}
      </div>
      {!parsed.ok ? (
        <div className="shrink-0 border-b border-amber-500/25 bg-amber-500/5 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
          {parsed.error}
        </div>
      ) : null}
    </>
  );
}

function SectionList({
  editorFontBoostPx,
  onAddSection,
  previewPrefs,
  registerTextarea,
  removeSection,
  sectionParsed,
  sectionTexts,
  setActiveSectionIndex,
  setApplyError,
  updateSectionText,
}: SectionListProps) {
  if (sectionTexts.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma seção para editar.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {sectionTexts.map((block, index) => (
        <SectionEditorRow
          key={`sec-row-${index}`}
          block={block}
          canRemove={sectionTexts.length > 1}
          editorFontBoostPx={editorFontBoostPx}
          index={index}
          onAddSection={onAddSection}
          previewPrefs={previewPrefs}
          registerTextarea={registerTextarea}
          removeSection={removeSection}
          sectionParsed={sectionParsed[index]!}
          setActiveSectionIndex={setActiveSectionIndex}
          setApplyError={setApplyError}
          updateSectionText={updateSectionText}
        />
      ))}
    </div>
  );
}

function SectionEditorRow({
  block,
  canRemove,
  editorFontBoostPx,
  index,
  onAddSection,
  previewPrefs,
  registerTextarea,
  removeSection,
  sectionParsed,
  setActiveSectionIndex,
  setApplyError,
  updateSectionText,
}: {
  block: string;
  canRemove: boolean;
  editorFontBoostPx: number;
  index: number;
  onAddSection: (index: number) => void;
  previewPrefs: PreviewPrefs;
  registerTextarea: (index: number, element: HTMLTextAreaElement | null) => void;
  removeSection: (index: number) => void;
  sectionParsed: SectionParseResult;
  setActiveSectionIndex: (index: number) => void;
  setApplyError: (error: string | null) => void;
  updateSectionText: (index: number, value: string) => void;
}) {
  const rowPreviewData = sectionParsed.ok ? sectionParsed.data : null;
  const sectionLabel = sectionHeaderLabel(block, index);
  const editorRows = Math.max(4, Math.min(40, block.split("\n").length + 3));

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch">
        <SectionTextEditor
          block={block}
          canRemove={canRemove}
          editorFontBoostPx={editorFontBoostPx}
          editorRows={editorRows}
          index={index}
          registerTextarea={registerTextarea}
          removeSection={removeSection}
          sectionLabel={sectionLabel}
          setActiveSectionIndex={setActiveSectionIndex}
          setApplyError={setApplyError}
          updateSectionText={updateSectionText}
        />
        <SectionPreview previewData={rowPreviewData} previewPrefs={previewPrefs} />
      </div>
      <AddSectionBelowButton onClick={() => onAddSection(index)} />
    </div>
  );
}

function SectionTextEditor({
  block,
  canRemove,
  editorFontBoostPx,
  editorRows,
  index,
  registerTextarea,
  removeSection,
  sectionLabel,
  setActiveSectionIndex,
  setApplyError,
  updateSectionText,
}: {
  block: string;
  canRemove: boolean;
  editorFontBoostPx: number;
  editorRows: number;
  index: number;
  registerTextarea: (index: number, element: HTMLTextAreaElement | null) => void;
  removeSection: (index: number) => void;
  sectionLabel: string;
  setActiveSectionIndex: (index: number) => void;
  setApplyError: (error: string | null) => void;
  updateSectionText: (index: number, value: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col border-border/50 p-3 sm:p-4 lg:border-r lg:pb-5">
      <div
        className={cn(
          "relative w-full shrink-0 rounded-xl border border-input bg-background shadow-inner",
          "transition-[box-shadow] focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        <RemoveSectionButton canRemove={canRemove} onClick={() => removeSection(index)} />
        <textarea
          ref={(element) => registerTextarea(index, element)}
          rows={editorRows}
          value={block}
          onChange={(event) => {
            updateSectionText(index, event.target.value);
            setApplyError(null);
          }}
          onFocus={() => setActiveSectionIndex(index)}
          spellCheck={false}
          style={{ fontSize: `calc(0.8125rem + ${editorFontBoostPx}px)` }}
          className="min-h-[5.5rem] w-full resize-y rounded-xl border-0 bg-transparent px-3 pb-2.5 pl-3 pr-11 pt-9 font-mono text-sm leading-relaxed text-foreground outline-none transition-[font-size] focus-visible:ring-0 lg:resize-y"
          aria-label={`Texto da seção ${index + 1}: ${sectionLabel}`}
        />
      </div>
    </div>
  );
}

function RemoveSectionButton({ canRemove, onClick }: { canRemove: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={!canRemove}
      className="absolute right-1 top-1 z-10 size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:text-muted-foreground/35"
      title={canRemove ? "Remover esta seção inteira" : "É preciso manter pelo menos uma seção"}
      aria-label={canRemove ? "Remover esta seção" : "Não é possível remover a única seção"}
      onClick={() => canRemove && onClick()}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function SectionPreview({
  previewData,
  previewPrefs,
}: {
  previewData: Section[] | null;
  previewPrefs: PreviewPrefs;
}) {
  return (
    <div className="flex min-h-0 flex-col justify-start bg-muted/15 p-3 sm:p-4 lg:h-full lg:pb-5">
      {previewData ? (
        <div className={cn(SONG_ARTICLE_WIDTH_CLASS, "min-w-0")}>
          <SongContent
            songData={previewData}
            showTabs
            expandTabs
            simplified={previewPrefs.simplified}
            nashvilleNumbers={false}
            tone={previewPrefs.effectiveTransposition}
            effectiveTransposition={previewPrefs.effectiveTransposition}
            fontSizeOffset={previewPrefs.fontSizeOffset}
            columns={previewPrefs.columns}
            spacingOffset={previewPrefs.spacingOffset}
            onChordClick={() => {}}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/55 px-4 py-10 text-center text-xs leading-relaxed text-muted-foreground">
          Prévia desta seção aparece quando o texto da cifra estiver válido.
        </div>
      )}
    </div>
  );
}

function AddSectionBelowButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center border-t border-dashed border-border/45 bg-muted/10 px-3 py-2.5 sm:py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 border-dashed text-xs sm:text-sm"
        onClick={onClick}
      >
        <Plus className="size-4 opacity-90" />
        Nova seção abaixo
      </Button>
    </div>
  );
}

function ApplyErrorMessage({ error }: { error: string }) {
  return (
    <p className="shrink-0 border-t border-border/40 px-4 py-2 text-sm text-destructive sm:px-6">
      {error}
    </p>
  );
}

function AddSectionDialog({
  addSectionAfterIndex,
  insertSectionAfter,
  setAddSectionAfterIndex,
}: {
  addSectionAfterIndex: number | null;
  insertSectionAfter: (index: number, initialPlain: string) => void;
  setAddSectionAfterIndex: (index: number | null) => void;
}) {
  return (
    <Dialog
      open={addSectionAfterIndex !== null}
      onOpenChange={(open) => {
        if (!open) setAddSectionAfterIndex(null);
      }}
    >
      <DialogContent className="max-w-md sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Nova seção</DialogTitle>
          <DialogDescription>
            Escolha o tipo de seção. Ela será inserida vazia (só o cabeçalho) e o cursor ficará pronto para você digitar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[min(60vh,22rem)] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
          {SECTION_SNIPPETS.map((snippet) => (
            <Button
              key={snippet.label}
              type="button"
              variant="outline"
              className="h-auto min-h-10 justify-start px-3 py-2.5 font-mono text-xs sm:text-sm"
              onClick={() => {
                if (addSectionAfterIndex === null) return;
                setAddSectionAfterIndex(null);
                insertSectionAfter(addSectionAfterIndex, snippet.text);
              }}
            >
              {snippet.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
