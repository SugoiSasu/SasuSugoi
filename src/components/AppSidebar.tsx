import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Compass, Map, Bookmark, Users, Trophy, User as UserIcon, Newspaper, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import logoDark from "@/assets/brand/po_zeramy-logo-dark.png.asset.json";

const items = [
  { to: "/", label: "Odkrywaj", icon: Compass, exact: true },
  { to: "/mapa", label: "Mapa", icon: Map },
  { to: "/moje-miejsca", label: "Moje miejsca", icon: Bookmark },
  { to: "/friends", label: "Znajomi", icon: Users },
  { to: "/osiagniecia", label: "Osiągnięcia", icon: Trophy },
  { to: "/wall", label: "Pożeralnia", icon: Newspaper },
] as const;

const linkBase =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-cream/75 transition-colors hover:bg-cream/10 hover:text-cream";

/** Desktop-only app sidebar (navy), matching the poŻeramy app layout. */
export function AppSidebar() {
  const { user } = useUser();
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[236px] flex-col bg-navy px-3 py-5">
      <Link to="/" className="mb-6 flex items-center gap-2 px-2" aria-label="poŻeramy — strona główna">
        <img src={logoDark.url} alt="poŻeramy" width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon, ...rest }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: "exact" in rest ? rest.exact : false }}
            className={linkBase}
            activeProps={{ className: "bg-tomato/15 text-cream" }}
          >
            <Icon size={18} className="shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        {profile?.username ? (
          <Link
            to="/u/$username"
            params={{ username: profile.username }}
            className={linkBase}
            activeProps={{ className: "bg-tomato/15 text-cream" }}
          >
            <UserIcon size={18} className="shrink-0" />
            <span className="truncate">Profil</span>
          </Link>
        ) : null}
      </nav>

      <div className="mt-4 border-t border-cream/10 pt-3">
        <Link to="/profile" className={linkBase} activeProps={{ className: "bg-tomato/15 text-cream" }}>
          <Settings size={18} className="shrink-0" />
          <span className="truncate">Ustawienia</span>
        </Link>
        {user ? (
          <button type="button" onClick={signOut} className={`${linkBase} w-full text-left`}>
            <LogOut size={18} className="shrink-0" />
            <span className="truncate">Wyloguj</span>
          </button>
        ) : (
          <Link to="/auth" className={linkBase}>
            <UserIcon size={18} className="shrink-0" />
            <span className="truncate">Zaloguj</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
