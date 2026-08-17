import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAdmin, useIsSuperAdmin, useUser } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Map as MapIcon, FileText, LogOut, Loader2, Crown, Users, Share2, Award, Trophy, Zap, Megaphone, Newspaper, Lock, Activity, Inbox, UtensilsCrossed, Lightbulb, Store } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel admina — poŻeramy" }] }),
  component: AdminShell,
});

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
        <nav className="flex overflow-x-auto border-t border-border">
          <AdminTab to="/admin/places" icon={<MapIcon size={14} />} label="Lokale" pathname={pathname} />
            <AdminTab to="/admin/suggestions" icon={<Lightbulb size={14} />} label="Zgłoszenia" pathname={pathname} />
            <AdminTab to="/admin/owner-requests" icon={<Store size={14} />} label="Właściciele" pathname={pathname} />
          <AdminTab to="/admin/cuisines" icon={<UtensilsCrossed size={14} />} label="Kuchnie" pathname={pathname} />
          <AdminTab to="/admin/posts" icon={<FileText size={14} />} label="Blog" pathname={pathname} />
          <AdminTab to="/admin/points" icon={<Zap size={14} />} label="Punkty" pathname={pathname} />
          <AdminTab to="/admin/achievements" icon={<Trophy size={14} />} label="Achievementy" pathname={pathname} />
          <AdminTab to="/admin/place-posts" icon={<Newspaper size={14} />} label="Wpisy lokali" pathname={pathname} />
          {isSuper && (
            <>
              <AdminTab to="/admin/social" icon={<Share2 size={14} />} label="Social" pathname={pathname} />
              <AdminTab to="/admin/ads" icon={<Megaphone size={14} />} label="Reklamy" pathname={pathname} />
              <AdminTab to="/admin/collab" icon={<Inbox size={14} />} label="Współpraca" pathname={pathname} />
              <AdminTab to="/admin/ranks" icon={<Award size={14} />} label="Rangi" pathname={pathname} />
              <AdminTab to="/admin/users" icon={<Users size={14} />} label="Użytkownicy" pathname={pathname} />
              <AdminTab to="/admin/alpha-gate" icon={<Lock size={14} />} label="Alpha gate" pathname={pathname} />
              <AdminTab to="/admin/notifications-monitor" icon={<Activity size={14} />} label="Monitor powiadomień" pathname={pathname} />
            </>
          )}
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
