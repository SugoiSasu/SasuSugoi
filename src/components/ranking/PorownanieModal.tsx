import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { levelInfo } from "@/components/LevelProgress";
import { displayNameOf } from "@/lib/display-name";
import { useMyProfile } from "@/lib/profile-api";
import { usePorownanie } from "@/lib/ranking-api";
import { krotkaNazwa, odmiana, type Gracz } from "@/lib/ranking";

type Awatar = Parameters<typeof UserAvatar>[0]["avatarSource"];

/**
 * "Ty vs znajomy" (decyzja Mateusza 2026-09-28). Dane z porownanie_graczy -
 * funkcja wpuszcza tylko przyjaciol albo profile publiczne.
 */
export function PorownanieModal({ znajomy, onClose }: { znajomy: Gracz; onClose: () => void }) {
  const { data: ja } = useMyProfile();
  const { data, isLoading, error } = usePorownanie(znajomy.user_id);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const moje = data?.find((w) => w.kto === "ja");
  const jego = data?.find((w) => w.kto === "on");
  const wspolne = data?.find((w) => w.kto === "wspolne")?.lokale ?? 0;

  const wiersze: { etykieta: string; a: number; b: number; format?: (n: number) => string }[] =
    moje && jego
      ? [
          { etykieta: "Punkty", a: moje.points_total ?? 0, b: jego.points_total ?? 0 },
          { etykieta: "Poziom", a: levelInfo(moje.points_total ?? 0).level, b: levelInfo(jego.points_total ?? 0).level },
          { etykieta: "Recenzje", a: moje.recenzje ?? 0, b: jego.recenzje ?? 0 },
          { etykieta: "Zrecenzowane lokale", a: moje.lokale ?? 0, b: jego.lokale ?? 0 },
          { etykieta: "Odznaki", a: moje.odznaki ?? 0, b: jego.odznaki ?? 0 },
          {
            etykieta: "Średnia ocena",
            a: Number(moje.srednia_ocena ?? 0),
            b: Number(jego.srednia_ocena ?? 0),
            format: (n) => (n ? n.toFixed(1).replace(".", ",") : "–"),
          },
        ]
      : [];
  const wygrane = wiersze.filter((w) => w.etykieta !== "Średnia ocena" && w.a > w.b).length;
  const przegrane = wiersze.filter((w) => w.etykieta !== "Średnia ocena" && w.a < w.b).length;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label={`Porównanie z ${displayNameOf(znajomy)}`}>
      <button type="button" aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-navy/55 backdrop-blur-sm" />
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl">
        <div className="relative bg-navy px-5 pb-5 pt-4 text-cream">
          <button type="button" onClick={onClose} aria-label="Zamknij" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-cream/10">
            <X size={15} />
          </button>
          <div className="text-[10px] font-extrabold uppercase tracking-[.13em] text-blush">Porównanie</div>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              <UserAvatar
                avatarUrl={ja?.avatar_url}
                avatarSource={ja?.avatar_source}
                displayName={ja?.display_name}
                username={ja?.username}
                gender={ja?.gender}
                size={56}
                className="ring-2 ring-cream/40"
              />
              <span className="max-w-full truncate text-sm font-extrabold">Ty</span>
            </div>
            <span className="font-display text-2xl font-extrabold text-blush">vs</span>
            <Link to="/u/$username" params={{ username: znajomy.username ?? znajomy.user_id }} className="flex min-w-0 flex-col items-center gap-1.5">
              <UserAvatar
                avatarUrl={znajomy.avatar_url}
                avatarSource={znajomy.avatar_source as Awatar}
                displayName={znajomy.display_name}
                username={znajomy.username}
                gender={znajomy.gender === "M" || znajomy.gender === "K" ? znajomy.gender : null}
                size={56}
                className="ring-2 ring-cream/40"
              />
              <span className="max-w-full truncate text-sm font-extrabold hover:underline">{krotkaNazwa(znajomy)}</span>
            </Link>
          </div>
          {!!wiersze.length && (
            <p className="mt-3 text-center text-[12.5px] text-cream/75">
              {wygrane === przegrane
                ? "Idziecie łeb w łeb."
                : wygrane > przegrane
                  ? `Prowadzisz w ${wygrane} z ${wiersze.length - 1} kategorii.`
                  : `${krotkaNazwa(znajomy)} prowadzi w ${przegrane} z ${wiersze.length - 1} kategorii.`}
            </p>
          )}
        </div>

        <div className="px-5 py-4">
          {isLoading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nie udało się wczytać porównania.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {wiersze.map((w) => {
                const suma = Math.max(1, w.a + w.b);
                const fmt = w.format ?? ((n: number) => String(n));
                return (
                  <li key={w.etykieta}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className={`font-display text-lg font-extrabold tabular-nums ${w.a > w.b ? "text-tomato" : ""}`}>{fmt(w.a)}</span>
                      <span className="text-xs font-semibold text-muted-foreground">{w.etykieta}</span>
                      <span className={`font-display text-lg font-extrabold tabular-nums ${w.b > w.a ? "text-tomato" : ""}`}>{fmt(w.b)}</span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-foreground/[.06]">
                      <div className="h-full bg-tomato" style={{ width: `${(w.a / suma) * 100}%` }} />
                      <div className="h-full bg-blush" style={{ width: `${(w.b / suma) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
              <li className="mt-1 rounded-2xl bg-background px-4 py-3 text-center text-[13px]">
                {wspolne
                  ? <>Oboje zrecenzowaliście <b>{wspolne}</b> {odmiana(wspolne, "lokal", "lokale", "lokali")}.</>
                  : "Nie macie jeszcze wspólnie zrecenzowanego lokalu - czas na wspólne wyjście?"}
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
