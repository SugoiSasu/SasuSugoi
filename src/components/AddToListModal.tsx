import { useState } from "react";
import { Check, ListChecks, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { pluralPl } from "@/lib/plural-pl";
import {
  useMyLists,
  useCreateList,
  useAddPlaceToList,
  useRemovePlaceFromList,
  useMyListMembership,
  VISIBILITY_LABEL,
  type ListVisibility,
} from "@/lib/lists-api";

interface Props {
  placeId: string;
  placeName: string;
  onClose: () => void;
}

const WIDOCZNOSCI: ListVisibility[] = ["public", "friends", "private"];

/**
 * "Dodaj do listy" z paczki designu - checkboxy przy wszystkich wlasnych
 * listach plus zakladanie nowej bez wychodzenia z okna.
 *
 * Kliknicie checkboxa zapisuje od razu, bez osobnego "Zapisz": lista nalezy do
 * jednej osoby i nie ma tu nic, co trzeba by zatwierdzac zbiorczo. Przycisk na
 * dole zamyka okno, a nie zapisuje - stad "Gotowe".
 */
export function AddToListModal({ placeId, placeName, onClose }: Props) {
  const { data: listy, isLoading } = useMyLists();
  const { data: przynaleznosc } = useMyListMembership();
  const dodaj = useAddPlaceToList();
  const usun = useRemovePlaceFromList();
  const utworz = useCreateList();

  const [nowaOtwarta, setNowaOtwarta] = useState(false);
  const [nazwa, setNazwa] = useState("");
  const [opis, setOpis] = useState("");
  const [widocznosc, setWidocznosc] = useState<ListVisibility>("public");

  const naLiscie = new Set(przynaleznosc?.get(placeId) ?? []);

  async function przelacz(listId: string) {
    try {
      if (naLiscie.has(listId)) {
        await usun.mutateAsync({ listId, placeId });
      } else {
        await dodaj.mutateAsync({ listId, placeId });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać zmiany");
    }
  }

  async function utworzNowa(e: React.FormEvent) {
    e.preventDefault();
    const tytul = nazwa.trim();
    if (!tytul) return;
    try {
      await utworz.mutateAsync({
        title: tytul,
        description: opis.trim() || null,
        visibility: widocznosc,
        placeIds: [placeId],
      });
      toast.success(`Lista „${tytul}" utworzona`);
      setNazwa("");
      setOpis("");
      setNowaOtwarta(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się utworzyć listy");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="absolute inset-0 bg-navy/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Dodaj ${placeName} do listy`}
        className="pz-fade-in relative w-full max-w-md overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-border p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tomato/10 text-tomato">
            <ListChecks size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-extrabold leading-tight">Dodaj do listy</p>
            <p className="truncate text-xs text-muted-foreground">{placeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-3">
          {isLoading ? (
            <ul className="space-y-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="pz-skel h-12 rounded-xl" />
              ))}
            </ul>
          ) : !listy?.length ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nie masz jeszcze żadnej listy. Załóż pierwszą poniżej.
            </p>
          ) : (
            <ul className="space-y-1">
              {listy.map((l) => {
                const zaznaczona = naLiscie.has(l.id);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => przelacz(l.id)}
                      aria-pressed={zaznaczona}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-muted"
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${
                          zaznaczona ? "border-tomato bg-tomato text-cream" : "border-border"
                        }`}
                        aria-hidden
                      >
                        {zaznaczona && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{l.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {l.places_count}{" "}
                          {pluralPl(l.places_count, "miejsce", "miejsca", "miejsc")} ·{" "}
                          {VISIBILITY_LABEL[l.visibility]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Na telefonie arkusz konczy sie nad dolnym paskiem nawigacji i
            centralnym "+", a nie pod nimi - inaczej "Nowa lista" i "Gotowe"
            chowaja sie za przyciskiem. Na szerokich ekranach okno stoi na
            srodku i dodatkowy odstep jest zbedny. */}
        <div className="border-t border-border p-3 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:pb-3">
          {nowaOtwarta ? (
            <form onSubmit={utworzNowa} className="space-y-2.5">
              <input
                autoFocus
                value={nazwa}
                onChange={(e) => setNazwa(e.target.value)}
                placeholder="Nazwa listy"
                aria-label="Nazwa listy"
                maxLength={80}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-tomato"
              />
              <input
                value={opis}
                onChange={(e) => setOpis(e.target.value)}
                placeholder="Opis (opcjonalnie)"
                aria-label="Opis listy"
                maxLength={200}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-tomato"
              />
              <fieldset>
                <legend className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  Kto widzi listę
                </legend>
                <div className="flex gap-1.5">
                  {WIDOCZNOSCI.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWidocznosc(w)}
                      aria-pressed={widocznosc === w}
                      className={`flex-1 rounded-full px-2 py-2 text-[11px] font-extrabold transition ${
                        widocznosc === w
                          ? "bg-navy text-cream"
                          : "border border-border text-muted-foreground hover:border-tomato"
                      }`}
                    >
                      {VISIBILITY_LABEL[w]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setNowaOtwarta(false)}
                  className="flex-1 rounded-full border border-border py-2.5 text-xs font-semibold transition hover:border-tomato"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={!nazwa.trim() || utworz.isPending}
                  className="flex-1 rounded-full bg-tomato py-2.5 text-xs font-semibold text-cream transition disabled:opacity-50"
                >
                  {utworz.isPending ? (
                    <Loader2 size={14} className="mx-auto animate-spin" />
                  ) : (
                    "Utwórz listę"
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNowaOtwarta(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-dashed border-tomato/60 py-2.5 text-xs font-extrabold text-tomato transition hover:bg-tomato/5"
              >
                <Plus size={14} /> Nowa lista
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full bg-navy py-2.5 text-xs font-semibold text-cream"
              >
                Gotowe
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
