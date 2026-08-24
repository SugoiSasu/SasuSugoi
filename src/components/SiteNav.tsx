import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Award,
  Handshake,
  Heart,
  MapPinCheck,
  Menu,
  Newspaper,
  Trophy,
  UserPlus2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { AdBanner } from "@/components/AdBanner";
import { UserAvatar } from "@/components/UserAvatar";
import { levelInfo } from "@/components/LevelProgress";
import { VipBadge, isVipActive, vipNameStyle } from "@/components/VipBadge";
import { InviteFriendsModal } from "@/components/InviteFriendsModal";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import { useUserVisitedPlaces, useUserFavoritePlaces } from "@/lib/visits-api";
import { useFriendProfiles, useMyFriendships, useMyInviteLink } from "@/lib/friends-api";
import { useCurrentAwardsEvent } from "@/lib/awards-api";
import logoDark from "@/assets/brand/po_zeramy-logo-dark.png.asset.json";

/** Global top nav. Hash links jump to sections on home; from other pages they navigate to "/#anchor". */
export function SiteNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHome = pathname === "/";
  const { user } = useUser();
  const { data: profile } = useMyProfile();
  const { data: friendships } = useMyFriendships();
  const { data: friendProfiles } = useFriendProfiles(user?.id);
  const { data: visited } = useUserVisitedPlaces(user?.id, "visited");
  const { data: favs } = useUserFavoritePlaces(user?.id);
  const pendingFriends = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;
  const { data: awardsEvent } = useCurrentAwardsEvent();
  const inviteLink = useMyInviteLink(user?.id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const closeMobile = () => setMobileOpen(false);

  const level = profile ? levelInfo(profile.points_total ?? 0) : null;

  async function inviteFriends() {
    try {
      const token = await inviteLink.ensure();
      setInviteUrl(`${window.location.origin}/i/${token}`);
      setInviteOpen(true);
      closeMobile();
    } catch {
      toast.error("Nie udało się przygotować linku zaproszenia");
    }
  }

  const hashLink = (hash: string, label: string, mobile = false) => {
    const cls = mobile
      ? "flex min-h-11 items-center py-2 text-base font-medium hover:text-tomato"
      : "hover:text-tomato transition-colors";
    return onHome ? (
      <a key={hash} href={`#${hash}`} onClick={mobile ? closeMobile : undefined} className={cls}>
        {label}
      </a>
    ) : (
      <Link
        key={hash}
        to="/"
        hash={hash}
        onClick={mobile ? closeMobile : undefined}
        className={cls}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
    <header className="pz-safe-top sticky top-0 z-40 backdrop-blur-md bg-background/85 border-b border-border/70 shadow-[0_1px_0_0_hsl(var(--border)/0.4)]">
      <AdBanner />
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 h-14">
        <Link
          to="/"
          className="flex min-h-11 min-w-11 items-center gap-2"
          onClick={closeMobile}
          aria-label="poŻeramy - strona główna"
        >
          <img
            src={logoDark.url}
            alt="poŻeramy"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-border shadow-sm"
          />
        </Link>
        <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium">
          {hashLink("mapa", "Mapa")}
          {hashLink("miejscowki", "Miejscówki")}
          <Link
            to="/u"
            className="hover:text-tomato transition-colors"
            activeProps={{ className: "text-tomato" }}
          >
            Ranking
          </Link>
          {user && (
            <Link
              to="/wall"
              className="inline-flex items-center gap-1.5 hover:text-tomato transition-colors"
              activeProps={{ className: "text-tomato" }}
            >
              <Newspaper size={14} /> Pożeralnia
            </Link>
          )}
          {user && (
            <Link
              to="/friends"
              className="relative inline-flex items-center gap-1.5 hover:text-tomato transition-colors"
              activeProps={{ className: "text-tomato" }}
            >
              <Users size={14} /> Znajomi
              {pendingFriends > 0 && (
                <span className="absolute -top-1 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-tomato text-cream text-[10px] font-bold grid place-items-center">
                  {pendingFriends > 9 ? "9+" : pendingFriends}
                </span>
              )}
            </Link>
          )}
          {user && (
            <Link
              to="/osiagniecia"
              className="inline-flex items-center gap-1.5 hover:text-tomato transition-colors"
              activeProps={{ className: "text-tomato" }}
            >
              <Award size={14} /> Osiągnięcia
            </Link>
          )}
          {awardsEvent && (
            <Link
              to="/warte-pozarcia"
              className="inline-flex items-center gap-1.5 hover:text-tomato transition-colors"
              activeProps={{ className: "text-tomato" }}
            >
              <Trophy size={14} /> Warte poŻarcia
            </Link>
          )}
          <Link
            to="/wspolpraca"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-tomato transition-colors"
            activeProps={{ className: "text-tomato" }}
          >
            <Handshake size={14} /> Współpraca
          </Link>
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
        <nav className="md:hidden max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-border/70 bg-background/95 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 space-y-4">
            {user && profile && (
              <Link
                to="/u/$username"
                params={{ username: profile.username ?? user.id }}
                onClick={closeMobile}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <UserAvatar
                  avatarUrl={profile.avatar_url}
                  avatarSource={profile.avatar_source}
                  displayName={profile.display_name}
                  username={profile.username}
                  gender={profile.gender}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate font-semibold" style={vipNameStyle(profile)}>
                      {profile.display_name || profile.username || "Twój profil"}
                    </span>
                    {isVipActive(profile) && <VipBadge />}
                  </p>
                  {level && (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>Poziom {level.level}</span>
                        <span>{level.xpToNext} XP dalej</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-tomato transition-all duration-500"
                          style={{ width: `${level.pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            )}

            {user && (
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-2">
                <MobileStatChip
                  to="/moje-miejsca"
                  search={{ tab: "visited" }}
                  icon={MapPinCheck}
                  value={visited?.length ?? 0}
                  label="Odwiedzone"
                  onClick={closeMobile}
                />
                <MobileStatChip
                  to="/moje-miejsca"
                  search={{ tab: "fav" }}
                  icon={Heart}
                  value={favs?.length ?? 0}
                  label="Ulubione"
                  onClick={closeMobile}
                />
                <MobileStatChip
                  to="/friends"
                  icon={Users}
                  value={friendProfiles?.length ?? 0}
                  label="Znajomi"
                  onClick={closeMobile}
                />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 px-1 pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Odkrywaj
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col divide-y divide-border/40">
                {hashLink("mapa", "Mapa", true)}
                {hashLink("miejscowki", "Miejscówki", true)}
                <Link
                  to="/u"
                  onClick={closeMobile}
                  className="flex min-h-11 items-center py-2 text-base font-medium hover:text-tomato"
                >
                  Ranking
                </Link>
              </div>
            </div>

            {user && (
              <div>
                <div className="flex items-center gap-2 px-1 pb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Społeczność
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="flex flex-col divide-y divide-border/40">
                  <Link
                    to="/wall"
                    onClick={closeMobile}
                    className="min-h-11 py-2 text-base font-medium hover:text-tomato inline-flex items-center gap-2"
                  >
                    <Newspaper size={16} /> Pożeralnia
                  </Link>
                  <Link
                    to="/friends"
                    onClick={closeMobile}
                    className="min-h-11 py-2 text-base font-medium hover:text-tomato inline-flex items-center gap-2"
                  >
                    <Users size={16} /> Znajomi
                    {pendingFriends > 0 && (
                      <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-tomato text-cream text-[10px] font-bold grid place-items-center">
                        {pendingFriends > 9 ? "9+" : pendingFriends}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/osiagniecia"
                    onClick={closeMobile}
                    className="min-h-11 py-2 text-base font-medium hover:text-tomato inline-flex items-center gap-2"
                  >
                    <Award size={16} /> Osiągnięcia
                  </Link>
                  {awardsEvent && (
                    <Link
                      to="/warte-pozarcia"
                      onClick={closeMobile}
                      className="min-h-11 py-2 text-base font-medium hover:text-tomato inline-flex items-center gap-2"
                    >
                      <Trophy size={16} /> Warte poŻarcia
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 px-1 pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Więcej
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col divide-y divide-border/40">
                <Link
                  to="/wspolpraca"
                  onClick={closeMobile}
                  className="min-h-11 py-2 text-base font-medium text-muted-foreground hover:text-tomato inline-flex items-center gap-2"
                >
                  <Handshake size={16} /> Współpraca
                </Link>
              </div>
            </div>

            {user && (
              <button
                type="button"
                onClick={inviteFriends}
                disabled={inviteLink.isLoading}
                className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-tomato/30 bg-tomato/10 px-4 py-2.5 text-sm font-semibold text-tomato disabled:opacity-50"
              >
                <UserPlus2 size={16} /> Zaproś znajomych
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
    {inviteUrl && (
      <InviteFriendsModal open={inviteOpen} onClose={() => setInviteOpen(false)} url={inviteUrl} />
    )}
    </>
  );
}

function MobileStatChip({
  icon: Icon,
  value,
  label,
  to,
  search,
  onClick,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search?: any;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      search={search}
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-center transition-colors hover:bg-muted"
    >
      <Icon size={15} className="text-tomato" />
      <p className="font-display text-sm font-extrabold leading-none">{value}</p>
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </Link>
  );
}
