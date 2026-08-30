import { Loader2, Trash2, type LucideIcon } from "lucide-react";

export function ConfirmDeleteModal({
  open,
  title,
  description,
  pending,
  confirmLabel = "Usuń",
  icon: Icon = Trash2,
  confirmClassName = "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  pending?: boolean;
  confirmLabel?: string;
  icon?: LucideIcon;
  confirmClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"
      onClick={() => !pending && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-xl"
      >
        <h3 className="font-display text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="chip bg-card border border-border disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${confirmClassName}`}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
