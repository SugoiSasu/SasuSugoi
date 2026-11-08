import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink, Heart, Loader2, Lock, Navigation, PartyPopper, X } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { CuisineFallbackCover } from "@/components/CuisineFallbackCover";
import { OpenStatus } from "@/components/OpenStatus";
import { PlaceLogo } from "@/components/PlaceLogo";
import { PriceLevel } from "@/components/PriceLevel";
import { UserAvatar } from "@/components/UserAvatar";
import { cuisineMeta } from "@/data/places";
import type { Place } from "@/lib/places-api";
import {
  ilu_skonczylo,
  useGlosujWyjscie,
  useWyjscie,
  useWynikWyjscia,
  useZamknijWyjscie,
  zwyciezcy,
  type Wyjscie,
} from "@/lib/outing-api";
import { usePlaces } from "@/lib/places-api";
import { useUser } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/wyjscie/$id")({
  head: () => ({ meta: [{ title: "Wspólne wyjście - poŻeramy" }, { name: "robots", content: "noindex" }] }),
  component: WyjsciePage,
});

function pozostalo(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "zakończone";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `zostało ok. ${h} godz.`;
  return `zostało ${Math.max(1, Math.round(ms / 60_000))} min`;
}

function WyjsciePage() {
  const { id } = Route.useParams();
  const { user } = useUser();
  const { data: wyjscie, isLoading, error } = useWyjscie(id);
  const { data: lokale } = usePlaces();

  return (
    <main id="main-content" className="mx-auto w-full max-w-xl px-4 pb-24 pt-6 sm:px-6">
      <BackButton to="/karty" label="Karty" />
      <h1 className="mt-4 font-display text-3xl">Wspólne wyjście 🍽️</h1>

      {isLoading ? (
        <Loader2 className="mx-auto my-16 animate-spin" aria-label="Ładowanie" />
      ) : error || !wyjscie ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
          <Lock className="mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">Nie możesz zobaczyć tego wyjścia</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Link działa tylko dla zaproszonych znajomych (i wygasa po 24 godzinach).
          </p>
          <Link to="/karty" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-tomato px-5 text-sm font-semibold text-cream">
            Wróć do Kart
          </Link>
        </div>
      ) : (
        <Zawartosc wyjscie={wyjscie} lokale={lokale ?? []} meId={user?.id} />
      )}
    </main>
  );
}

function Zawartosc({ wyjscie, lokale, meId }: { wyjscie: Wyjscie; lokale: Place[]; meId?: string }) {
  const zamkniete = wyjscie.status === "closed";
  const ids = wyjscie.place_ids;
  const nastepny = ids.find((p) => !(p in wyjscie.my_votes));
  const skonczylem = nastepny === undefined;
  const pokazWynik = skonczylem || zamkniete;
  const jestemHostem = meId === wyjscie.host_id;
  const zamknij = useZamknijWyjscie(wyjscie.id);
  const poId = new Map(lokale.map((p) => [p.id, p]));

  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">
        Zagłosowali {ilu_skonczylo(wyjscie)} z {wyjscie.members.length} · {pozostalo(wyjscie.expires_at)}
      </p>

      <ul className="mt-4 flex flex-wrap gap-3" aria-label="Uczestnicy">
        {wyjscie.members.map((m) => {
          const gotowy = m.votes_done >= ids.length;
          return (
            <li key={m.user_id} className="flex w-16 flex-col items-center gap-1 text-center">
              <span className="relative">
                <UserAvatar avatarUrl={m.avatar_url} displayName={m.display_name} username={m.username} size={44} />
                {gotowy && (
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-ok text-cream ring-2 ring-background">
                    <Check size={12} aria-label="Zagłosował" />
                  </span>
                )}
              </span>
              <span className="w-full truncate text-[11px] font-semibold">
                {(m.display_name || m.username || "?").split(/\s+/)[0]}
              </span>
              {m.is_host && <span className="-mt-1 text-[10px] text-muted-foreground">organizator</span>}
            </li>
          );
        })}
      </ul>

      {!pokazWynik && nastepny && (
        <Glosowanie
          wyjscie={wyjscie}
          lokal={poId.get(nastepny)}
          numer={ids.indexOf(nastepny) + 1}
        />
      )}

      {pokazWynik && <Wynik wyjscie={wyjscie} poId={poId} />}

      {jestemHostem && !zamkniete && (
        <button
          type="button"
          onClick={() => zamknij.mutate(undefined, { onError: (e) => toast.error((e as Error).message) })}
          disabled={zamknij.isPending}
          className="mt-8 inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold hover:border-tomato disabled:opacity-60"
        >
          Zamknij głosowanie
        </button>
      )}
    </>
  );
}

