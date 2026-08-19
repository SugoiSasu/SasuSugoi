import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import {
  PATCH_NOTES,
  markPatchNotesSeen,
  onPatchNotesOpenRequest,
} from "@/lib/patch-notes";

export function PatchNotesModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return onPatchNotesOpenRequest(() => setOpen(true));
  }, []);

  function close() {
    setOpen(false);
    markPatchNotesSeen();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Co nowego w poŻeramy"
      className="fixed inset-0 z-[100] grid place-items-end sm:place-items-center bg-navy/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-tomato" />
            <h2 className="font-display text-xl font-extrabold">Co nowego?</h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Zamknij"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted -mr-1.5 -mt-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-7">
          {PATCH_NOTES.map((note) => (
            <section key={note.version}>
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="font-display text-base font-bold">{note.title}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(note.date).toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
              <ul className="space-y-3">
                {note.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tomato/10 text-lg"
                    >
                      {item.icon}
                    </span>
                    <p className="text-sm leading-snug pt-1.5">{item.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-border">
          <button
            type="button"
            onClick={close}
            className="w-full rounded-full bg-tomato text-cream py-2.5 text-sm font-semibold hover:bg-tomato/90 transition"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
}
