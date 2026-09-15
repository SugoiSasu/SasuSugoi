import { Plus, Trash2, X } from "lucide-react";
import type { MenuCategory } from "@/lib/places-api";

/** Structured menu editor: categories with items (name / price /
 *  description). Extracted from the admin place editor so the owner panel
 *  can use the same UI instead of asking restaurant owners to hand-write
 *  raw JSON in a textarea. */
export function MenuItemsEditor({
  value,
  onChange,
}: {
  value: MenuCategory[] | null;
  onChange: (v: MenuCategory[] | null) => void;
}) {
  const cats = value ?? [];
  const setCats = (next: MenuCategory[]) => onChange(next.length ? next : null);
  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Menu (kategorie + pozycje)
        </div>
        <button
          type="button"
          onClick={() => setCats([...cats, { category: "", items: [] }])}
          className="text-xs font-semibold text-tomato hover:underline inline-flex items-center gap-1"
        >
          <Plus size={12} /> Kategoria
        </button>
      </div>
      {cats.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Brak menu - użytkownicy zobaczą przycisk „Zaproponuj menu".
        </p>
      )}
      {cats.map((cat, ci) => (
        <div key={ci} className="rounded-lg border border-border p-2 space-y-2 bg-muted/30">
          <div className="flex gap-2">
            <input
              value={cat.category}
              onChange={(e) =>
                setCats(cats.map((c, i) => (i === ci ? { ...c, category: e.target.value } : c)))
              }
              placeholder="Nazwa kategorii (np. Kebab)"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => setCats(cats.filter((_, i) => i !== ci))}
              className="text-destructive hover:opacity-70"
              aria-label="Usuń kategorię"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            {cat.items.map((item, ii) => (
              <div key={ii} className="space-y-1">
                <div className="grid grid-cols-[1fr_5rem_auto] gap-1.5">
                  <input
                    value={item.name}
                    onChange={(e) =>
                      setCats(
                        cats.map((c, i) =>
                          i === ci
                            ? {
                                ...c,
                                items: c.items.map((x, j) =>
                                  j === ii ? { ...x, name: e.target.value } : x,
                                ),
                              }
                            : c,
                        ),
                      )
                    }
                    placeholder="Nazwa dania"
                    className="input py-1 text-sm"
                  />
                  <input
                    value={item.price ?? ""}
                    onChange={(e) =>
                      setCats(
                        cats.map((c, i) =>
                          i === ci
                            ? {
                                ...c,
                                items: c.items.map((x, j) =>
                                  j === ii ? { ...x, price: e.target.value } : x,
                                ),
                              }
                            : c,
                        ),
                      )
                    }
                    placeholder="28 zł"
                    className="input py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCats(
                        cats.map((c, i) =>
                          i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c,
                        ),
                      )
                    }
                    className="text-destructive hover:opacity-70 px-1"
                    aria-label="Usuń pozycję"
                  >
                    <X size={14} />
                  </button>
                </div>
                {/* Was missing entirely - AI-extracted descriptions (often
                    garbled, see project_ai_menu_extraction_quality_todo)
                    were invisible in this editor, so nobody could review or
                    fix them before they shipped to the public menu. */}
                <input
                  value={item.description ?? ""}
                  onChange={(e) =>
                    setCats(
                      cats.map((c, i) =>
                        i === ci
                          ? {
                              ...c,
                              items: c.items.map((x, j) =>
                                j === ii ? { ...x, description: e.target.value } : x,
                              ),
                            }
                          : c,
                      ),
                    )
                  }
                  placeholder="Opis (opcjonalnie) - sprawdź, czy AI nie namieszało"
                  className="input py-1 text-xs text-muted-foreground"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setCats(
                  cats.map((c, i) =>
                    i === ci ? { ...c, items: [...c.items, { name: "", price: "" }] } : c,
                  ),
                )
              }
              className="text-xs font-semibold text-tomato hover:underline inline-flex items-center gap-1"
            >
              <Plus size={11} /> Pozycja
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
