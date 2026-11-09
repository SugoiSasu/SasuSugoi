import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { levelInfo } from "@/components/LevelProgress";
import { cuisineMeta } from "@/data/places";
import { useUserAchievements } from "@/lib/achievements-api";
import { useFriendsCount } from "@/lib/friends-api";
import { useMyProfile } from "@/lib/profile-api";
import { useUserReviews } from "@/lib/reviews-api";
import { useProfilGustu } from "@/lib/taste-api";
import { useUser } from "@/lib/use-auth";
import { useUserFavoritePlaces, useUserVisitedPlaces } from "@/lib/visits-api";
import {
  maCoPokazac,
  narysujObraz,
  pierwszaWizyta,
  tekstUdostepnienia,
  wRoku,
  type DaneWrapped,
} from "@/lib/wrapped";

export const Route = createFileRoute("/_authenticated/podsumowanie")({
  head: () => ({ meta: [{ title: "Twoje podsumowanie - poŻeramy" }, { name: "robots", content: "noindex" }] }),
  component: PodsumowaniePage,
});

type CapacitorShare = { share(o: { text?: string; url?: string; title?: string }): Promise<unknown> };

async function obrazBlob(dane: DaneWrapped): Promise<Blob | null> {
  // Fonty marki muszą być załadowane, zanim canvas je użyje (inaczej rysuje się zapasową czcionką).
  try {
    await document.fonts?.ready;
  } catch {
    // brak API fontów - rysujemy czym jest
  }
  const c = document.createElement("canvas");
  narysujObraz(c, dane);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

function PodsumowaniePage() {
  const rok = new Date().getFullYear();
  const { user } = useUser();
  const { data: profil } = useMyProfile();
  const { data: odwiedzone, isLoading: lo } = useUserVisitedPlaces(user?.id, "visited");
  const { data: ulubione } = useUserFavoritePlaces(user?.id);
  const { data: opinie } = useUserReviews(user?.id);
  const { data: znajomi } = useFriendsCount(user?.id);
  const { data: odznaki } = useUserAchievements(user?.id);
  const { data: gust } = useProfilGustu(user?.id);

  if (!user || lo) return <Loader2 className="mx-auto my-24 animate-spin" aria-label="Ładowanie" />;

  const wizyty = wRoku(odwiedzone, rok);
  const punkty = profil?.points_total ?? 0;
  const dane: DaneWrapped = {
    rok,
    imie: (profil?.display_name || profil?.username || "poŻeracz").trim(),
    odwiedzone: wizyty.length,
    ulubione: wRoku(ulubione, rok).length,
    opinie: (opinie ?? []).filter((o) => new Date(o.created_at).getFullYear() === rok).length,
    znajomi: znajomi ?? 0,
    odznaki: (odznaki ?? []).filter((o) => new Date(o.unlocked_at).getFullYear() === rok).length,
    punkty,
    poziom: levelInfo(punkty).level,
    topKuchnie: (gust?.cuisines ?? []).slice(0, 3),
    topDzielnica: gust?.districts?.[0]?.district ?? null,
    pierwszyLokal: pierwszaWizyta(wizyty.map((w) => ({ added_at: w.added_at ?? "", name: w.name }))),
  };

  async function udostepnij() {
    const tekst = tekstUdostepnienia(dane);
    try {
      const cap = (window as unknown as { Capacitor?: { Plugins?: { Share?: CapacitorShare } } }).Capacitor?.Plugins?.Share;
      if (cap) {
        await cap.share({ title: `Mój ${rok} w poŻeramy`, text: tekst });
        return;
      }
      const blob = await obrazBlob(dane);
      const plik = blob ? new File([blob], `pozeramy-${rok}.png`, { type: "image/png" }) : null;
      if (plik && navigator.canShare?.({ files: [plik] })) {
        await navigator.share({ files: [plik], text: tekst });
      } else if (navigator.share) {
        await navigator.share({ text: tekst });
      } else {
        await navigator.clipboard.writeText(tekst);
        toast.success("Skopiowano tekst do schowka");
      }
    } catch (e) {
      // Anulowanie okna udostępniania to nie błąd.
      if ((e as Error).name !== "AbortError") toast.error("Nie udało się udostępnić");
    }
  }

  async function pobierz() {
    const blob = await obrazBlob(dane);
    if (!blob) return toast.error("Nie udało się przygotować obrazu");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pozeramy-${rok}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <main id="main-content" className="mx-auto w-full max-w-xl px-4 pb-24 pt-6 sm:px-6">
      <BackButton to="/profile" label="Ustawienia" />
      <h1 className="mt-4 font-display text-3xl">Twój {rok} 🍽️</h1>
      <p className="mt-1 text-sm text-muted-foreground">Podsumowanie od startu poŻeramy. Liczone tylko z tego roku.</p>

      {!maCoPokazac(dane) ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-semibold">Jeszcze nie ma czego podsumować</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Zaznacz kilka lokali jako „Byłem tutaj”, dodaj ulubione albo napisz opinię, a tu pojawi się Twój rok.
          </p>
          <Link to="/karty" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-tomato px-5 text-sm font-semibold text-cream">
            Przeglądaj Karty
          </Link>
        </div>
      ) : (
        <>
          <section
            className="mt-6 overflow-hidden rounded-3xl p-6 text-cream"
            style={{ background: "linear-gradient(135deg, #221e50, #37448f)" }}
            aria-label="Podsumowanie"
          >
            <p className="text-sm font-bold opacity-80">poŻeramy · {dane.imie}</p>
            <p className="mt-4 font-display text-8xl font-extrabold leading-none text-tomato-on-dark">{dane.odwiedzone}</p>
            <p className="mt-1 text-lg font-bold">odwiedzonych lokali</p>

            {dane.topKuchnie.length > 0 && (
              <ul className="mt-6 space-y-3">
                {dane.topKuchnie.map((k) => (
                  <li key={k.cuisine}>
                    <div className="flex items-center justify-between text-base font-bold">
                      <span>
                        {cuisineMeta(k.cuisine).emoji} {k.cuisine}
                      </span>
                      <span className="tabular-nums opacity-80">{k.share}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream/20" aria-hidden="true">
                      <div className="h-full rounded-full bg-tomato-on-dark" style={{ width: `${k.share}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-6 grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ["opinii", dane.opinie],
                  ["ulubionych", dane.ulubione],
                  ["znajomych", dane.znajomi],
                  ["odznak", dane.odznaki],
                ] as const
              ).map(([nazwa, wartosc]) => (
                <div key={nazwa}>
                  <dd className="font-display text-2xl font-extrabold tabular-nums">{wartosc}</dd>
                  <dt className="text-[11px] font-semibold opacity-80">{nazwa}</dt>
                </div>
              ))}
            </dl>

            <p className="mt-5 text-sm font-semibold opacity-90">
              {dane.pierwszyLokal ? `Zaczęło się od: ${dane.pierwszyLokal}. ` : ""}Poziom {dane.poziom} · {dane.punkty} pkt
              {dane.topDzielnica ? ` · najczęściej: ${dane.topDzielnica}` : ""}
            </p>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={udostepnij}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tomato text-sm font-extrabold text-cream active:scale-[0.98]"
            >
              <Share2 size={16} aria-hidden="true" /> Udostępnij
            </button>
            <button
              type="button"
              onClick={pobierz}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-sm font-extrabold active:scale-[0.98]"
            >
              <Download size={16} aria-hidden="true" /> Pobierz obraz
            </button>
          </div>
        </>
      )}
    </main>
  );
}
