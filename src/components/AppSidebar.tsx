import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Compass,
  Map,
  Bookmark,
  Users,
  Trophy,
  User as UserIcon,
  Newspaper,
  Settings,
  LogOut,
  MapPinCheck,
  Heart,
  UserPlus2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import { useUserVisitedPlaces, useUserFavoritePlaces } from "@/lib/visits-api";
import { useFriendProfiles, useMyInviteLink } from "@/lib/friends-api";
import { UserAvatar } from "@/components/UserAvatar";
import { levelInfo } from "@/components/LevelProgress";
import { VipBadge, isVipActive, vipNameStyle } from "@/components/VipBadge";
import { RandomPlaceCard } from "@/components/RandomPlaceCard";
import logoDark from "@/assets/brand/po_zeramy-logo-dark.png.asset.json";

const coreItems = [
  { to: "/", label: "Odkrywaj", icon: Compass, exact: true },
  { to: "/mapa", label: "Mapa", icon: Map },
  { to: "/moje-miejsca", label: "Moje miejsca", icon: Bookmark },
] as const;

const socialItems = [
  { to: "/friends", label: "Znajomi", icon: Users },
  { to: "/osiagniecia", label: "Osiągnięcia", icon: Trophy },
  { to: "/wall", label: "Pożeralnia", icon: Newspaper },
] as const;

const linkBase =
  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-cream/75 transition-all duration-200 ease-out hover:translate-x-0.5 hover:bg-cream/10 hover:text-cream";
const iconCls = "shrink-0 transition-transform duration-200 ease-out group-hover:scale-110";
const activeCls = {
  className:
    "animate-in fade-in zoom-in-95 duration-300 ease-out bg-tomato text-cream shadow-md shadow-tomato/25 hover:translate-x-0 hover:bg-tomato",
};
const sectionPanel = "space-y-0.5 rounded-2xl bg-cream/[0.05] p-1.5 ring-1 ring-cream/[0.06]";

