import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Map, Layers, Users, User as UserIcon } from "lucide-react";
import { useMyProfile } from "@/lib/profile-api";
import { useMyFriendships } from "@/lib/friends-api";
import { useUser } from "@/lib/use-auth";

/**
 * Dolny pasek na telefonie: 5 zakładek z podpisami (Odkrywaj, Mapa, Karty, Znajomi, Profil).
 * Redesign 2026-11: bez środkowego "+". "Dodaj" jest w kontekście - recenzja na stronie lokalu, zdjęcie
 * w Pożeralni, zgłoszenie lokalu na stronie głównej. "Moje miejsca" są w menu i w liczniku panelu bocznego.
 * Podpisy widać zawsze (nie tylko przy aktywnej zakładce): ikony bez opisu to częsta skarga w aplikacjach
 * tego typu.
 */
const tabs = [
  { to: "/", label: "Odkrywaj", icon: Compass, exact: true },
  { to: "/mapa", label: "Mapa", icon: Map, exact: false },
  { to: "/karty", label: "Karty", icon: Layers, exact: false },
] as const;

export function BottomTabBar() {
  // Prawdziwa wysokosc paska (z paskiem gestow iPhone'a) jako zmienna CSS -
  // elementy przypiete nad nim (karta pinezki na mapie, "Pokaz liste")
  // zgadywaly ja w rem i na iPhonie chowaly sie pod paskiem (zrzut 2026-09-28).
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ustaw = () =>
      document.documentElement.style.setProperty("--pz-tabbar-h", `${el.getBoundingClientRect().height}px`);
    ustaw();
    const ro = new ResizeObserver(ustaw);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--pz-tabbar-h");
    };
  }, []);
  const { data: profile } = useMyProfile();
  const { user } = useUser();
  const { data: friendships } = useMyFriendships();
  const pendingFriends = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact: boolean) => (exact ? pathname === to : pathname.startsWith(to));

  const itemCls = (active: boolean) =>
    `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[11px] font-semibold transition-colors ${
      active ? "text-tomato" : "text-muted-foreground"
    }`;
  const kreska = (active: boolean) =>
    active ? (
      <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-tomato" aria-hidden="true" />
    ) : null;
  const podpis = "max-w-full truncate leading-none";

  const profilAktywny = profile?.username ? pathname.startsWith("/u/") : pathname.startsWith("/auth");

  return (
    <nav
      ref={navRef}
      aria-label="Nawigacja główna"
      className="pz-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {tabs.map(({ to, label, icon: Icon, exact }) => {
          const active = isActive(to, exact);
          return (
            <Link key={to} to={to} className={itemCls(active)} aria-current={active ? "page" : undefined}>
              {kreska(active)}
              <Icon size={21} aria-hidden="true" />
              <span className={podpis}>{label}</span>
            </Link>
          );
        })}

        <Link
          to="/friends"
          className={itemCls(isActive("/friends", false))}
          aria-current={isActive("/friends", false) ? "page" : undefined}
        >
          {kreska(isActive("/friends", false))}
          <span className="relative">
            <Users size={21} aria-hidden="true" />
            {pendingFriends > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-tomato px-0.5 text-[9px] font-bold text-cream">
                <span className="sr-only">Oczekujące zaproszenia: </span>
                {pendingFriends > 9 ? "9+" : pendingFriends}
              </span>
            )}
          </span>
          <span className={podpis}>Znajomi</span>
        </Link>

        {profile?.username ? (
          <Link
            to="/u/$username"
            params={{ username: profile.username }}
            className={itemCls(profilAktywny)}
            aria-current={profilAktywny ? "page" : undefined}
          >
            {kreska(profilAktywny)}
            <UserIcon size={21} aria-hidden="true" />
            <span className={podpis}>Profil</span>
          </Link>
        ) : (
          <Link to="/auth" className={itemCls(profilAktywny)} aria-current={profilAktywny ? "page" : undefined}>
            {kreska(profilAktywny)}
            <UserIcon size={21} aria-hidden="true" />
            <span className={podpis}>{user ? "Profil" : "Zaloguj"}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
