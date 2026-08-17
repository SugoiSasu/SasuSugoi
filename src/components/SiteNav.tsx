import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Newspaper, Users, X } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { AdBanner } from "@/components/AdBanner";
import { useUser } from "@/lib/use-auth";
import { useMyFriendships } from "@/lib/friends-api";
import logoDark from "@/assets/brand/po_zeramy-logo-dark.png.asset.json";

/** Global top nav. Hash links jump to sections on home; from other pages they navigate to "/#anchor". */
export function SiteNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHome = pathname === "/";
  const { user } = useUser();
  const { data: friendships } = useMyFriendships();
  const pendingFriends = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const hashLink = (hash: string, label: string, mobile = false) => {
    const cls = mobile
      ? "flex min-h-11 items-center py-2 text-base font-medium hover:text-tomato"
      : "hover:text-tomato transition-colors";
    return onHome ? (
      <a key={hash} href={`#${hash}`} onClick={mobile ? closeMobile : undefined} className={cls}>{label}</a>
    ) : (
      <Link key={hash} to="/" hash={hash} onClick={mobile ? closeMobile : undefined} className={cls}>{label}</Link>
    );
  };

  return (
    <header className="pz-safe-top sticky top-0 z-40 backdrop-blur-md bg-background/85 border-b border-border/70 shadow-[0_1px_0_0_hsl(var(--border)/0.4)]">
      <AdBanner />
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 h-14">
        <Link to="/" className="flex min-h-11 min-w-11 items-center gap-2" onClick={closeMobile} aria-label="poŻeramy — strona główna">
          <img src={logoDark.url} alt="poŻeramy" width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-border shadow-sm" />
        </Link>
        <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium">
          {hashLink("mapa", "Mapa")}
          {hashLink("miejscowki", "Miejscówki")}
          <Link to="/u" className="hover:text-tomato transition-colors" activeProps={{ className: "text-tomato" }}>Ranking</Link>
          {user && (
            <Link to="/wall" className="inline-flex items-center gap-1.5 hover:text-tomato transition-colors" activeProps={{ className: "text-tomato" }}>
              <Newspaper size={14} /> Pożeralnia
            </Link>
          )}
          {user && (
            <Link to="/friends" className="relative inline-flex items-center gap-1.5 hover:text-tomato transition-colors" activeProps={{ className: "text-tomato" }}>
              <Users size={14} /> Znajomi
              {pendingFriends > 0 && (
                <span className="absolute -top-1 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-tomato text-cream text-[10px] font-bold grid place-items-center">
                  {pendingFriends > 9 ? "9+" : pendingFriends}
                </span>
              )}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          <NotificationBell />
          <UserMenu />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Zamknij menu" : "Otwórz menu"}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-muted text-foreground active:scale-95 transition"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="md:hidden border-t border-border/70 bg-background/95 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-col divide-y divide-border/40">
            {hashLink("mapa", "Mapa", true)}
            {hashLink("miejscowki", "Miejscówki", true)}
            <Link to="/u" onClick={closeMobile} className="flex min-h-11 items-center py-2 text-base font-medium hover:text-tomato">Ranking</Link>
            {user && (
              <Link to="/wall" onClick={closeMobile} className="min-h-11 py-2 text-base font-medium hover:text-tomato inline-flex items-center gap-2">
                <Newspaper size={16} /> Pożeralnia
              </Link>
            )}
            {user && (
              <Link to="/friends" onClick={closeMobile} className="min-h-11 py-2 text-base font-medium hover:text-tomato inline-flex items-center gap-2">
                <Users size={16} /> Znajomi
                {pendingFriends > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-tomato text-cream text-[10px] font-bold grid place-items-center">
                    {pendingFriends > 9 ? "9+" : pendingFriends}
                  </span>
                )}
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
