"use client";

import { type FormEvent, useState } from "react";
import { AlertTriangle, ListMusic, Loader2, Plus, Trash2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import type { SetlistSummary } from "@/lib/types";

type SetlistsHomeSectionProps = {
  setlists: SetlistSummary[];
  onCreate: (title: string) => Promise<void>;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function SetlistsHomeSection({
  setlists,
  onCreate,
  onOpen,
  onDelete,
  disabled,
}: SetlistsHomeSectionProps) {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SetlistSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || disabled || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await onCreate(t);
      setTitle("");
      setCreating(false);
    } catch (err) {
      setError(errorMessage(err, "Não foi possível criar a setlist."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    const id = confirmTarget.id;

    setConfirmTarget(null);
    setDeletingId(id);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(errorMessage(err, "Não foi possível remover a setlist."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="flex w-full flex-col gap-4">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
        <ListMusic className="size-3.5 shrink-0" />
        Setlists
      </h3>

      {error ? <SetlistFormError message={error} onDismiss={() => setError(null)} /> : null}

      {creating ? (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
          <Input
            placeholder="Nome da setlist"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
            autoFocus
            disabled={submitting}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="gap-2" disabled={disabled || submitting || !title.trim()}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Criar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setCreating(false);
                setTitle("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          disabled={disabled}
          onClick={() => {
            setError(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" />
          Nova setlist
        </Button>
      )}

      {setlists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma setlist ainda. Crie uma para montar o repertório do show.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {setlists.map((sl) => (
            <SetlistRow
              key={sl.id}
              setlist={sl}
              disabled={disabled}
              deleting={deletingId === sl.id}
              onOpen={onOpen}
              onRequestDelete={setConfirmTarget}
            />
          ))}
        </ul>
      )}

      <DeleteSetlistDialog
        setlist={confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
}

function SetlistRow({
  setlist,
  disabled,
  deleting,
  onOpen,
  onRequestDelete,
}: {
  setlist: SetlistSummary;
  disabled?: boolean;
  deleting: boolean;
  onOpen: (id: string) => void;
  onRequestDelete: (setlist: SetlistSummary) => void;
}) {
  return (
    <li className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/40 px-2 py-1">
      <button
        type="button"
        className="min-w-0 flex-1 truncate py-2 text-left text-sm font-medium text-foreground hover:underline"
        disabled={deleting}
        onClick={() => onOpen(setlist.id)}
      >
        {setlist.title}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        title="Remover setlist"
        disabled={disabled || deleting}
        onClick={() => onRequestDelete(setlist)}
      >
        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </li>
  );
}

function SetlistFormError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Alert variant="destructive" className="animate-in fade-in">
      <AlertTriangle className="size-4" />
      <AlertTitle className="sr-only">Erro</AlertTitle>
      <AlertDescription className="flex flex-1 items-start gap-2 pr-8">
        <span className="flex-1 text-sm">{message}</span>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={onDismiss}>
          <X className="size-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function DeleteSetlistDialog({
  setlist,
  onOpenChange,
  onConfirm,
}: {
  setlist: SetlistSummary | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={setlist !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover setlist &ldquo;{setlist?.title}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. As músicas adicionadas a esta setlist serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
