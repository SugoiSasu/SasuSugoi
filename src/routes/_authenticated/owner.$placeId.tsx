import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, ExternalLink, ShieldAlert, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/use-auth";
import { useIsOwnerOf } from "@/lib/owners-api";
import type { OpeningHours, MenuCategory } from "@/lib/places-api";
import { MenuItemsEditor } from "@/components/MenuItemsEditor";

export const Route = createFileRoute("/_authenticated/owner/$placeId")({
  head: () => ({ meta: [{ title: "Edycja knajpy - poŻeramy" }] }),
  component: OwnerPlaceEditor,
});

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: "mon", label: "Poniedziałek" },
  { key: "tue", label: "Wtorek" },
  { key: "wed", label: "Środa" },
  { key: "thu", label: "Czwartek" },
  { key: "fri", label: "Piątek" },
  { key: "sat", label: "Sobota" },
  { key: "sun", label: "Niedziela" },
];

interface EditablePlace {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  website: string | null;
  menu_url: string | null;
  menu_image_url: string | null;
  opening_hours: OpeningHours | null;
  menu_items: unknown;
}

function usePlaceForEdit(placeId: string) {
  return useQuery({
    queryKey: ["owner-place", placeId],
    enabled: !!placeId,
    // This feeds a long-lived edit form. The default staleTime of 0 plus
    // refetchOnWindowFocus meant alt-tabbing away and back re-fetched the
    // row - which, together with the hydration effect below, used to wipe
    // everything the owner had typed.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EditablePlace | null> => {
      const { data, error } = await supabase
        .from("places")
        .select("id, slug, name, phone, website, menu_url, menu_image_url, opening_hours, menu_items")
        .eq("id", placeId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EditablePlace) ?? null;
    },
  });
}