/** Desktop-only app sidebar (navy), matching the poŻeramy app layout. */
export function AppSidebar() {
  const { user } = useUser();
  const { data: profile } = useMyProfile();
  const { data: visited } = useUserVisitedPlaces(user?.id, "visited");
  const { data: favs } = useUserFavoritePlaces(user?.id);
  const { data: friends } = useFriendProfiles(user?.id);
  const inviteLink = useMyInviteLink(user?.id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function inviteFriends() {
    let token: string;
    try {
      token = await inviteLink.ensure();
    } catch {
      toast.error("Nie udało się przygotować linku zaproszenia");
      return;
    }
    const url = `${window.location.origin}/i/${token}`;
    const text = "Dołącz do mnie na poŻeramy — znajdźmy razem najlepsze knajpy w Poznaniu!";
    if (navigator.share) {
      try {
        await navigator.share({ title: "poŻeramy", text, url });
        return;
      } catch {
        /* user cancelled the share sheet — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link zaproszenia skopiowany ✓");
    } catch {
      toast.error("Nie udało się skopiować linku");
    }
  }

  const level = profile ? levelInfo(profile.points_total ?? 0) : null;

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[236px] flex-col bg-[linear-gradient(180deg,oklch(0.35_0.14_268),oklch(0.31_0.14_268)_45%,oklch(0.25_0.13_268))] px-3 py-5 shadow-[6px_0_28px_-12px_rgba(0,0,0,0.45)]">
      <Link
        to="/"
        className="mb-1 flex items-center gap-2 px-2 transition-transform duration-200 ease-out hover:scale-[1.02]"
        aria-label="poŻeramy — strona główna"
      >
        <img
          src={logoDark.url}
          alt="poŻeramy"
          width={44}
          height={44}
          className="h-11 w-11 rounded-xl object-cover shadow-sm"
        />
        <span className="font-display text-lg font-extrabold text-cream">poŻeramy</span>
      </Link>

      {user && profile ? (
        <Link
          to="/u/$username"
          params={{ username: profile.username ?? user.id }}
          className="group mb-4 mt-2 flex items-center gap-2.5 rounded-xl px-2 py-2 transition-all duration-200 ease-out hover:bg-cream/10"
        >
          <div className="transition-transform duration-200 ease-out group-hover:scale-105">
            <UserAvatar
              avatarUrl={profile.avatar_url}
              displayName={profile.display_name}
              username={profile.username}
              size={36}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 min-w-0">
              <span
                className="truncate text-sm font-semibold text-cream"
                style={vipNameStyle(profile)}
              >
                {profile.display_name || profile.username || "Twój profil"}
              </span>
              {isVipActive(profile) && <VipBadge />}
            </p>
            {level && <p className="truncate text-[11px] text-cream/55">Poziom {level.level}</p>}
          </div>
        </Link>
      ) : (
        <p className="mb-4 mt-2 px-2 text-[11px] font-medium uppercase tracking-wide text-cream/40">
          Foodie z Poznania
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-3.5 overflow-y-auto">
        <div>
          <nav className={sectionPanel}>
            {coreItems.map(({ to, label, icon: Icon, ...rest }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: "exact" in rest ? rest.exact : false }}
                className={linkBase}
                activeProps={activeCls}
              >
                <Icon size={18} className={iconCls} />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="my-3.5 flex items-center gap-2 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cream/35">
              Społeczność
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-cream/15 to-transparent" />
          </div>

          <nav className={sectionPanel}>
            {socialItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className={linkBase} activeProps={activeCls}>
                <Icon size={18} className={iconCls} />
                <span className="truncate">{label}</span>
              </Link>
            ))}
            {profile?.username ? (
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                className={linkBase}
                activeProps={activeCls}
              >
                <UserIcon size={18} className={iconCls} />
                <span className="truncate">Profil</span>
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="space-y-3.5">
          {level && (
            <Link
              to="/osiagniecia"
              className="pz-fade-in block rounded-2xl border border-cream/15 bg-cream/[0.06] p-3.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-cream/25 hover:bg-cream/10 hover:shadow-lg"
            >
              <div className="flex items-end justify-between gap-2">
                <p className="font-display text-base font-extrabold text-cream">
                  Poziom {level.level}
                </p>
                <p className="text-[11px] font-semibold text-cream/60">{level.xpToNext} XP dalej</p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream/15">
                <div
                  className="h-full rounded-full bg-tomato transition-all duration-500"
                  style={{ width: `${level.pct}%` }}
                />
              </div>
            </Link>
          )}

          {user && (
            <div className="pz-fade-in grid grid-cols-3 gap-1.5 rounded-2xl border border-cream/15 bg-cream/[0.06] p-2.5">
              <StatChip to="/moje-miejsca" search={{ tab: "visited" }} icon={MapPinCheck} value={visited?.length ?? 0} label="Odwiedzone" />
              <StatChip to="/moje-miejsca" search={{ tab: "fav" }} icon={Heart} value={favs?.length ?? 0} label="Ulubione" />
              <StatChip to="/friends" icon={Users} value={friends?.length ?? 0} label="Znajomi" />
            </div>
          )}

          {user && <RandomPlaceCard userId={user.id} />}
        </div>
      </div>

      <div className="mt-3.5 border-t border-cream/10 pt-3">
        {user && (
          <button
            type="button"
            onClick={inviteFriends}
            disabled={inviteLink.isLoading}
            className={`${linkBase} w-full text-left text-tomato hover:bg-tomato/10 hover:text-tomato disabled:opacity-50`}
          >
            <UserPlus2 size={18} className={iconCls} />
            <span className="truncate">Zaproś znajomych</span>
          </button>
        )}
        <Link to="/profile" className={linkBase} activeProps={activeCls}>
          <Settings size={18} className={iconCls} />
          <span className="truncate">Ustawienia</span>
        </Link>
        {user ? (
          <button type="button" onClick={signOut} className={`${linkBase} w-full text-left`}>
            <LogOut size={18} className={iconCls} />
            <span className="truncate">Wyloguj</span>
          </button>
        ) : (
          <Link to="/auth" className={linkBase}>
            <UserIcon size={18} className={iconCls} />
            <span className="truncate">Zaloguj</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

function StatChip({
  icon: Icon,
  value,
  label,
  to,
  search,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search?: any;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="flex flex-col items-center gap-0.5 rounded-xl py-1 text-center transition-colors duration-150 hover:bg-cream/10"
    >
      <Icon size={15} className="text-tomato" />
      <p className="font-display text-sm font-extrabold leading-none text-cream">{value}</p>
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-cream/45">
        {label}
      </p>
    </Link>
  );
}
