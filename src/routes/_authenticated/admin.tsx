import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAdmin, useIsSuperAdmin, useUser } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Map as MapIcon,
  FileText,
  LogOut,
  Loader2,
  Users,
  Share2,
  Megaphone,
  Inbox,
  ShieldCheck,
  Sparkles,
  Settings2,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel admina - poŻeramy" }] }),
  component: AdminShell,
});

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  superOnly?: boolean;
}

// Reorganized: Moderacja (suggestions+owner-requests), Gamifikacja
// (points+achievements+ranks), and Ustawienia (alpha-gate+notifications-monitor)
// are each now a single page with internal tabs instead of separate nav
// entries. Places absorbed Cuisines and Place-posts as internal tabs too
// (see admin.places.index.tsx) — was 15 top-level items, now 9.
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Treść",
    items: [
      { to: "/admin/places", icon: <MapIcon size={14} />, label: "Lokale" },
      { to: "/admin/posts", icon: <FileText size={14} />, label: "Blog" },
    ],
  },
  {
    title: "Zarządzanie",
    items: [
      { to: "/admin/moderacja", icon: <ShieldCheck size={14} />, label: "Moderacja" },
      { to: "/admin/gamifikacja", icon: <Sparkles size={14} />, label: "Gamifikacja" },
    ],
  },
  {
    title: "Super Admin",
    items: [
      { to: "/admin/social", icon: <Share2 size={14} />, label: "Social", superOnly: true },
      { to: "/admin/ads", icon: <Megaphone size={14} />, label: "Reklamy", superOnly: true },
      { to: "/admin/collab", icon: <Inbox size={14} />, label: "Współpraca", superOnly: true },
      { to: "/admin/users", icon: <Users size={14} />, label: "Użytkownicy", superOnly: true },
      {
        to: "/admin/ustawienia",
        icon: <Settings2 size={14} />,
        label: "Ustawienia",
        superOnly: true,
      },
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
      <div className="min-h-dvh grid place-items-center bg-background p-4 overflow-hidden">
        <div className="relative max-w-md text-center bg-card border border-border rounded-3xl p-8 shadow-lg pz-403-card">
          <div className="relative mx-auto mb-4 w-20 h-20">
            <span
              className="absolute inset-0 grid place-items-center text-5xl pz-403-plate"
              aria-hidden="true"
            >
              🍽️
            </span>
            <span
              className="absolute -bottom-1 -right-2 grid place-items-center w-9 h-9 rounded-full bg-tomato text-cream text-base shadow-md pz-403-lock"
              aria-hidden="true"
            >
              🔒
            </span>
          </div>
          <h1 className="font-display text-2xl mb-2">Ten stolik jest zarezerwowany</h1>
          <p className="text-sm text-muted-foreground mb-1">
            Konto <strong>{user?.email}</strong> nie jest na liście gości VIP (czyli adminów).
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Nawet najlepsza recenzja Cię tu nie wpuści - o dostęp poproś Head Admina (pożeramy) 😅
          </p>
          <Link
            to="/"
            className="rounded-full bg-tomato text-cream px-6 py-3 font-semibold hover:bg-tomato/90 transition inline-block"
          >
            Wróć na stronę główną
          </Link>
          <button
            onClick={signOut}
            className="mt-4 text-sm text-muted-foreground hover:text-tomato block mx-auto"
          >
            Wyloguj
          </button>
        </div>
        <style>{`
          @keyframes pz-403-in { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
          @keyframes pz-403-wobble { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
          @keyframes pz-403-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
          .pz-403-card { animation: pz-403-in 400ms cubic-bezier(0.16, 1, 0.3, 1); }
          .pz-403-plate { animation: pz-403-wobble 2.2s ease-in-out infinite; transform-origin: 50% 65%; }
          .pz-403-lock { animation: pz-403-pulse 1.6s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .pz-403-card, .pz-403-plate, .pz-403-lock { animation: none; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-display text-xl font-bold">
              poŻeramy <span className="text-tomato">/ admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-muted-foreground">{user?.email}</span>
            <button
              onClick={signOut}
              className="chip bg-card border border-border hover:border-tomato"
            >
              <LogOut size={14} /> Wyloguj
            </button>
          </div>
        </div>
        <MobileAdminNav
          groups={NAV_GROUPS}
          isSuper={isSuper}
          pathname={pathname}
          navigate={navigate}
        />
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
                  <AdminTab
                    key={it.to}
                    to={it.to}
                    icon={it.icon}
                    label={it.label}
                    pathname={pathname}
                  />
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

function AdminTab({
  to,
  icon,
  label,
  pathname,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  pathname: string;
}) {
  const active = pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition border-b-2 ${
        active
          ? "border-tomato text-tomato"
          : "border-transparent text-foreground hover:text-tomato"
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
  const current = groups.flatMap((g) => g.items).find((it) => pathname.startsWith(it.to));
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
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-tomato"
      />
    </div>
  );
}
