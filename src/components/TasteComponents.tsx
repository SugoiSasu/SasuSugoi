import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Loader2, MapPin, Sparkles } from "lucide-react";
import { PlaceLogo } from "@/components/PlaceLogo";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cuisineMeta } from "@/data/places";
import { useFriendshipWith } from "@/lib/friends-api";
import { usePlaces } from "@/lib/places-api";
import {
  MIN_SYGNALOW,
  czegoBrakuje,
  poziomZgodnosci,
  useProfilGustu,
  useZgodnosc,
  type ZgodnoscZeZnajomym,
} from "@/lib/taste-api";

/** Pierwsze imię do zwrotów w rodzaju "Zgodność z Anią". */
const imie = (nazwa: string | null | undefined) => (nazwa ?? "").trim().split(/\s+/)[0] || "znajomym";

/* ------------------------- Twój gust (profil) ------------------------- */

/**
 * Karta "Gust": top kuchnie jako paski udziału, ulubione dzielnice, liczniki. Pokazuje się właścicielowi
 * i jego znajomym (serwer odmawia komu innemu, wtedy karta po prostu znika).
 */
export function TasteProfileCard({ userId, wlasny = false }: { userId: string; wlasny?: boolean }) {
  const { data, isLoading, error } = useProfilGustu(userId);
  if (error) return null;
  if (isLoading) return <div className="pz-skel h-40 w-full rounded-2xl" aria-hidden="true" />;
  if (!data) return null;

  const malo = data.signals < MIN_SYGNALOW || data.cuisines.length === 0;
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="Gust">
      <h2 className="flex items-center gap-2 font-display text-lg">
        <Sparkles size={16} className="text-tomato" aria-hidden="true" /> {wlasny ? "Twój gust" : "Gust"}
      </h2>
      {malo ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {wlasny
            ? "Za mało danych. Zapisuj lokale („Chcę odwiedzić”, „Byłem tu”), dodawaj do ulubionych i wybierz ulubione kuchnie w ustawieniach, a pokażemy tu Twój gust."
            : "Za mało danych, żeby pokazać gust."}
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2.5">
            {data.cuisines.map((c) => {
              const meta = cuisineMeta(c.cuisine);
              return (
                <li key={c.cuisine}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      {meta.emoji} {c.cuisine}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{c.share}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                    <div className="h-full rounded-full bg-tomato" style={{ width: `${c.share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {data.districts.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={12} aria-hidden="true" /> Najczęściej:
              {data.districts.map((d) => (
                <span key={d.district} className="rounded-full bg-muted px-2.5 py-1 font-semibold text-foreground">
                  {d.district}
                </span>
              ))}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {data.visited} odwiedzonych · {data.favorites} ulubionych
          </p>
        </>
      )}
    </section>
  );
}

/** Sekcja na profilu: tylko dla właściciela i jego znajomych (inni nie dostaną nawet zapytania do serwera). */
export function ProfilGustuSekcja({ profileId, isMe }: { profileId: string; isMe: boolean }) {
  const { data: znajomosc } = useFriendshipWith(isMe ? null : profileId);
  if (!isMe && znajomosc?.status !== "accepted") return null;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
      <TasteProfileCard userId={profileId} wlasny={isMe} />
    </div>
  );
}

/* --------------------------- Zgodność ze znajomym --------------------------- */

/** Plakietka w wierszu znajomego: "72% zgodności" albo "Sprawdź zgodność"; kliknięcie otwiera szczegóły. */
export function ZgodnoscPlakietka({
  znajomy,
}: {
  znajomy: { id: string; display_name: string | null; username: string | null };
}) {
  const [otwarte, setOtwarte] = useState(false);
  const { data, isLoading, isError } = useZgodnosc(znajomy.id);
  // Serwer nie odpowiedzial (np. konto znajomego bez logowania): nie pokazujemy plakietki, ktora nic nie da.
  if (isError) return null;
  const policzona = data?.score != null;
  const poziom = policzona ? poziomZgodnosci(data!.score!) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOtwarte(true)}
        className={`pz-hit mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          poziom ? poziom.klasa : "bg-muted text-muted-foreground"
        }`}
      >
        {isLoading ? (
          <Loader2 size={11} className="animate-spin" aria-label="Liczę zgodność" />
        ) : (
          <Heart size={11} aria-hidden="true" />
        )}
        {policzona ? `${data!.score}% zgodności` : "Sprawdź zgodność"}
      </button>
      {otwarte && <ZgodnoscSheet znajomy={znajomy} dane={data} open={otwarte} onOpenChange={setOtwarte} />}
    </>
  );
}

function Pierscien({ score }: { score: number }) {
  const r = 52;
  const obwod = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-32 w-32" role="img" aria-label={`${score}% zgodności`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-foreground/10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-tomato transition-all duration-700"
          strokeDasharray={obwod}
          strokeDashoffset={obwod * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-3xl font-extrabold tabular-nums">
        {score}%
      </span>
    </div>
  );
}

function ZgodnoscSheet({
  znajomy,
  dane,
  open,
  onOpenChange,
}: {
  znajomy: { id: string; display_name: string | null; username: string | null };
  dane: ZgodnoscZeZnajomym | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: lokale } = usePlaces();
  const im = imie(znajomy.display_name || znajomy.username);
  const wspolne = (dane?.common_places ?? [])
    .map((id) => lokale?.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const brak = dane && dane.score == null ? czegoBrakuje(dane) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl font-extrabold">Zgodność z {im}</SheetTitle>
          <SheetDescription>
            Liczymy ją z ulubionych kuchni, odwiedzonych i zapisanych lokali oraz ocen. Wiedzą o niej tylko znajomi.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {!dane ? (
            <Loader2 className="mx-auto my-8 animate-spin" aria-label="Ładowanie" />
          ) : dane.score != null ? (
            <>
              <Pierscien score={dane.score} />
              <p className="mt-2 text-center font-display text-lg">{poziomZgodnosci(dane.score).etykieta}</p>

              {(dane.shared_cuisines?.length ?? 0) > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    Wspólne kuchnie
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {dane.shared_cuisines!.map((k) => (
                      <li key={k} className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
                        {cuisineMeta(k).emoji} {k}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {wspolne.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    Lokale, które oboje znacie
                  </p>
                  <ul className="space-y-2">
                    {wspolne.map((p) => {
                      const meta = cuisineMeta(p.cuisine);
                      return (
                        <li key={p.id}>
                          <Link
                            to="/k/$id"
                            params={{ id: p.slug ?? p.id }}
                            className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2"
                          >
                            <PlaceLogo
                              tryb="lekki"
                              name=""
                              avatarUrl={p.avatar_url}
                              fallbackEmoji={meta.emoji}
                              fallbackColor={`${meta.color}33`}
                              className="h-9 w-9 shrink-0 text-base"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{p.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{p.cuisine}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {(dane.their_top?.length ?? 0) > 0 && (
                <p className="mt-5 text-sm text-muted-foreground">
                  {im} najczęściej wybiera: <strong className="text-foreground">{dane.their_top!.join(", ")}</strong>.
                </p>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm">
              <p className="font-semibold">Jeszcze za mało danych</p>
              <p className="mt-1 text-muted-foreground">
                {brak?.ty && brak?.znajomy
                  ? `Wy oboje potrzebujecie jeszcze trochę zapisanych lokali (minimum ${MIN_SYGNALOW} sygnały: ulubione kuchnie, wizyty, ulubione, oceny).`
                  : brak?.ty
                    ? `Dodaj kilka lokali („Chcę odwiedzić”, „Byłem tu”) albo wybierz ulubione kuchnie, a policzymy zgodność z ${im} (minimum ${MIN_SYGNALOW}).`
                    : `${im} ma jeszcze za mało zapisanych lokali. Zaproś ${im} do przeglądania Kart, a zgodność policzy się sama.`}
              </p>
              <Link
                to="/karty"
                className="mt-3 inline-flex min-h-11 items-center rounded-full bg-tomato px-5 text-xs font-semibold text-cream"
              >
                Przeglądaj Karty
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
