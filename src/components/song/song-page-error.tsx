import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { navigateBackOrFallback } from "@/lib/navigation";

interface SongPageErrorProps {
  error: Error | string;
  onRetry?: () => void;
}

export function SongPageError({ error, onRetry }: SongPageErrorProps) {
  const router = useRouter();
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold tracking-tight">Ops! Algo deu errado.</h2>
      <p className="mb-8 max-w-[400px] text-muted-foreground">
        Não foi possível carregar esta cifra. {errorMessage}
      </p>
      
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          variant="outline"
          onClick={() => navigateBackOrFallback(router)}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        {onRetry && (
          <Button onClick={onRetry} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
