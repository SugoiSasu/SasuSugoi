import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAdmin, useIsSuperAdmin, useUser } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Map as MapIcon, FileText, LogOut, Loader2, Crown, Users, Share2, Award, Trophy, Zap, Megaphone, Newspaper, Lock, Activity, Inbox, UtensilsCrossed, Lightbulb, Store, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel admina — poŻeramy" }] }),
  component: AdminShell,
});

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  superOnly?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Treść",
    items: [
      { to: "/admin/places", icon: <MapIcon size={14} />, label: "Lokale" },
      { to: "/admin/cuisines", icon: <UtensilsCrossed size={14} />, label: "Kuchnie" },
      { to: "/admin/posts", icon: <FileText size={14} />, label: "Blog" },
      { to: "/admin/place-posts", icon: <Newspaper size={14} />, label: "Wpisy lokali" },
    ],
  },
  {
    title: "Moderacja",
    items: [
      { to: "/admin/suggestions", icon: <Lightbulb size={14} />, label: "Zgłoszenia" },
      { to: "/admin/owner-requests", icon: <Store size={14} />, label: "Właściciele" },
    ],
  },
  {
    title: "Gamifikacja",
    items: [
      { to: "/admin/points", icon: <Zap size={14} />, label: "Punkty" },
      { to: "/admin/achievements", icon: <Trophy size={14} />, label: "Achievementy" },
      { to: "/admin/ranks", icon: <Award size={14} />, label: "Rangi", superOnly: true },
    ],
  },
  {
    title: "Super Admin",
    items: [
      { to: "/admin/social", icon: <Share2 size={14} />, label: "Social", superOnly: true },
      { to: "/admin/ads", icon: <Megaphone size={14} />, label: "Reklamy", superOnly: true },
      { to: "/admin/collab", icon: <Inbox size={14} />, label: "Współpraca", superOnly: true },
      { to: "/admin/users", icon: <Users size={14} />, label: "Użytkownicy", superOnly: true },
      { to: "/admin/alpha-gate", icon: <Lock size={14} />, label: "Alpha gate", superOnly: true },
      { to: "/admin/notifications-monitor", icon: <Activity size={14} />, label: "Monitor powiadomień", superOnly: true },
    ],
  },
];

function AdminShell() {
  const { user } = useUser();
  const { data: isAdmin, isLoading } = useIsAdmin();
  const isSuper = useIsSuperAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (pathname === "/admin") navigate({ to: "/admin/places", replace: true });
  }, [pathname, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="animate-spin text-tomato" size={32} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background p-4">
        <div className="max-w-md text-center bg-card border border-border rounded-3xl p-8 shadow-lg">
          <Crown className="mx-auto text-tomato mb-3" size={40} />
          <h1 className="font-display text-2xl mb-2">Brak uprawnień admina</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Konto <strong>{user?.email}</strong> nie ma roli admina. Tylko Head Admin (pożeramy) może nadać Ci dostęp.
          </p>
          <Link to="/" className="rounded-full bg-tomato text-cream px-6 py-3 font-semibold hover:bg-tomato/90 transition inline-block">
            Wróć na stronę główną
          </Link>
          <button onClick={signOut} className="mt-4 text-sm text-muted-foreground hover:text-tomato block mx-auto">
            Wyloguj
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-display text-xl font-bold">poŻeramy <span className="text-tomato">/ admin</span></Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-muted-foreground">{user?.email}</span>
            <button onClick={signOut} className="chip bg-card border border-border hover:border-tomato">
              <LogOut size={14} /> Wyloguj
            </button>
          </div>
        </div>
        <MobileAdminNav groups={NAV_GROUPS} isSuper={isSuper} pathname={pathname} navigate={navigate} />
        <nav className="hidden sm:flex overflow-x-auto border-t border-border">
          {NAV_GROUPS.map((group, gi) => {
            const items = group.items.filter((it) => !it.superOnly || isSuper);
            if (items.length === 0) return null;
            return (
              <div
                key={group.title}
                className={`flex shrink-0 ${gi > 0 ? "ml-2 border-l border-border pl-2" : ""}`}
              >
                {items.map((it) => (
                  <AdminTab key={it.to} to={it.to} icon={it.icon} label={it.label} pathname={pathname} />
                ))}
              </div>
            );
          })}
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function AdminTab({ to, icon, label, pathname }: { to: string; icon: React.ReactNode; label: string; pathname: string }) {
  const active = pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition border-b-2 ${
        active ? "border-tomato text-tomato" : "border-transparent text-foreground hover:text-tomato"
      }`}
    >
      {icon} {label}
    </Link>
  );
}

function MobileAdminNav({
  groups,
  isSuper,
  pathname,
  navigate,
}: {
  groups: { title: string; items: NavItem[] }[];
  isSuper: boolean;
  pathname: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const current = groups
    .flatMap((g) => g.items)
    .find((it) => pathname.startsWith(it.to));
  return (
    <div className="relative sm:hidden border-t border-border">
      <select
        aria-label="Sekcja panelu admina"
        value={current?.to ?? ""}
        onChange={(e) => navigate({ to: e.target.value })}
        className="w-full appearance-none bg-transparent px-4 py-3 pr-10 text-sm font-semibold text-tomato outline-none"
      >
        {groups.map((group) => {
          const items = group.items.filter((it) => !it.superOnly || isSuper);
          if (items.length === 0) return null;
          return (
            <optgroup key={group.title} label={group.title}>
              {items.map((it) => (
                <option key={it.to} value={it.to}>
                  {it.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-tomato" />
    </div>
  );
}