function Glosowanie({ wyjscie, lokal, numer }: { wyjscie: Wyjscie; lokal?: Place; numer: number }) {
  const glosuj = useGlosujWyjscie(wyjscie.id);
  if (!lokal) {
    return <p className="mt-6 text-sm text-muted-foreground">Ten lokal nie jest już dostępny.</p>;
  }
  const meta = cuisineMeta(lokal.cuisine);
  const oddaj = (tak: boolean) =>
    glosuj.mutate({ lokal: lokal.id, tak }, { onError: (e) => toast.error((e as Error).message || "Nie udało się zagłosować") });

  return (
    <section className="mt-6" aria-label={`Lokal ${numer} z ${wyjscie.place_ids.length}`}>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        {numer} z {wyjscie.place_ids.length}
      </p>
      <article className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="relative">
          <div className="relative aspect-[16/10] overflow-hidden" style={{ backgroundColor: meta.color }}>
            {lokal.cover_image_url ? (
              <img src={lokal.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0">
                <CuisineFallbackCover cuisine={lokal.cuisine} emojiClassName="text-[5rem]" />
              </div>
            )}
          </div>
          <PlaceLogo
            name={lokal.name}
            avatarUrl={lokal.avatar_url}
            cutoutEnabled={lokal.avatar_cutout_enabled !== false}
            fallbackEmoji={meta.emoji}
            fallbackColor={meta.color}
            className="absolute -bottom-7 left-4 h-14 w-14 text-xl shadow-md ring-4 ring-card"
          />
        </div>
        <div className="px-4 pb-4 pt-2">
          <h2 className="min-h-7 pl-[4.25rem] font-display text-xl leading-tight">{lokal.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {meta.emoji} {lokal.cuisine}
            {lokal.district ? ` · ${lokal.district}` : ""}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs">
            <OpenStatus hours={lokal.opening_hours} />
            <PriceLevel value={lokal.price_range} />
          </p>
          <Link
            to="/k/$id"
            params={{ id: lokal.slug ?? lokal.id }}
            target="_blank"
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-tomato underline-offset-2 hover:underline"
          >
            Zobacz lokal <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>
      </article>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => oddaj(false)}
          disabled={glosuj.isPending}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-sm font-extrabold transition hover:border-destructive active:scale-[0.98] disabled:opacity-60"
        >
          <X size={20} aria-hidden="true" /> Nie
        </button>
        <button
          type="button"
          onClick={() => oddaj(true)}
          disabled={glosuj.isPending}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-tomato text-sm font-extrabold text-cream transition active:scale-[0.98] disabled:opacity-60"
        >
          <Heart size={20} aria-hidden="true" /> Tak
        </button>
      </div>
    </section>
  );
}

function Wynik({ wyjscie, poId }: { wyjscie: Wyjscie; poId: Map<string, Place> }) {
  const { data: wyniki, isLoading, error } = useWynikWyjscia(wyjscie.id, true);
  if (isLoading) return <Loader2 className="mx-auto my-10 animate-spin" aria-label="Liczę wynik" />;
  if (error || !wyniki) {
    return <p className="mt-6 text-sm text-muted-foreground">Wynik pokaże się, gdy oddasz wszystkie głosy.</p>;
  }
  const { ideal, top } = zwyciezcy(wyniki);
  const topIds = new Set(top.map((t) => t.place_id));

  return (
    <section className="mt-6" aria-label="Wynik">
      {top.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nikt nie zagłosował „tak” na żaden lokal. Zacznijcie nowe wyjście z innymi lokalami.
        </p>
      ) : (
        <p className="flex items-center gap-2 font-display text-xl">
          <PartyPopper size={20} className="text-tomato" aria-hidden="true" />
          {ideal ? "Macie idealny match!" : top.length > 1 ? "Remis - wybierzcie jeden" : "Najwięcej „tak”"}
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {wyniki.map((w) => {
          const lokal = poId.get(w.place_id);
          if (!lokal) return null;
          const meta = cuisineMeta(lokal.cuisine);
          const wygrany = topIds.has(w.place_id);
          const proc = w.members_total > 0 ? Math.round((w.yes_count / w.members_total) * 100) : 0;
          return (
            <li
              key={w.place_id}
              className={`rounded-2xl border-2 p-3 ${wygrany ? "border-tomato bg-tomato/5" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-3">
                <PlaceLogo
                  tryb="lekki"
                  name=""
                  avatarUrl={lokal.avatar_url}
                  fallbackEmoji={meta.emoji}
                  fallbackColor={`${meta.color}33`}
                  className="h-12 w-12 shrink-0 text-lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base leading-tight">{lokal.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lokal.cuisine}
                    {lokal.district ? ` · ${lokal.district}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-extrabold tabular-nums">
                  {w.yes_count}/{w.members_total}
                  <span className="block text-[11px] font-semibold text-muted-foreground">tak</span>
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                <div className="h-full rounded-full bg-tomato" style={{ width: `${proc}%` }} />
              </div>
              {wygrany && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/k/$id"
                    params={{ id: lokal.slug ?? lokal.id }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tomato px-4 text-xs font-semibold text-cream"
                  >
                    Zobacz lokal
                  </Link>
                  {lokal.lat != null && lokal.lng != null && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${lokal.lat},${lokal.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-semibold"
                    >
                      <Navigation size={13} aria-hidden="true" /> Nawiguj
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {wyjscie.status === "open" && (
        <p className="mt-4 text-xs text-muted-foreground">Wynik odświeża się sam, gdy znajomi oddają głosy.</p>
      )}
    </section>
  );
}
