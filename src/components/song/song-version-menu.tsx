"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import {
  Check,
  Database,
  Globe,
  History,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SongVersion } from "@/lib/types";
import { useSongViewContext } from "./song-context";
import { ToolbarButton, ToolbarPopoverGroup } from "./song-toolbar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function versionLabel(v: SongVersion): string {
  switch (v) {
    case "saved":
      return "Personalizada";
    case "cache":
      return "Em cache";
    case "original":
      return "Original";
  }
}

function VersionIcon({
  version,
  className,
}: {
  version: SongVersion;
  className?: string;
}) {
  const icons: Record<SongVersion, typeof Pencil> = {
    saved: Pencil,
    cache: Database,
    original: Globe,
  };
  const Icon = icons[version];
  return <Icon className={className} />;
}

// ─── Toolbar Control ─────────────────────────────────────────────────────────

export function VersionToolbarControl({
  expanded,
  setExpanded,
  toggleMenu,
}: {
  expanded: string | null;
  setExpanded: (v: string | null) => void;
  toggleMenu: (menu: string) => void;
}) {
  const { songVersion } = useSongViewContext();

  return (
    <ToolbarPopoverGroup
      open={expanded === "version"}
      setExpanded={setExpanded}
      popoverContent={<VersionPopoverContent setExpanded={setExpanded} />}
    >
      <ToolbarButton
        active={songVersion !== "saved"}
        onClick={() => toggleMenu("version")}
        title="Versão da cifra"
        aria-label="Versão da cifra"
        className="flex-col gap-0 p-0"
      >
        <VersionIcon version={songVersion} className="size-3.5" />
        <span
          className={cn(
            "text-[8px] font-medium leading-none",
            songVersion !== "saved"
              ? "text-primary-foreground/70"
              : "text-muted-foreground",
          )}
        >
          Ver
        </span>
      </ToolbarButton>
    </ToolbarPopoverGroup>
  );
}

// ─── Popover Content ─────────────────────────────────────────────────────────

function VersionPopoverContent({
  setExpanded,
}: {
  setExpanded: (v: string | null) => void;
}) {
  const {
    songVersion,
    setSongVersion,
    onReloadOriginal,
    onResetSaved,
    onResetCache,
    versionActionPending,
    hasSavedVersion,
  } = useSongViewContext();

  const [confirmResetSaved, setConfirmResetSaved] = useState(false);

  return (
    <>
      <div className="flex w-56 flex-col gap-0.5 rounded-xl bg-popover p-1 shadow-md ring-1 ring-foreground/10">
        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Versão
        </p>

        <VersionOption
          version="saved"
          active={songVersion === "saved"}
          disabled={versionActionPending || !hasSavedVersion}
          hint={!hasSavedVersion ? "Sem versão salva" : undefined}
          onSelect={() => {
            setSongVersion("saved");
            setExpanded(null);
          }}
        />
        <VersionOption
          version="cache"
          active={songVersion === "cache"}
          disabled={versionActionPending}
          onSelect={() => {
            setSongVersion("cache");
            setExpanded(null);
          }}
        />
        <VersionOption
          version="original"
          active={songVersion === "original"}
          disabled={versionActionPending}
          onSelect={() => {
            onReloadOriginal();
            setExpanded(null);
          }}
        />

        <div className="mx-2 my-1.5 h-px bg-border" />

        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Ações
        </p>

        <VersionAction
          icon={History}
          label="Restaurar personalizada"
          helper="Volta a cifra salva ao conteúdo original"
          disabled={versionActionPending || !hasSavedVersion}
          pending={versionActionPending}
          onClick={() => setConfirmResetSaved(true)}
        />
        <VersionAction
          icon={RefreshCw}
          label="Limpar cache e atualizar"
          helper="Busca a cifra direto do Cifra Club e renova o cache"
          disabled={versionActionPending}
          pending={versionActionPending}
          onClick={() => {
            onResetCache();
            setExpanded(null);
          }}
        />
      </div>

      <AlertDialog open={confirmResetSaved} onOpenChange={setConfirmResetSaved}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar versão salva?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo personalizado será substituído pelo original da fonte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={versionActionPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={versionActionPending}
              onClick={() => {
                onResetSaved();
                setConfirmResetSaved(false);
                setExpanded(null);
              }}
            >
              {versionActionPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VersionOption({
  version,
  active,
  disabled,
  hint,
  onSelect,
}: {
  version: SongVersion;
  active: boolean;
  disabled: boolean;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      className={cn(
        "h-auto w-full justify-start gap-2 whitespace-normal rounded-lg px-2 py-1.5 text-sm",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-foreground",
        disabled && !active && "opacity-50",
      )}
      onClick={onSelect}
    >
      <VersionIcon version={version} className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 text-left">
        {versionLabel(version)}
        {hint ? (
          <span className="ml-1 text-xs text-muted-foreground">({hint})</span>
        ) : null}
      </span>
      {active ? <Check className="size-4 shrink-0" /> : null}
    </Button>
  );
}

function VersionAction({
  icon: Icon,
  label,
  helper,
  disabled,
  pending,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  helper: string;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      className="h-auto w-full justify-start gap-2 whitespace-normal rounded-lg px-2 py-1.5 text-sm"
      onClick={onClick}
    >
      {pending && disabled ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1 text-left">
        <p className="text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </div>
    </Button>
  );
}

// ─── Header Badge ────────────────────────────────────────────────────────────

export function VersionBadge({ className }: { className?: string }) {
  const { songVersion } = useSongViewContext();

  if (songVersion === "saved") return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px] leading-snug",
        songVersion === "original"
          ? "rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400"
          : "text-muted-foreground",
        className,
      )}
      title={
        songVersion === "original"
          ? "Versão direto da fonte — não substitui sua cifra salva"
          : undefined
      }
    >
      <VersionIcon version={songVersion} className="size-3" />
      <span>{versionLabel(songVersion)}</span>
    </div>
  );
}
