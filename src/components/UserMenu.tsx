import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  User as UserIcon,
  Settings,
  Star,
  Users as UsersIcon,
  Shield,
  Crown,
  LogOut,
  LogIn,
  Store,
} from "lucide-react";
import { useUser, useIsAdmin, useIsSuperAdmin } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import { useUserRanks } from "@/lib/ranks-api";
import { useMyFriendships } from "@/lib/friends-api";
import { useMyOwnedPlaces } from "@/lib/owners-api";
import { UserAvatar } from "@/components/UserAvatar";
import { RankBadge } from "@/components/RankBadge";
import { supabase } from "@/integrations/supabase/client";

export function UserMenu() {
  // Avoid SSR/CSR hydration mismatch: render a stable placeholder until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { user, loading } = useUser();
  const { data: profile } = useMyProfile();
  const { data: ranks } = useUserRanks(user?.id);
  const { data: isAdmin } = useIsAdmin();
  const isSuperAdmin = useIsSuperAdmin();
  const { data: friendships } = useMyFriendships();
  const { data: ownedPlaces } = useMyOwnedPlaces();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const pendingCount = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!mounted || loading) {
    // Stable placeholder identical on server and first client paint.
    return <div aria-hidden className="w-[36px] h-[36px] rounded-full bg-card border border-border" />;
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        className="pz-hit inline-flex items-center gap-1.5 chip bg-card border border-border hover:border-tomato"
      >
        <LogIn size={12} /> Zaloguj
      </Link>
    );
  }

  const topRank = (ranks ?? [])[0];
  const label = profile?.display_name || (profile?.username ? `@${profile.username}` : "Profil");




  return (
    <HoverDropdown
      label={label}
      profile={profile}
      isSuperAdmin={isSuperAdmin}
      isAdmin={!!isAdmin}
      isOwner={!!(ownedPlaces && ownedPlaces.length > 0)}
      pendingCount={pendingCount}
      userEmail={user.email ?? null}
      topRank={topRank}
      onSignOut={handleSignOut}
    />
  );
}

function HoverDropdown({
  label, profile, isSuperAdmin, isAdmin, isOwner, pendingCount, userEmail, topRank, onSignOut,
}: {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  pendingCount: number;
  userEmail: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topRank: any;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center rounded-full sm:bg-card sm:border sm:border-border sm:hover:border-tomato sm:pl-1 sm:pr-1 sm:py-1 gap-0.5 sm:gap-1">

      {profile?.username ? (
        <Link
          to="/u/$username"
          params={{ username: profile.username }}
          className="inline-flex items-center gap-2 pr-1 outline-none"
          aria-label="Mój profil"
        >
          <UserAvatar
            avatarUrl={profile?.avatar_url}
            avatarSource={profile?.avatar_source}
            displayName={profile?.display_name}
            username={profile?.username}
            size={28}
          />
          <span className="hidden sm:inline max-w-[140px] truncate text-sm font-semibold">{label}</span>
          {isSuperAdmin && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-tomato text-cream px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
              <Crown size={9} /> Head Admin
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-tomato text-cream text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </Link>
      ) : (
        <Link to="/profile" className="inline-flex items-center gap-2 pr-1 outline-none" aria-label="Uzupełnij profil">
          <UserAvatar
            avatarUrl={profile?.avatar_url}
            avatarSource={profile?.avatar_source}
            displayName={profile?.display_name}
            username={profile?.username}
            size={28}
          />
          <span className="hidden sm:inline max-w-[140px] truncate text-sm font-semibold">{label}</span>
        </Link>
      )}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className="grid place-items-center w-11 h-11 sm:w-8 sm:h-8 rounded-full hover:bg-muted outline-none active:scale-95 transition"
          aria-label="Menu profilu"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown size={16} className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">

          <DropdownMenuLabel className="flex items-center gap-2 py-2.5">
            <UserAvatar
              avatarUrl={profile?.avatar_url}
              avatarSource={profile?.avatar_source}
              displayName={profile?.display_name}
              username={profile?.username}
              size={36}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{label}</div>
              {isSuperAdmin ? (
                <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-tomato text-cream px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                  <Crown size={9} /> Head Admin
                </div>
              ) : topRank ? (
                <div className="mt-0.5"><RankBadge rank={topRank} size="sm" /></div>
              ) : (
                <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profile?.username && (
            <DropdownMenuItem asChild>
              <Link to="/u/$username" params={{ username: profile.username }} className="cursor-pointer">
                <UserIcon size={14} className="mr-2" /> Mój profil
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/friends" className="cursor-pointer">
              <UsersIcon size={14} className="mr-2" /> Znajomi
              {pendingCount > 0 && (
                <span className="ml-auto inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-tomato text-cream text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
          {profile?.username && (
            <DropdownMenuItem asChild>
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                hash="recenzje"
                className="cursor-pointer"
              >
                <Star size={14} className="mr-2" /> Moje recenzje
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/profile" className="cursor-pointer">
              <Settings size={14} className="mr-2" /> Ustawienia profilu
            </Link>
          </DropdownMenuItem>
          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/owner" className="cursor-pointer">
                  <Store size={14} className="mr-2" /> Panel właściciela
                </Link>
              </DropdownMenuItem>
            </>
          )}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin" className="cursor-pointer">
                  <Shield size={14} className="mr-2" /> Panel admina
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onSignOut}
            className="cursor-pointer text-tomato focus:text-tomato"
          >
            <LogOut size={14} className="mr-2" /> Wyloguj
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
