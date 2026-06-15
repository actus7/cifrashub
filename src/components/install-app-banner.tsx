"use client";

import { useState } from "react";
import Image from "next/image";
import { Share, X, Download, MoreHorizontal } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const DISMISSED_KEY = "pwa-install-dismissed";

type InstallPromptCardProps = {
  isIos: boolean;
  onDismiss: () => void;
  onInstall: () => void;
  onOpenIosGuide: () => void;
};

type IosInstallStepProps = {
  number: number;
  children: React.ReactNode;
};

export function InstallAppBanner() {
  const installState = usePwaInstall();
  const [dismissed, setDismissed] = useState(isInstallDismissed);
  const [iosDialogOpen, setIosDialogOpen] = useState(false);

  if (!shouldShowInstallBanner(installState, dismissed)) return null;

  return (
    <>
      <InstallPromptCard
        isIos={installState.isIos}
        onDismiss={() => dismissInstallBanner(setDismissed)}
        onInstall={() => handleInstall(installState.promptInstall, setDismissed)}
        onOpenIosGuide={() => setIosDialogOpen(true)}
      />
      <IosInstallDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />
    </>
  );
}

function isInstallDismissed() {
  return typeof window === "undefined" || localStorage.getItem(DISMISSED_KEY) === "1";
}

function shouldShowInstallBanner(
  installState: ReturnType<typeof usePwaInstall>,
  dismissed: boolean,
) {
  return !installState.isInstalled && !dismissed && (installState.canPrompt || installState.isIos);
}

function dismissInstallBanner(setDismissed: (dismissed: boolean) => void) {
  localStorage.setItem(DISMISSED_KEY, "1");
  setDismissed(true);
}

async function handleInstall(
  promptInstall: ReturnType<typeof usePwaInstall>["promptInstall"],
  setDismissed: (dismissed: boolean) => void,
) {
  await promptInstall();
  dismissInstallBanner(setDismissed);
}

function InstallPromptCard({ isIos, onDismiss, onInstall, onOpenIosGuide }: InstallPromptCardProps) {
  return (
    <div className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm md:hidden">
      <Image
        src="/logo-mark.png"
        alt=""
        aria-hidden
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-xl object-contain"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-semibold leading-tight">Instalar CifrasHub</p>
        <p className="text-xs text-muted-foreground">Acesso rápido • Funciona offline</p>
      </div>
      {isIos ? (
        <Button size="sm" variant="outline" onClick={onOpenIosGuide} className="shrink-0">
          Como instalar
        </Button>
      ) : (
        <Button size="sm" onClick={onInstall} className="shrink-0">
          <Download />
          Instalar
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onDismiss}
        aria-label="Fechar"
        className="shrink-0 text-muted-foreground"
      >
        <X />
      </Button>
    </div>
  );
}

function IosInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Instalar no iPhone / iPad</DialogTitle>
          <DialogDescription>
            Siga os passos abaixo no Safari para adicionar o app à sua tela de início.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-4 text-sm">
          <IosInstallStep number={1}>
            Toque no ícone de{" "}
            <strong className="inline-flex items-center gap-1">
              Compartilhar <Share className="inline size-4 align-text-bottom" />
            </strong>{" "}
            na barra inferior do Safari.
          </IosInstallStep>
          <IosInstallStep number={2}>
            Role para baixo e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
          </IosInstallStep>
          <IosInstallStep number={3}>
            Confirme tocando em <strong>&quot;Adicionar&quot;</strong> no canto superior direito.
          </IosInstallStep>
        </ol>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MoreHorizontal className="size-3.5" />
          No iPad, o botão de compartilhar fica na barra superior.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function IosInstallStep({ number, children }: IosInstallStepProps) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {number}
      </span>
      <span>{children}</span>
    </li>
  );
}
