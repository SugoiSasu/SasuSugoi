import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, ExternalLink, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/use-auth";
import { useIsOwnerOf } from "@/lib/owners-api";
import type { OpeningHours } from "@/lib/places-api";

export const Route = createFileRoute("/_authenticated/owner/$placeId")({
  head: () => ({ meta: [{ title: "Edycja knajpy — poŻeramy" }] }),
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
  const { data: isOwner, isLoading: checkingOwner } = useIsOwnerOf(placeId);
  const { data: place, isLoading } = usePlaceForEdit(placeId);
  const qc = useQueryClient();

  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuImg, setMenuImg] = useState("");
  const [hours, setHours] = useState<OpeningHours>({});
  const [menuJson, setMenuJson] = useState("");
  const [menuJsonErr, setMenuJsonErr] = useState<string | null>(null);

  useEffect(() => {
    if (!place) return;
    setPhone(place.phone ?? "");
    setWebsite(place.website ?? "");
    setMenuUrl(place.menu_url ?? "");
    setMenuImg(place.menu_image_url ?? "");
    setHours(place.opening_hours ?? {});
    setMenuJson(place.menu_items ? JSON.stringify(place.menu_items, null, 2) : "");
  }, [place]);

  const save = useMutation({
    mutationFn: async () => {
      let menuItemsParsed: unknown = null;
      if (menuJson.trim()) {
        try {
          menuItemsParsed = JSON.parse(menuJson);
        } catch (e) {
          throw new Error("Menu (JSON) nieprawidłowy: " + (e as Error).message);
        }
      }
      const { error } = await supabase
        .from("places")
        .update({
          phone: phone.trim() || null,
          website: website.trim() || null,
          menu_url: menuUrl.trim() || null,
          menu_image_url: menuImg.trim() || null,
          opening_hours: (hours as unknown) as never,
          menu_items: (menuItemsParsed as unknown) as never,
        })
        .eq("id", placeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zapisano zmiany");
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

  if (!user || !isOwner) {
    return (
      <div className="rounded-2xl border-2 border-tomato/40 bg-tomato/10 p-6 text-sm text-navy flex items-start gap-3">
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
        const current = next[key] ?? { open: "12:00", close: "22:00" };
        next[key] = {
          open: patch.open ?? current.open,
          close: patch.close ?? current.close,
        };
      }
      return next;
    });
  }

  return (
    <div className="rounded-3xl bg-card border border-border p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-navy/60 font-semibold">
            Edytujesz
          </div>
          <h2 className="font-display text-2xl text-navy">{place.name}</h2>
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
        <h3 className="font-display text-lg text-navy">Kontakt</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-navy/70">Telefon</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+48 …"
              className={inputCx}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-navy/70">Strona www</span>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className={inputCx}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-navy">Godziny otwarcia</h3>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const d = hours[key];
            const closed = d === null;
            return (
              <div key={key} className="flex items-center gap-3 flex-wrap">
                <span className="w-28 text-sm font-semibold text-navy">{label}</span>
                <label className="inline-flex items-center gap-1.5 text-xs text-navy/70">
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
                      className="rounded-lg border border-border bg-white px-2 py-1 text-sm"
                    />
                    <span className="text-navy/50">—</span>
                    <input
                      type="time"
                      value={d?.close ?? ""}
                      onChange={(e) => updateDay(key, { close: e.target.value })}
                      className="rounded-lg border border-border bg-white px-2 py-1 text-sm"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-navy">Menu</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-navy/70">
              Link do menu (PDF/www)
            </span>
            <input
              type="url"
              value={menuUrl}
              onChange={(e) => setMenuUrl(e.target.value)}
              placeholder="https://…"
              className={inputCx}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-navy/70">
              URL obrazka menu
            </span>
            <input
              type="url"
              value={menuImg}
              onChange={(e) => setMenuImg(e.target.value)}
              placeholder="https://…"
              className={inputCx}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-navy/70">
            Menu strukturalne (JSON, opcjonalnie)
          </span>
          <textarea
            value={menuJson}
            onChange={(e) => {
              setMenuJson(e.target.value);
              if (!e.target.value.trim()) return setMenuJsonErr(null);
              try {
                JSON.parse(e.target.value);
                setMenuJsonErr(null);
              } catch (err) {
                setMenuJsonErr((err as Error).message);
              }
            }}
            rows={10}
            className={inputCx + " font-mono text-xs min-h-[200px]"}
            placeholder={`[
  { "category": "Przystawki", "items": [
    { "name": "Bruschetta", "price": "18 zł" }
  ] }
]`}
          />
          {menuJsonErr && (
            <span className="text-xs text-tomato">Błąd JSON: {menuJsonErr}</span>
          )}
        </label>
      </section>

      <div className="pt-2">
        <button
          type="button"
          disabled={save.isPending || !!menuJsonErr}
          onClick={() => save.mutate()}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-bold hover:bg-tomato/90 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Zapisz zmiany
        </button>
      </div>
    </div>
  );
}

const inputCx =
  "mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-tomato focus:ring-2 focus:ring-tomato/20 transition";
