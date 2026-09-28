import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, HelpCircle, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { UserAvatar } from "@/components/UserAvatar";
import { levelInfo } from "@/components/LevelProgress";
import { vipNameStyle, isVipActive, VipBadge } from "@/components/VipBadge";
import { displayNameOf } from "@/lib/display-name";
import { useMyFriendships, useSendFriendRequest } from "@/lib/friends-api";
import { useRankingTablica, useRegulyPunktow, useSzukajProfili } from "@/lib/ranking-api";
import {
  METRYKI,
  OKRESY,
  ileZostalo,
  koniecOkresu,
  krotkaNazwa,
  naglowekOkresu,
  odmiana,
  policzRanking,
  sasiedzi,
  wskazowka,
  type Gracz,
  type Metryka,
  type Okres,
  type Zakres,
} from "@/lib/ranking";
import { PorownanieModal } from "@/components/ranking/PorownanieModal";

// Medale z paczki designu: zloto, srebro, braz w odcieniu blush marki.
const MEDAL = ["oklch(78% 0.11 85)", "oklch(80% 0.02 275)", "oklch(0.72 0.1 25)"];
const WIDOCZNYCH = 7;

type Awatar = Parameters<typeof UserAvatar>[0]["avatarSource"];

function Av({ g, size, className = "" }: { g: Pick<Gracz, "avatar_url" | "avatar_source" | "display_name" | "username" | "gender">; size: number; className?: string }) {
  return (
    <UserAvatar
      avatarUrl={g.avatar_url}
      avatarSource={g.avatar_source as Awatar}
      displayName={g.display_name}
      username={g.username}
      gender={g.gender === "M" || g.gender === "K" ? g.gender : null}
      size={size}
      className={className}
    />
  );
}

function Zmiana({ z, maly }: { z: number | null | undefined; maly?: boolean }) {
  if (z === undefined) return null;
  const t = maly ? "text-[9.5px]" : "text-[10.5px]";
  if (z === null)
    return <span className={`rounded-md bg-blush px-1 font-extrabold text-navy ${maly ? "text-[7.5px]" : "text-[8.5px]"}`}>NOWY</span>;
  if (z > 0) return <span className={`${t} font-extrabold text-ok`}>▲ {z}</span>;
  if (z < 0) return <span className={`${t} font-extrabold text-destructive`}>▼ {-z}</span>;
  return <span className={`${t} font-extrabold text-muted-foreground/50`}>—</span>;
}

