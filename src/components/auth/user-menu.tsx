"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoginButton } from "@/components/auth/login-button";
import { signOut, useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function userInitials(name?: string | null): string {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?"
  );
}

function resolveBaseUrl(): string {
  const raw =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_BASE_URL ?? "/");
  return raw.replace(/\/+$/, "");
}

function UserAvatar({ image, name }: { image?: string | null; name?: string | null }) {
  return (
    <Avatar size="sm" className="size-8">
      <AvatarImage src={image ?? undefined} alt={name ?? ""} />
      <AvatarFallback className="text-[10px] font-semibold">
        {userInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é irreversível. Todos os seus dados — pastas, cifras,
            setlists e compartilhamentos — serão permanentemente excluídos.
            Você poderá criar uma nova conta depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Excluindo…" : "Excluir conta"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

async function deleteAccount() {
  const response = await fetch("/api/account", { method: "DELETE" });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    toast.error(payload?.error ?? "Erro ao excluir conta.");
    return;
  }

  await signOut({ callbackUrl: resolveBaseUrl() });
}

async function runDeleteAccount() {
  try {
    await deleteAccount();
  } catch {
    toast.error("Erro ao excluir conta.");
  }
}

function useDeleteAccount() {
  const [pending, startTransition] = useTransition();

  function handleDeleteAccount() {
    startTransition(() => {
      void runDeleteAccount();
    });
  }

  return { pending, handleDeleteAccount };
}

type UserMenuProps = {
  className?: string;
  triggerClassName?: string;
};

function UserMenu({ className, triggerClassName }: UserMenuProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { pending, handleDeleteAccount } = useDeleteAccount();

  if (!user) return null;

  const baseUrl = resolveBaseUrl();

  return (
    <div className={cn(className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex size-9 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            triggerClassName,
          )}
          aria-label="Menu da conta"
        >
          <UserAvatar image={user.image} name={user.name} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => signOut({ callbackUrl: baseUrl })}
          >
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
            Excluir conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteAccountDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pending={pending}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}

function LoadingAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "size-9 shrink-0 animate-pulse rounded-full bg-muted/60 ring-1 ring-border",
        className,
      )}
    />
  );
}

export function AuthHeaderControl({ className }: { className?: string }) {
  const { status } = useSession();

  if (status === "loading") return <LoadingAvatar className={className} />;
  if (status === "unauthenticated") return <LoginButton compact className={className} />;
  return <UserMenu className={className} />;
}