function OwnerPlaceEditor() {
  const { placeId } = Route.useParams();
  const { user } = useUser();
  const { data: isOwner, isLoading: checkingOwner, isError: ownerCheckFailed } =
    useIsOwnerOf(placeId);
  const { data: place, isLoading, isError: placeLoadFailed } = usePlaceForEdit(placeId);
  const qc = useQueryClient();

  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuImg, setMenuImg] = useState("");
  const [hours, setHours] = useState<OpeningHours>({});
  const [menuItems, setMenuItems] = useState<MenuCategory[] | null>(null);

  // Hydrate the form from the server row exactly once per place, not on every
  // change of the query object's identity. A background refetch (window focus,
  // cache invalidation after save) hands back a new object with the same data,
  // and re-running the setters on that would silently replace whatever the
  // owner had typed but not yet saved.
  const hydratedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!place || hydratedForRef.current === place.id) return;
    hydratedForRef.current = place.id;
    setPhone(place.phone ?? "");
    setWebsite(place.website ?? "");
    setMenuUrl(place.menu_url ?? "");
    setMenuImg(place.menu_image_url ?? "");
    setHours(place.opening_hours ?? {});
    setMenuItems((place.menu_items as MenuCategory[] | null) ?? null);
  }, [place]);

  const dirty =
    !!place &&
    hydratedForRef.current === place.id &&
    (phone !== (place.phone ?? "") ||
      website !== (place.website ?? "") ||
      menuUrl !== (place.menu_url ?? "") ||
      menuImg !== (place.menu_image_url ?? "") ||
      JSON.stringify(hours) !== JSON.stringify(place.opening_hours ?? {}) ||
      JSON.stringify(menuItems) !== JSON.stringify(place.menu_items ?? null));

  // Closing the tab with unsaved edits is the one exit path React Router can't
  // intercept, so it gets the browser's own guard.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async () => {
      // A day that is set to open must carry both ends. updateDay no longer
      // invents a closing time the owner never picked, so a half-filled day
      // has to be caught here instead of being saved as a silent default.
      const incomplete = DAYS.filter(({ key }) => {
        const d = hours[key];
        return d != null && (!d.open || !d.close);
      });
      if (incomplete.length > 0) {
        throw new Error(
          "Uzupełnij obie godziny (otwarcie i zamknięcie) dla: " +
            incomplete.map((d) => d.label).join(", "),
        );
      }
      const { data: updated, error } = await supabase
        .from("places")
        .update({
          phone: phone.trim() || null,
          website: normalizeUrl(website) || null,
          menu_url: normalizeUrl(menuUrl) || null,
          menu_image_url: normalizeUrl(menuImg) || null,
          opening_hours: (hours as unknown) as never,
          menu_items: (menuItems as unknown) as never,
        })
        .eq("id", placeId)
        .select("id");
      if (error) throw error;
      // Without .select() a row filtered out by RLS comes back as error: null
      // with nothing updated - the UI used to toast success over a save that
      // never happened.
      if (!updated || updated.length === 0) {
        throw new Error(
          "Nie zapisano - brak uprawnień do tej knajpy. Odśwież stronę i spróbuj ponownie.",
        );
      }
    },
    onSuccess: () => {
      toast.success("Zapisano zmiany");
      // The form is now in sync with the server, so let the next fetched row
      // re-hydrate it (picks up any normalization the save applied).
      hydratedForRef.current = null;
      qc.invalidateQueries({ queryKey: ["owner-place", placeId] });
      qc.invalidateQueries({ queryKey: ["places"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (checkingOwner || isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="animate-spin text-tomato" size={26} />
      </div>
    );
  }

  // A failed query settles with data: undefined, which is indistinguishable
  // from "not the owner" unless the error case is handled first - a verified
  // owner on a flaky connection was being told they don't own their place.
  if (ownerCheckFailed || placeLoadFailed) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card p-6 text-sm text-foreground flex items-start gap-3">
        <AlertTriangle className="text-tomato mt-0.5 shrink-0" size={18} />
        <div>
          Nie udało się wczytać danych knajpy. Sprawdź połączenie i odśwież stronę - Twoje
          uprawnienia właściciela nie zostały zmienione.
        </div>
      </div>
    );
  }

  if (!user || !isOwner) {
    return (
      <div className="rounded-2xl border-2 border-tomato/40 bg-tomato/10 p-6 text-sm text-foreground flex items-start gap-3">
        <ShieldAlert className="text-tomato mt-0.5" size={18} />
        <div>
          Nie jesteś zweryfikowanym właścicielem tej knajpy. Wejdź na jej profil i wyślij
          zgłoszenie.
        </div>
      </div>
    );
  }

  if (!place) {
    return <div className="text-sm text-muted-foreground">Nie znaleziono knajpy.</div>;
  }

  function updateDay(key: keyof OpeningHours, patch: { open?: string; close?: string; closed?: boolean }) {
    setHours((h) => {
      const next = { ...h };
      if (patch.closed) {
        next[key] = null;
      } else {
        // No invented defaults: filling only the opening time used to silently
        // save close: "22:00", a value the owner never chose and never saw
        // confirmed. An incomplete day is now caught by save()'s validation.
        const current = next[key] ?? { open: "", close: "" };
        next[key] = {
          open: patch.open ?? current.open,
          close: patch.close ?? current.close,
        };
      }
      return next;
    });
  }

  return (
    // A real <form>: the url/tel inputs below carry native validation that
    // never ran while submitting was a type="button" onClick handler.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="rounded-3xl bg-card border border-border p-5 sm:p-6 space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-foreground/60 font-semibold">
            Edytujesz
          </div>
          <h2 className="font-display text-2xl text-foreground">{place.name}</h2>
        </div>
        <Link
          to="/k/$id"
          params={{ id: place.slug || place.id }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-tomato hover:underline"
        >
          Zobacz profil <ExternalLink size={13} />
        </Link>
      </div>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-foreground">Kontakt</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Telefon</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+48 …"
              className={inputCx}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Strona www</span>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onBlur={() => setWebsite(normalizeUrl)}
              placeholder="https://…"
              className={inputCx}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-foreground">Godziny otwarcia</h3>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const d = hours[key];
            const closed = d === null;
            // A day absent from the JSON is genuinely unknown - not open, not
            // closed. It used to render as two blank time inputs that looked
            // like a filled-in state.
            const unset = d === undefined;
            return (
              <div key={key} className="flex items-center gap-3 flex-wrap">
                <span className="w-28 text-sm font-semibold text-foreground">{label}</span>
                <label className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
                  <input
                    type="checkbox"
                    checked={closed}
                    onChange={(e) => updateDay(key, { closed: e.target.checked })}
                  />
                  Zamknięte
                </label>
                {!closed && (
                  <>
                    <input
                      type="time"
                      value={d?.open ?? ""}
                      onChange={(e) => updateDay(key, { open: e.target.value })}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-sm"
                    />
                    <span className="text-foreground/50"> - </span>
                    <input
                      type="time"
                      value={d?.close ?? ""}
                      onChange={(e) => updateDay(key, { close: e.target.value })}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-sm"
                    />
                    {unset && (
                      <span className="text-xs text-muted-foreground">nieustawione</span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-foreground">Menu</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">
              Link do menu (PDF/www)
            </span>
            <input
              type="url"
              value={menuUrl}
              onChange={(e) => setMenuUrl(e.target.value)}
              onBlur={() => setMenuUrl(normalizeUrl)}
              placeholder="https://…"
              className={inputCx}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">
              URL obrazka menu
            </span>
            <input
              type="url"
              value={menuImg}
              onChange={(e) => setMenuImg(e.target.value)}
              onBlur={() => setMenuImg(normalizeUrl)}
              placeholder="https://…"
              className={inputCx}
            />
          </label>
        </div>
        {/* Restaurant owners were being asked to hand-write raw JSON in a
            textarea. This is the same structured editor the admin panel uses,
            so the two surfaces edit the menu identically. */}
        <MenuItemsEditor value={menuItems} onChange={setMenuItems} />
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-bold hover:bg-tomato/90 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Zapisz zmiany
        </button>
        {dirty && !save.isPending && (
          <span className="text-xs font-semibold text-muted-foreground">
            Masz niezapisane zmiany
          </span>
        )}
      </div>
    </form>
  );
}

/** Owners type "www.example.pl" more often than a full URL. The url inputs
 *  would reject that outright, so the value is completed on blur instead -
 *  validation still runs, the owner just isn't punished for the omission. */
function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

const inputCx =
  "mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-tomato focus:ring-2 focus:ring-tomato/20 transition";