export function RankingBoard({
  okres,
  metryka,
  zakres,
  q,
  onZmien,
}: {
  okres: Okres;
  metryka: Metryka;
  zakres: Zakres;
  q: string;
  onZmien: (patch: Partial<{ okres: Okres; metryka: Metryka; scope: Zakres; q: string }>) => void;
}) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { data: wiersze, isLoading, isFetching } = useRankingTablica(okres, metryka, user?.id ?? null);
  // Wspinacze tygodnia zawsze z rankingu ogolnego punktow - tylko tam jest "zmiana w 7 dni".
  const { data: ogolne } = useRankingTablica("all", "pts", user?.id ?? null);
  const { data: reguly } = useRegulyPunktow();
  const { data: przyjaznie } = useMyFriendships();
  const wyslij = useSendFriendRequest();
  const [rozwiniete, setRozwiniete] = useState(false);
  const [szukajOtwarte, setSzukajOtwarte] = useState(!!q);
  const [reguly_otwarte, setRegulyOtwarte] = useState(false);
  const [porownaj, setPorownaj] = useState<Gracz | null>(null);
  const [wpis, setWpis] = useState(q);
  const [teraz, setTeraz] = useState(() => new Date());

  useEffect(() => setWpis(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => wpis !== q && onZmien({ q: wpis }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wpis]);
  // Odliczanie do konca okresu - co minute wystarczy.
  useEffect(() => {
    const t = setInterval(() => setTeraz(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  // Ranking zywy: zmiana punktow u kogokolwiek odswieza liste.
  useEffect(() => {
    const ch = supabase
      .channel("ranking-v2")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () =>
        qc.invalidateQueries({ queryKey: ["ranking"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const lista = useMemo(() => policzRanking(wiersze ?? [], zakres), [wiersze, zakres]);
  const liczniki = useMemo(
    () => ({
      all: policzRanking(wiersze ?? [], "all").length,
      friends: policzRanking(wiersze ?? [], "friends").length,
    }),
    [wiersze],
  );
  const s = sasiedzi(lista);
  const jednostka = METRYKI.find((m) => m.id === metryka)!.jednostka;
  const regulyLiczby = {
    recenzja: reguly?.find((r) => r.event_key === "review_created")?.points ?? 10,
    nowyLokal: reguly?.find((r) => r.event_key === "first_visit_new_place")?.points ?? 20,
  };
  const wspinacze = useMemo(
    () =>
      policzRanking(ogolne ?? [], "all")
        .filter((g) => (g.zmiana ?? 0) > 0)
        .sort((a, b) => (b.zmiana ?? 0) - (a.zmiana ?? 0))
        .slice(0, 3),
    [ogolne],
  );

  const fraza = q.trim().toLowerCase();
  const szukam = fraza.length > 0;
  const trafienia = szukam
    ? lista.filter((g) => `${g.display_name ?? ""} ${g.username ?? ""}`.toLowerCase().includes(fraza))
    : lista;
  const { data: spoza, isFetching: szukamSpoza } = useSzukajProfili(szukam ? q : "");
  const spozaRankingu = (spoza ?? []).filter((p) => !lista.some((g) => g.user_id === p.id));

  const podium = !szukam && lista.length >= 3 ? lista.slice(0, 3) : [];
  const reszta = szukam ? trafienia : lista.slice(podium.length);
  let widoczne = rozwiniete || szukam ? reszta : reszta.slice(0, WIDOCZNYCH);
  const jaUkryty = !!s.ja && !rozwiniete && !szukam && s.ja.miejsce > 3 && !widoczne.includes(s.ja);
  if (jaUkryty && s.ja) widoczne = [...widoczne, s.ja];

  const koniec = koniecOkresu(okres, teraz);
  const linijkaOkresu = koniec
    ? `Ranking ${okres === "week" ? "tygodnia" : "miesiąca"} zamyka się za ${ileZostalo(koniec, teraz)}. Potem liczymy od zera, punkty i poziom zostają.`
    : "Ranking ogólny liczy się od założenia konta i nie resetuje się.";

  const zaproszenieDo = (id: string) =>
    (przyjaznie ?? []).find(
      (f) => f.status === "pending" && (f.addressee_id === id || f.requester_id === id),
    );

  async function dodaj(g: { user_id: string }) {
    try {
      await wyslij.mutateAsync(g.user_id);
      toast.success("Zaproszenie wysłane");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wysłać zaproszenia");
    }
  }

  // ── Kawalki UI ────────────────────────────────────────────────────────────

  const przelacznikOkresu = (ciemny: boolean) => (
    <div
      className={`flex gap-0.5 rounded-full p-1 ${ciemny ? "bg-cream/10" : "border border-border bg-card"}`}
      role="tablist"
      aria-label="Okres rankingu"
    >
      {OKRESY.map((o) => {
        const on = o.id === okres;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onZmien({ okres: o.id })}
            className={`flex-1 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-extrabold transition ${
              ciemny
                ? on
                  ? "bg-cream text-navy"
                  : "text-cream/70 hover:text-cream"
                : on
                  ? "bg-navy text-cream dark:bg-cream dark:text-navy"
                  : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.etykieta}
          </button>
        );
      })}
    </div>
  );

  const kartaPodium = (g: Gracz, maly: boolean) => {
    const poz = lista.indexOf(g);
    const lider = poz === 0;
    const medal = MEDAL[poz];
    const rozmiar = maly ? (lider ? 64 : 52) : lider ? 84 : 66;
    const wys = maly ? [92, 66, 50][poz] : [128, 92, 68][poz];
    return (
      <li key={g.user_id} className="flex min-w-0 flex-col items-center">
        {lider ? (
          <span
            className={`mb-1.5 flex items-center rounded-full px-2 font-extrabold tracking-[.1em] text-navy ${maly ? "h-[15px] text-[8.5px]" : "h-5 text-[10px]"}`}
            style={{ background: medal }}
          >
            LIDER
          </span>
        ) : (
          <span className={maly ? "h-5" : "h-[26px]"} />
        )}
        <Link to="/u/$username" params={{ username: g.username ?? g.user_id }} className="relative mb-2.5 sm:mb-3.5">
          <span
            className="block rounded-full"
            style={{
              boxShadow: `0 0 0 ${maly ? 3 : 4}px var(--navy), 0 0 0 ${maly ? 6 : 7}px ${medal}${lider ? ", 0 10px 40px oklch(0.545 0.205 36 / .45)" : ""}`,
            }}
          >
            <Av g={g} size={rozmiar} />
          </span>
          <span
            className={`absolute -bottom-1 -right-1 grid place-items-center rounded-full font-extrabold text-navy ${maly ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]"}`}
            style={{ background: medal }}
            title="Poziom"
          >
            {levelInfo(g.points_total).level}
          </span>
        </Link>
        <div className="flex max-w-full items-center gap-1.5">
          <span className={`truncate font-extrabold ${maly ? "text-xs" : "text-[14.5px]"}`} style={vipNameStyle(g)}>
            {maly && g.is_me ? "Ty" : maly ? krotkaNazwa(g) : displayNameOf(g)}
          </span>
          {!maly && g.is_me && <span className="shrink-0 rounded-lg bg-tomato px-1.5 py-0.5 text-[9.5px] font-extrabold text-cream">TY</span>}
        </div>
        <div className={`flex items-baseline gap-1 ${maly ? "mb-2" : "mb-3"}`}>
          <span className={`font-display font-extrabold leading-tight text-blush ${maly ? "text-[17px]" : "text-[22px]"}`}>{g.wartosc}</span>
          <span className={`font-bold text-cream/55 ${maly ? "text-[9.5px]" : "text-[11px]"}`}>{jednostka}</span>
        </div>
        <div className={`w-full ${maly ? "" : "max-w-[190px]"}`}>
          <div className={`rounded-t-xl ${maly ? "h-[9px]" : "h-3"} ${g.is_me ? "bg-[oklch(0.68_0.16_40)]" : "bg-cream/20"}`} />
          <div
            className={`flex justify-center rounded-b ${maly ? "pt-1.5" : "pt-2.5"} ${g.is_me ? "bg-tomato" : "bg-cream/10"}`}
            style={{ height: wys }}
          >
            <span
              className={`font-display font-extrabold leading-none ${lider ? (maly ? "text-[38px]" : "text-[52px]") : maly ? "text-[30px]" : "text-[40px]"}`}
              style={{ color: g.is_me ? "var(--cream)" : medal }}
            >
              {g.miejsce}
            </span>
          </div>
        </div>
      </li>
    );
  };

  const podiumWidok = (maly: boolean) =>
    podium.length === 3 ? (
      <ol className={`grid grid-cols-3 items-end ${maly ? "gap-1.5 pt-1.5" : "gap-2.5 px-2.5 pt-7"}`} aria-label="Podium">
        {[podium[1], podium[0], podium[2]].map((g) => kartaPodium(g, maly))}
      </ol>
    ) : null;

  const wyscig = (ciemny: boolean) => {
    const { ja, przede, za } = s;
    if (!ja) return null;
    const zawodnicy = [za, ja, przede].filter((x): x is Gracz => !!x);
    const lo = Math.min(...zawodnicy.map((x) => x.wartosc));
    const hi = Math.max(...zawodnicy.map((x) => x.wartosc));
    const poz = (x: Gracz) => (hi === lo ? 50 : Math.round(((x.wartosc - lo) / (hi - lo)) * 100));
    return (
      <div className="relative h-16" aria-hidden>
        <div className={`absolute left-3.5 right-3.5 top-[17px] h-1 rounded ${ciemny ? "bg-cream/15" : "bg-foreground/10"}`} />
        <div className="absolute left-3.5 top-[17px] h-1 rounded bg-tomato" style={{ width: `calc((100% - 28px) * ${poz(ja) / 100})` }} />
        {zawodnicy.map((x) => {
          const ty = x.is_me;
          return (
            <div
              key={x.user_id}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-1"
              style={{ left: `calc(14px + (100% - 28px) * ${poz(x) / 100})`, top: ty ? 1 : 5, zIndex: ty ? 2 : 1 }}
            >
              <span className="block rounded-full" style={{ boxShadow: `0 0 0 3px ${ty ? "var(--tomato)" : ciemny ? "var(--navy)" : "var(--card)"}` }}>
                <Av g={x} size={ty ? 34 : 26} />
              </span>
              <span
                className={`whitespace-nowrap text-[10.5px] font-extrabold ${ty ? (ciemny ? "text-cream" : "text-tomato") : ciemny ? "text-cream/55" : "text-muted-foreground"}`}
              >
                {ty ? `Ty · ${x.wartosc}` : `#${x.miejsce} · ${x.wartosc}`}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const zmianaMoja = s.ja?.zmiana;
  const plakietkaZmiany = (ciemny: boolean) =>
    zmianaMoja === undefined ? null : (
      <span
        className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11.5px] font-extrabold ${
          zmianaMoja === null
            ? ciemny ? "bg-cream/10 text-cream/70" : "bg-muted text-muted-foreground"
            : zmianaMoja > 0
              ? ciemny ? "bg-ok/30 text-[oklch(0.86_0.08_155)]" : "bg-ok/12 text-ok"
              : zmianaMoja < 0
                ? ciemny ? "bg-destructive/30 text-[oklch(0.84_0.07_25)]" : "bg-destructive/10 text-destructive"
                : ciemny ? "bg-cream/10 text-cream/70" : "bg-muted text-muted-foreground"
        }`}
      >
        {zmianaMoja === null
          ? "Nowy w tym tygodniu"
          : zmianaMoja === 0
            ? "Bez zmian w tyg."
            : `${zmianaMoja > 0 ? "▲" : "▼"} ${Math.abs(zmianaMoja)} od zeszłego tyg.`}
      </span>
    );

  const przyciskAkcji = metryka === "badges"
    ? { to: "/osiagniecia" as const, label: "Zobacz odznaki" }
    : { to: "/mapa" as const, label: "Napisz recenzję" };

  const mojaKarta = (ciemny: boolean) => {
    if (!user) {
      return (
        <div className={`flex flex-col gap-3 rounded-[22px] p-5 ${ciemny ? "border border-cream/12 bg-cream/[.07]" : "border-[1.5px] border-tomato bg-card"}`}>
          <div className={`font-display text-xl font-extrabold ${ciemny ? "text-cream" : ""}`}>Gdzie jesteś w rankingu?</div>
          <p className={`text-sm ${ciemny ? "text-cream/70" : "text-muted-foreground"}`}>
            Zaloguj się, recenzuj lokale i zbieraj punkty - zobaczysz swoje miejsce i ile brakuje do podium.
          </p>
          <Link to="/auth" className="self-start rounded-full bg-tomato px-4 py-2 text-sm font-extrabold text-cream hover:bg-tomato/90">
            Dołącz do rankingu
          </Link>
        </div>
      );
    }
    if (!s.ja) return null;
    const tip = wskazowka(s, metryka, regulyLiczby);
    return (
      <div
        className={`flex min-w-0 flex-col gap-4 ${ciemny ? "my-5 rounded-[22px] border border-cream/12 bg-cream/[.07] p-5 text-cream" : "rounded-[20px] border-[1.5px] border-tomato bg-card p-3.5"}`}
      >
        <div className="flex items-start justify-between gap-3">
          {ciemny ? (
            <div>
              <div className="text-[10px] font-extrabold tracking-[.12em] text-cream/55">TWOJA POZYCJA</div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-[54px] font-extrabold leading-[1.15]">#{s.ja.miejsce}</span>
                <span className="whitespace-nowrap font-display text-[22px] font-extrabold text-blush">
                  {s.ja.wartosc} {jednostka}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[34px] font-extrabold leading-none">#{s.ja.miejsce}</span>
              <div>
                <div className="text-[10px] font-extrabold tracking-[.1em] text-muted-foreground">TWOJA POZYCJA</div>
                <div className="font-display text-base font-extrabold leading-tight text-tomato">
                  {s.ja.wartosc} {jednostka}
                </div>
              </div>
            </div>
          )}
          {plakietkaZmiany(ciemny)}
        </div>
        {wyscig(ciemny)}
        <div className={`flex items-center gap-3 rounded-2xl ${ciemny ? "bg-cream/95 p-3 pl-3.5 text-navy" : "bg-background px-3 py-2.5"}`}>
          <span className={`grid shrink-0 place-items-center rounded-lg bg-tomato text-cream ${ciemny ? "h-[30px] w-[30px]" : "h-6 w-6"}`}>
            <ArrowUp size={ciemny ? 15 : 13} strokeWidth={3} />
          </span>
          <span className={`min-w-0 flex-1 font-bold leading-snug ${ciemny ? "text-[12.5px]" : "text-xs"}`}>{tip}</span>
          {ciemny && (
            <Link to={przyciskAkcji.to} className="whitespace-nowrap rounded-xl bg-tomato px-3 py-2 text-[11.5px] font-extrabold text-cream hover:bg-tomato/90">
              {przyciskAkcji.label}
            </Link>
          )}
        </div>
        {ciemny && <div className="text-[11px] text-cream/55">{linijkaOkresu}</div>}
      </div>
    );
  };

  const akcja = (g: Gracz, maly: boolean) => {
    const baza = `whitespace-nowrap rounded-2xl font-extrabold transition ${maly ? "w-[66px] px-1.5 py-1.5 text-center text-[10.5px]" : "px-3 py-[7px] text-[11.5px]"}`;
    if (g.is_me)
      return (
        <Link to="/u/$username" params={{ username: g.username ?? g.user_id }} className={`${baza} border border-border text-muted-foreground hover:text-foreground`}>
          {maly ? "Profil" : "Mój profil"}
        </Link>
      );
    if (g.is_friend)
      return (
        <button type="button" onClick={() => setPorownaj(g)} className={`${baza} bg-foreground/[.06] text-foreground hover:bg-foreground/10`}>
          Porównaj
        </button>
      );
    if (!user)
      return (
        <Link to="/u/$username" params={{ username: g.username ?? g.user_id }} className={`${baza} border border-border text-muted-foreground hover:text-foreground`}>
          Profil
        </Link>
      );
    if (zaproszenieDo(g.user_id))
      return <span className={`${baza} bg-foreground/[.05] text-muted-foreground`}>{maly ? "Wysłano" : "Zaproszono"}</span>;
    return (
      <button type="button" onClick={() => dodaj(g)} disabled={wyslij.isPending} className={`${baza} bg-tomato text-cream hover:bg-tomato/90 disabled:opacity-60`}>
        + Dodaj
      </button>
    );
  };

  const separatorTwojeMiejsce = (
    <div className="flex items-center gap-2.5 px-4 py-1.5 text-[10px] font-extrabold tracking-[.12em] text-muted-foreground/60">
      <span className="flex-1 border-t border-dashed border-border" />
      TWOJE MIEJSCE
      <span className="flex-1 border-t border-dashed border-border" />
    </div>
  );

  const wierszListy = (g: Gracz, i: number) => {
    const pasek = g.is_me ? "bg-tomato" : g.is_friend ? "bg-blush" : "bg-foreground/30";
    const tlo = g.is_me ? "bg-tomato/[.08] shadow-[inset_0_0_0_1.5px_var(--tomato)]" : "hover:bg-muted/40";
    return (
      <li key={g.user_id}>
        {jaUkryty && i === widoczne.length - 1 && separatorTwojeMiejsce}
        {/* Mobile */}
        <div className={`flex items-center gap-2.5 rounded-[15px] p-2.5 lg:hidden ${tlo}`}>
          <div className="flex w-7 shrink-0 flex-col items-center">
            <span className="font-display text-[17px] font-extrabold leading-tight">{g.miejsce}</span>
            <Zmiana z={g.zmiana} maly />
          </div>
          <Link to="/u/$username" params={{ username: g.username ?? g.user_id }} className="relative shrink-0">
            <Av g={g} size={36} />
            <span className="absolute -bottom-0.5 -right-1 grid h-4 w-4 place-items-center rounded-full bg-navy text-[8px] font-extrabold text-cream shadow-[0_0_0_2px_var(--card)]">
              {levelInfo(g.points_total).level}
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Link to="/u/$username" params={{ username: g.username ?? g.user_id }} className="truncate text-[13px] font-extrabold hover:text-tomato" style={vipNameStyle(g)}>
                {displayNameOf(g)}
              </Link>
              {g.is_me && <span className="shrink-0 rounded-md bg-tomato px-1 text-[8.5px] font-extrabold text-cream">TY</span>}
            </div>
            <div className="h-[5px] overflow-hidden rounded bg-foreground/[.06]">
              <div className={`h-full rounded ${pasek}`} style={{ width: `${g.procent}%` }} />
            </div>
          </div>
          <span className="min-w-[34px] text-right font-display text-[17px] font-extrabold tabular-nums">{g.wartosc}</span>
          {akcja(g, true)}
        </div>
        {/* Desktop */}
        <div
          className={`hidden items-center gap-3.5 rounded-2xl px-3 py-2.5 lg:grid lg:grid-cols-[46px_minmax(0,1fr)_70px_104px] xl:grid-cols-[52px_minmax(190px,1.1fr)_minmax(0,1fr)_78px_108px] ${tlo}`}
        >
          <div className="flex flex-col items-center gap-px">
            <span className="font-display text-[19px] font-extrabold leading-tight">{g.miejsce}</span>
            <Zmiana z={g.zmiana} />
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/u/$username" params={{ username: g.username ?? g.user_id }} className="relative shrink-0">
              <Av g={g} size={40} />
              <span className="absolute -bottom-1 -right-1.5 grid h-[19px] w-[19px] place-items-center rounded-full bg-navy text-[9px] font-extrabold text-cream shadow-[0_0_0_2px_var(--card)]">
                {levelInfo(g.points_total).level}
              </span>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link to="/u/$username" params={{ username: g.username ?? g.user_id }} className="truncate text-sm font-extrabold hover:text-tomato" style={vipNameStyle(g)}>
                  {displayNameOf(g)}
                </Link>
                {isVipActive(g) && <VipBadge />}
                {g.is_me && <span className="shrink-0 rounded-lg bg-tomato px-1.5 py-0.5 text-[9.5px] font-extrabold text-cream">TY</span>}
              </div>
              <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11.5px] text-muted-foreground">
                {g.username && <span className="truncate">@{g.username}</span>}
                {g.is_friend && <span className="font-extrabold text-ok">· znajomy</span>}
              </div>
            </div>
          </div>
          <div className="hidden items-center xl:flex">
            <div className="h-2 flex-1 overflow-hidden rounded-md bg-foreground/[.06]">
              <div className={`h-full rounded-md ${pasek}`} style={{ width: `${g.procent}%` }} />
            </div>
          </div>
          <div className="whitespace-nowrap text-right">
            <span className="font-display text-xl font-extrabold tabular-nums">{g.wartosc}</span>{" "}
            <span className="text-[10.5px] font-bold text-muted-foreground">{jednostka}</span>
          </div>
          <div className="flex min-w-0 justify-end">{akcja(g, false)}</div>
        </div>
      </li>
    );
  };

  const regulyLista = (
    <ul className="flex flex-col">
      {(reguly ?? []).map((r) => (
        <li key={r.event_key} className="flex items-center justify-between gap-2.5 border-t border-navy/10 py-2">
          <span className="text-[12.5px] font-semibold">{r.nazwa}</span>
          <span className="whitespace-nowrap font-display text-[15px] font-extrabold">+{r.points}</span>
        </li>
      ))}
    </ul>
  );

  const wspinaczeLista = (
    <ul className="flex flex-col gap-2.5">
      {wspinacze.map((g) => (
        <li key={g.user_id} className="flex items-center gap-2.5">
          <Av g={g} size={34} />
          <div className="min-w-0 flex-1">
            <Link to="/u/$username" params={{ username: g.username ?? g.user_id }} className="block truncate text-[13px] font-extrabold hover:text-tomato">
              {displayNameOf(g)}
            </Link>
            <div className="text-[11px] text-muted-foreground">teraz #{g.miejsce}</div>
          </div>
          <span className="whitespace-nowrap rounded-lg bg-ok/10 px-2 py-0.5 text-xs font-extrabold text-ok">▲ {g.zmiana}</span>
        </li>
      ))}
    </ul>
  );

  const ladowanie = isLoading && !wiersze;
  const pustyZakres = !ladowanie && !szukam && lista.length === 0;
  const zadnychZnajomych = zakres === "friends" && !ladowanie && lista.length <= 1 && !szukam;

  const wyszukiwarka = (ciemny: boolean) => (
    <div className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 ${ciemny ? "bg-cream" : "border border-border bg-card lg:max-w-[320px] lg:flex-1"}`}>
      <Search size={14} className="shrink-0 text-navy/40 dark:text-muted-foreground" />
      <input
        value={wpis}
        onChange={(e) => setWpis(e.target.value)}
        placeholder="Znajdź profil po nicku…"
        aria-label="Szukaj w rankingu"
        className={`min-w-0 flex-1 bg-transparent text-[13px] outline-none ${ciemny ? "text-navy placeholder:text-navy/45" : ""}`}
      />
      {(szukamSpoza || (isFetching && szukam)) && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      {wpis && (
        <button type="button" onClick={() => setWpis("")} className={`text-[11px] font-extrabold ${ciemny ? "text-navy/50" : "text-muted-foreground"}`}>
          Wyczyść
        </button>
      )}
    </div>
  );

  const zakresy = (
    <div className="flex shrink-0 gap-0.5 rounded-full border border-border bg-card p-1">
      {(
        [
          ["all", "Wszyscy"],
          ["friends", "Znajomi"],
        ] as const
      ).map(([id, label]) => {
        const on = zakres === id;
        return (
          <button
            key={id}
            type="button"
            disabled={id === "friends" && !user}
            title={id === "friends" && !user ? "Zaloguj się, żeby zobaczyć ranking znajomych" : undefined}
            onClick={() => {
              onZmien({ scope: id });
              setRozwiniete(false);
            }}
            aria-pressed={on}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold transition disabled:opacity-40 lg:px-3.5 lg:py-2 lg:text-[13px] ${
              on ? "bg-tomato text-cream" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            <span className={`hidden rounded-lg px-1.5 text-[10.5px] lg:inline ${on ? "bg-cream/20" : "bg-foreground/[.07]"}`}>{liczniki[id]}</span>
          </button>
        );
      })}
    </div>
  );

  const metryki = METRYKI.map((m) => {
    const on = m.id === metryka;
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => onZmien({ metryka: m.id })}
        aria-pressed={on}
        className={`shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3 py-1.5 text-xs font-extrabold transition lg:py-2 ${
          on ? "border-navy bg-navy text-cream dark:border-cream dark:bg-cream dark:text-navy" : "border-border bg-card text-muted-foreground hover:text-foreground"
        }`}
      >
        {m.etykieta}
      </button>
    );
  });

  const kropki: CSSProperties = {
    backgroundImage: "radial-gradient(oklch(0.975 0.012 60 / .09) 1.2px, transparent 1.6px)",
    backgroundSize: "18px 18px",
  };

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 pb-16 lg:gap-[18px] lg:px-[30px] lg:pt-[26px]">
      {/* Naglowek desktop */}
      <div className="hidden flex-wrap items-end justify-between gap-5 lg:flex">
        <div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-[.13em] text-tomato">{naglowekOkresu(okres, teraz)}</div>
          <h1 className="font-display text-[32px] font-extrabold leading-tight">Ranking pożeraczy</h1>
        </div>
        {przelacznikOkresu(false)}
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-b-[26px] bg-navy text-cream lg:rounded-[26px]">
        <div className="absolute inset-0" style={kropki} aria-hidden />
        <div className="absolute left-[18%] top-[-60px] h-[220px] w-[260px] rounded-full bg-tomato opacity-35 blur-[70px] lg:left-[8%] lg:h-[320px] lg:w-[420px] lg:blur-[90px]" aria-hidden />

        {/* Mobile: tytul, szukanie, okresy, podium */}
        <div className="relative flex flex-col gap-3 px-3.5 pt-5 lg:hidden">
          <div className="flex items-center justify-between gap-2.5">
            <div>
              <div className="text-[9.5px] font-extrabold uppercase tracking-[.13em] text-blush">{naglowekOkresu(okres, teraz)}</div>
              <h1 className="font-display text-[23px] font-extrabold leading-tight">Ranking pożeraczy</h1>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (szukajOtwarte) setWpis("");
                  setSzukajOtwarte((v) => !v);
                }}
                aria-label={szukajOtwarte ? "Zamknij szukanie" : "Szukaj"}
                className="grid h-9 w-9 place-items-center rounded-full bg-cream/10"
              >
                {szukajOtwarte ? <X size={15} /> : <Search size={15} />}
              </button>
              <button type="button" onClick={() => setRegulyOtwarte(true)} aria-label="Jak zdobywać punkty" className="grid h-9 w-9 place-items-center rounded-full bg-cream/10">
                <HelpCircle size={16} />
              </button>
            </div>
          </div>
          {szukajOtwarte && wyszukiwarka(true)}
          {przelacznikOkresu(true)}
          {podiumWidok(true)}
          {szukam && (
            <div className="pb-4 text-[12.5px] text-cream/70">
              {trafienia.length} {odmiana(trafienia.length, "wynik", "wyniki", "wyników")} w rankingu dla „{q}”
            </div>
          )}
          {!podium.length && !szukam && <div className="pb-4" />}
        </div>

        {/* Desktop: podium | moja karta */}
        <div className="relative hidden items-end gap-[26px] px-[26px] lg:grid min-[1180px]:grid-cols-[minmax(0,1.25fr)_minmax(300px,1fr)]">
          {podium.length === 3 ? (
            podiumWidok(false)
          ) : (
            <div className="flex flex-col justify-center gap-1.5 px-2.5 py-9">
              <div className="font-display text-2xl font-extrabold">{szukam ? `Szukasz: „${q}”` : "Podium czeka"}</div>
              <div className="text-[13px] text-cream/65">
                {szukam
                  ? `${trafienia.length} ${odmiana(trafienia.length, "osoba", "osoby", "osób")} w rankingu. Miejsca są pokazane bez zmian.`
                  : "Za mało osób z wynikiem w tym okresie, żeby ustawić podium."}
              </div>
            </div>
          )}
          <div className="self-center">{mojaKarta(true)}</div>
        </div>
      </section>

      <div className="flex flex-col gap-3 px-3 lg:px-0">
        {/* Mobile: moja karta pod hero */}
        <div className="lg:hidden">{mojaKarta(false)}</div>

        <div className="flex items-start gap-[22px]">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] lg:flex-wrap lg:gap-2.5 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
              {zakresy}
              <div className="flex gap-1.5">{metryki}</div>
              <div className="ml-auto hidden lg:flex lg:flex-1 lg:justify-end">{wyszukiwarka(false)}</div>
            </div>

            <div className="rounded-[20px] border border-border bg-card p-1 lg:rounded-[22px] lg:p-1.5">
              {ladowanie ? (
                <div className="grid place-items-center py-14">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              ) : zadnychZnajomych ? (
                <div className="px-4 py-9 text-center">
                  <div className="font-display text-lg font-extrabold">Brak znajomych do porównania</div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">Zaproś kogoś i sprawdźcie, kto pożera więcej.</p>
                  <Link to="/friends" search={{ tab: "invite" }} className="mt-3 inline-block rounded-full bg-tomato px-4 py-2 text-sm font-extrabold text-cream">
                    Zaproś znajomych
                  </Link>
                </div>
              ) : pustyZakres ? (
                <div className="px-4 py-9 text-center">
                  <div className="font-display text-lg font-extrabold">Nikt jeszcze nie punktuje</div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {okres === "all" ? "Napisz pierwszą recenzję i zajmij podium." : "W tym okresie jeszcze nikt nic nie zdobył - pierwszy ruch należy do Ciebie."}
                  </p>
                </div>
              ) : (
                <>
                  <ol>{widoczne.map(wierszListy)}</ol>
                  {szukam && spozaRankingu.length > 0 && (
                    <div className="border-t border-border pt-1">
                      <div className="px-4 py-2 text-[10px] font-extrabold tracking-[.12em] text-muted-foreground/70">POZA RANKINGIEM</div>
                      <ul>
                        {spozaRankingu.map((p) => (
                          <li key={p.id}>
                            <Link to="/u/$username" params={{ username: p.username ?? p.id }} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-muted/40">
                              <span className="w-7 text-center text-muted-foreground lg:w-[46px]">–</span>
                              <Av g={p} size={36} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-extrabold">{displayNameOf(p)}</span>
                                {p.username && <span className="block truncate text-[11.5px] text-muted-foreground">@{p.username}</span>}
                              </span>
                              <span className="text-xs text-muted-foreground">0 {jednostka} w tym widoku</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {szukam && trafienia.length === 0 && spozaRankingu.length === 0 && !szukamSpoza && (
                    <div className="px-4 py-8 text-center">
                      <div className="font-display text-lg font-extrabold">Nikogo takiego nie ma</div>
                      <p className="text-[12.5px] text-muted-foreground">Sprawdź pisownię nicku albo zaproś znajomego do poŻeramy.</p>
                    </div>
                  )}
                  {!szukam && reszta.length > WIDOCZNYCH && (
                    <div className="flex justify-center px-2.5 pb-2 pt-2.5">
                      <button
                        type="button"
                        onClick={() => setRozwiniete((v) => !v)}
                        className="rounded-full border border-border px-[18px] py-2 text-[12.5px] font-extrabold hover:border-tomato"
                      >
                        {rozwiniete ? "Zwiń" : `Pokaż wszystkich (${lista.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <p className="text-center text-[10.5px] text-muted-foreground lg:hidden">{linijkaOkresu}</p>
          </div>

          {/* Kolumna boczna - tylko na szerokich ekranach */}
          <aside className="hidden w-[290px] shrink-0 flex-col gap-3.5 min-[1400px]:flex">
            {wspinacze.length > 0 && (
              <div className="rounded-[20px] border border-border bg-card p-[18px]">
                <div className="font-display text-[17px] font-extrabold">Wspinacze tygodnia</div>
                <div className="mb-2.5 text-[11.5px] text-muted-foreground">Najwięcej miejsc w górę w rankingu ogólnym</div>
                {wspinaczeLista}
              </div>
            )}
            <div className="rounded-[20px] bg-blush p-[18px] text-navy">
              <div className="mb-2 font-display text-[17px] font-extrabold">Jak zdobywać punkty</div>
              {regulyLista}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile: arkusz z regulami */}
      {reguly_otwarte && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Jak zdobywać punkty">
          <button type="button" aria-label="Zamknij" className="absolute inset-0 bg-navy/45" onClick={() => setRegulyOtwarte(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-card px-[18px] pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2.5">
            <div className="h-1 w-10 self-center rounded bg-foreground/20" />
            <div className="font-display text-[19px] font-extrabold">Jak zdobywać punkty</div>
            <div className="rounded-2xl bg-blush px-3 text-navy">{regulyLista}</div>
            {wspinacze.length > 0 && (
              <>
                <div className="mt-1 font-display text-base font-extrabold">Wspinacze tygodnia</div>
                <div className="flex gap-2">
                  {wspinacze.map((g) => (
                    <div key={g.user_id} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl bg-background px-2 py-2.5">
                      <Av g={g} size={34} />
                      <span className="max-w-full truncate text-[11.5px] font-extrabold">{krotkaNazwa(g)}</span>
                      <span className="text-[11px] font-extrabold text-ok">▲ {g.zmiana}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button type="button" onClick={() => setRegulyOtwarte(false)} className="rounded-2xl bg-tomato p-3 text-[13.5px] font-extrabold text-cream">
              Jasne, pożeram dalej
            </button>
          </div>
        </div>
      )}

      {porownaj && <PorownanieModal znajomy={porownaj} onClose={() => setPorownaj(null)} />}
    </div>
  );
}
