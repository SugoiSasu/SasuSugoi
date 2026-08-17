import { Loader2, AlertTriangle, RefreshCcw, Inbox } from "lucide-react";
import type { ReactNode, ComponentType } from "react";
import { toast } from "sonner";

export interface AsyncStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isFetching?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  emptyTitle?: string;
  emptyIcon?: ComponentType<{ size?: number; className?: string }>;
  emptyAction?: ReactNode;
  loadingText?: string;
  /** Number of skeleton rows to show while loading. */
  skeletonRows?: number;
  onRetry?: () => void | Promise<unknown>;
  children: React.ReactNode;
}

/**
 * Spójna obsługa stanów: ładowanie → błąd (z retry) → pusto → dane.
 * Używaj wszędzie tam, gdzie pobieramy dane przez react-query.
 */
export function AsyncState({
  isLoading,
  isError,
  error,
  isFetching,
  isEmpty,
  emptyText = "Brak danych.",
  emptyTitle,
  emptyIcon: EmptyIcon = Inbox,
  emptyAction,
  loadingText,
  skeletonRows = 3,
  onRetry,
  children,
}: AsyncStateProps) {
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-live="polite">
        {loadingText && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> {loadingText}
          </div>
        )}
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 animate-pulse"
          >
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 bg-muted rounded" />
              <div className="h-2 w-1/4 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "Nie udało się załadować danych.";
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
      >
        <div className="flex items-start gap-2 text-destructive mb-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Coś poszło nie tak</div>
            <div className="text-xs opacity-80 break-words">{msg}</div>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={() => onRetry()}
            className="inline-flex items-center gap-1.5 rounded-full bg-tomato text-cream px-3 py-1.5 text-xs font-semibold hover:bg-tomato/90"
          >
            <RefreshCcw size={12} /> Spróbuj ponownie
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
        <EmptyIcon size={32} className="mx-auto mb-3 text-muted-foreground/60" />
        {emptyTitle && (
          <div className="font-semibold text-foreground mb-1">{emptyTitle}</div>
        )}
        <div className="text-sm text-muted-foreground">{emptyText}</div>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="relative">
      {isFetching && (
        <div className="absolute right-2 top-2 z-10 text-muted-foreground" aria-hidden>
          <Loader2 size={14} className="animate-spin" />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Uruchamia mutację i pokazuje spójne tosty. Zwraca wynik lub `undefined` na błędzie.
 */
export async function runWithToast<T>(
  fn: () => Promise<T>,
  opts: { success?: string; error?: string; loading?: string } = {},
): Promise<T | undefined> {
  const toastId = opts.loading ? toast.loading(opts.loading) : undefined;
  try {
    const res = await fn();
    if (toastId !== undefined) toast.dismiss(toastId);
    if (opts.success) toast.success(opts.success);
    return res;
  } catch (e) {
    if (toastId !== undefined) toast.dismiss(toastId);
    const msg = e instanceof Error ? e.message : opts.error || "Coś poszło nie tak.";
    toast.error(opts.error || "Operacja nie powiodła się", {
      description: msg,
    });
    return undefined;
  }
}
