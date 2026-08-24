import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  ArrowLeft,
  Star,
  Trophy,
  Users,
  Loader2,
  Camera,
  UserPlus,
  UserCheck,
  Clock,
  Instagram,
  Music2,
  Youtube,
  Facebook,
  Twitter,
  Ban,
  Folder,
  ShieldOff,
  X,
  Check,
  Bookmark,
  CheckCircle2,
  Heart,
  Sparkles,
  Store,
} from "lucide-react";
import { useProfileByUsername, useUpdateProfile, uploadAvatar } from "@/lib/profile-api";
import { usePlacesOwnedByUser } from "@/lib/owners-api";
import { useUserRanks } from "@/lib/ranks-api";
import { useUserReviewStats, useUserReviews, useReviewPhotoUrl } from "@/lib/reviews-api";
import {
  useAchievements,
  useUserAchievements,
  computeProgress,
  CRITERIA_LABELS,
  type CriteriaType,
} from "@/lib/achievements-api";
import { useUserActivityFeed } from "@/lib/activity-feed-api";
import {
  useFriendsCount,
  useFriendshipWith,
  useSendFriendRequest,
  useRespondToFriendRequest,
  useRemoveFriendship,
  useFriendFavorites,
  useToggleFavorite,
  useBlockedUsers,
  useBlockUser,
  useUnblockUser,
  useFriendLists,
  useFriendListMembers,
  useToggleListMember,
  useUserFriendProfiles,
  useInviteStats,
} from "@/lib/friends-api";
import { useUserVisitedPlaces, useUserFavoritePlaces } from "@/lib/visits-api";
import { useUser } from "@/lib/use-auth";
import { usePlaces, usePlaceRatingsMap } from "@/lib/places-api";
import { UserAvatar } from "@/components/UserAvatar";
import { PlaceListGrid } from "@/components/VisitStatus";
import { CollapsiblePlaceList } from "@/components/CollapsiblePlaceList";
import { runWithToast } from "@/components/AsyncState";
import { RankBadge } from "@/components/RankBadge";
import { LevelProgressCard, levelInfo } from "@/components/LevelProgress";
import { VipBadge, isVipActive, vipNameStyle } from "@/components/VipBadge";
import { Skeleton } from "@/components/ui/skeleton";

function relativeTimePl(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "przed chwilą";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d. temu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mies. temu`;
  return `${Math.floor(mo / 12)} r. temu`;
}

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => {
    const title = `@${params.username} - profil foodie | poŻeramy`;
    const description = `Profil @${params.username} na poŻeramy - recenzje restauracji, ulubione miejscówki, achievementy i punkty PoŻarcia z Poznania.`;
    const url = `https://pozeramy.live/u/${params.username}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "profile" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PublicProfile,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main id="main-content" className="min-h-dvh grid place-items-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Nie udało się załadować profilu.</p>
          <p className="text-xs text-muted-foreground/70 mb-4">{error.message}</p>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="chip bg-tomato text-cream"
          >
            Spróbuj ponownie
          </button>
        </div>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="text-center">
        <h1 className="font-display text-3xl mb-2">Nie ma takiego profilu</h1>
        <Link to="/" className="text-tomato underline">
          Wróć do strony głównej
        </Link>
      </div>
    </main>
  ),
});

function PublicProfile() {
  const { username } = Route.useParams();
  const { data: profile, isLoading } = useProfileByUsername(username);
  const { user: me } = useUser();
  const { data: ranks } = useUserRanks(profile?.id);
  const { data: stats } = useUserReviewStats(profile?.id);
  const { data: reviews, isLoading: isReviewsLoading } = useUserReviews(profile?.id);
  const { data: achievements } = useAchievements();
  const { data: unlocked } = useUserAchievements(profile?.id);
  const { data: friendsCount } = useFriendsCount(profile?.id);
  const { data: visitedList } = useUserVisitedPlaces(profile?.id, "visited");
  const visitedCount = visitedList?.length ?? 0;
  const { data: inviteStats } = useInviteStats();
  const { data: ownedPlaces } = usePlacesOwnedByUser(profile?.id);
  const updateProfile = useUpdateProfile();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarFile(file: File) {
    if (!me) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Plik za duży (max 5 MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("To nie jest obrazek");
      return;
    }
    setAvatarUploading(true);
    try {
      const path = await uploadAvatar(me.id, file);
      await updateProfile.mutateAsync({ avatar_url: path, avatar_source: "upload" });
      toast.success("Zdjęcie zaktualizowane");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd uploadu");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    if (!me) return;
    if (!confirm("Usunąć zdjęcie profilowe?")) return;
    setAvatarUploading(true);
    try {
      await updateProfile.mutateAsync({ avatar_url: null, avatar_source: "initials" });
      toast.success("Zdjęcie usunięte");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd");
    } finally {
      setAvatarUploading(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <Loader2 className="animate-spin" />
      </main>
    );
  }
  if (!profile) throw notFound();

  const isMe = me?.id === profile.id;
  const joinedDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000),
  );

  return (
    <main className="min-h-dvh bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-terrazzo-navy text-cream rounded-b-[2rem] sm:rounded-b-[2.5rem] shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 15% 0%, hsl(var(--tomato) / 0.18), transparent 60%), radial-gradient(50% 50% at 100% 100%, hsl(var(--cream) / 0.08), transparent 60%)",
          }}
        />
        <div
          aria-hidden="true"
          className="blob pointer-events-none absolute -right-16 -top-20 h-64 w-64 bg-tomato/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="blob pointer-events-none absolute -left-20 bottom-0 h-56 w-56 bg-blush/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/15 to-transparent"
        />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-6 flex flex-wrap items-center gap-2">
          <BackButton to="/" />
          {me && <BackButton to="/friends" label="Znajomi" icon={Users} />}
        </div>
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-14 pt-6 flex flex-col sm:flex-row gap-6 sm:gap-8 items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="relative shrink-0">
            <div
              aria-hidden="true"
              className="absolute -inset-2 rounded-full bg-gradient-to-br from-tomato/40 via-blush/25 to-transparent blur-md"
            />
            <UserAvatar
              avatarUrl={profile.avatar_url}
              avatarSource={profile.avatar_source}
              displayName={profile.display_name}
              username={profile.username}
              size={112}
              level={levelInfo(profile.points_total ?? 0).level}
              gender={profile.gender}
              className="relative border-4 border-cream/25 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)] transition-transform duration-500 hover:scale-[1.03]"
            />
            {isMe && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  aria-label="Zmień zdjęcie profilowe"
                  title="Zmień zdjęcie profilowe"
                  className="pz-hit absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-navy/80 text-cream border-2 border-cream/30 backdrop-blur-sm transition hover:bg-navy disabled:opacity-70"
                >
                  {avatarUploading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Camera size={15} />
                  )}
                </button>
                {profile.avatar_url && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarUploading}
                    aria-label="Usuń zdjęcie profilowe"
                    title="Usuń zdjęcie profilowe"
                    className="pz-hit absolute bottom-0 left-0 grid h-9 w-9 place-items-center rounded-full bg-navy/80 text-cream border-2 border-cream/30 backdrop-blur-sm transition hover:bg-destructive disabled:opacity-70"
                  >
                    <X size={15} />
                  </button>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleAvatarFile(f);
                  }}
                />
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight flex flex-wrap items-center gap-2.5">
              <span style={vipNameStyle(profile)}>
                {profile.display_name || `@${profile.username}`}
              </span>
              {isVipActive(profile) && <VipBadge size="md" />}
            </h1>
            <p className="text-cream/70 text-sm mt-1.5">@{profile.username}</p>
            {(ranks ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(ranks ?? []).map((r) => (
                  <RankBadge key={r.id} rank={r} />
                ))}
              </div>
            )}
            {(ownedPlaces ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(ownedPlaces ?? []).map((o) =>
                  o.place ? (
                    <Link
                      key={o.id}
                      to="/k/$id"
                      params={{ id: o.place.slug ?? o.place.id }}
                      className="chip bg-tomato/20 text-cream hover:bg-tomato/30 transition-colors duration-200"
                    >
                      <Store size={12} /> Właściciel {o.place.name}
                    </Link>
                  ) : null,
                )}
              </div>
            )}
            {profile.district && (
              <p className="text-cream/80 text-sm mt-3 flex items-center gap-1.5">
                <MapPin size={14} /> {profile.district}, Poznań
              </p>
            )}
            {profile.bio && (
              <div className="mt-5 rounded-2xl border border-cream/15 bg-cream/[0.06] px-4 py-3">
                <p className="text-cream/90 leading-relaxed max-w-prose">{profile.bio}</p>
              </div>
            )}
            {profile.favorite_cuisines.length > 0 && (
              <div className="mt-3 rounded-2xl border border-cream/15 bg-cream/[0.06] px-4 py-3 flex flex-wrap gap-2">
                {profile.favorite_cuisines.map((c) => (
                  <span key={c} className="chip bg-cream/15 text-cream">
                    {c}
                  </span>
                ))}
              </div>
            )}
            <ProfileSocialsZone profile={profile} />
            {!isMe && (
              <div className="mt-4">
                {me ? (
                  <FriendActions otherUserId={profile.id} otherUsername={profile.username} />
                ) : (
                  <Link
                    to="/auth"
                    className="chip bg-cream/15 text-cream hover:bg-cream/25 transition-colors duration-200"
                  >
                    <UserPlus size={12} /> Zaloguj się, by zaprosić
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="relative z-10 -mt-8 sm:-mt-10 mx-auto max-w-3xl px-4 sm:px-6 pb-10 sm:pb-12 animate-in fade-in duration-500">
        <LevelProgressCard
          points={profile.points_total ?? 0}
          unlockedCount={(unlocked ?? []).length}
          totalBadges={(achievements ?? []).filter((a) => a.enabled).length}
          className="mb-4"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Punkty PoŻarcia" value={profile.points_total} accent="text-tomato" />
          <StatCard label="Recenzje" value={stats?.reviewsCount ?? 0} />
          <StatCard label="Odwiedzone lokale" value={visitedCount} />
          <StatCard label="Znajomi" value={friendsCount ?? 0} />
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Z nami od {joinedDays} {joinedDays === 1 ? "dnia" : "dni"}.
        </p>
      </div>

      {/* Achievements */}
      <AchievementsSection
        isMe={isMe}
        achievements={(achievements ?? []).filter((a) => a.enabled)}
        unlockedIds={new Set((unlocked ?? []).map((u) => u.achievement_id))}
        unlockedAt={new Map((unlocked ?? []).map((u) => [u.achievement_id, u.unlocked_at]))}
        userStats={{
          reviews_count: stats?.reviewsCount ?? 0,
          unique_places: stats?.uniquePlaces ?? 0,
          points_total: profile.points_total ?? 0,
          friends_count: friendsCount ?? 0,
          // Only the profile owner's own referral count is knowable client-side
          // (useInviteStats reads the current session, not an arbitrary profile).
          referrals_count: isMe ? (inviteStats?.accepted ?? 0) : 0,
        }}
      />

      {/* Place lists */}
      <PlaceLists userId={profile.id} isMe={isMe} cuisines={profile.favorite_cuisines ?? []} />

      {/* Reviews */}
      <section id="recenzje" className="mx-auto max-w-3xl px-4 sm:px-6 pb-16 sm:pb-20">
        <h2 className="font-display text-2xl sm:text-3xl mb-5 flex items-center gap-2.5 tracking-tight">
          <Star size={20} className="text-tomato" /> Ostatnie recenzje
        </h2>
        {isReviewsLoading ? (
          <ReviewsSkeleton />
        ) : (reviews ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {isMe
              ? "Nie dodałeś jeszcze żadnej recenzji. Wejdź na profil lokalu i podziel się opinią."
              : "Brak recenzji."}
          </div>
        ) : (
          <ul className="space-y-3">
            {(reviews ?? []).map((r) => (
              <ReviewListItem key={r.id} review={r} />
            ))}
          </ul>
        )}
      </section>

      {/* Friends list */}
      <FriendsList userId={profile.id} count={friendsCount ?? 0} />

      {/* Recent activity - last, it's the least "decisional" section (nobody
          browses a profile primarily to see a log of visits) */}
      <ActivityFeedSection userId={profile.id} isMe={isMe} />
    </main>
  );
}

function FriendsList({ userId, count }: { userId: string; count: number }) {
  const { data, isLoading } = useUserFriendProfiles(userId);
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-20">
      <h2 className="font-display text-2xl sm:text-3xl mb-5 flex items-center gap-2.5 tracking-tight">
        <Users size={20} className="text-tomato" /> Znajomi ({count})
      </h2>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Brak znajomych.
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {(data ?? []).map((f) => (
            <li key={f.id}>
              <Link
                to="/u/$username"
                params={{ username: f.username ?? f.id }}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 hover:border-tomato hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
              >
                <UserAvatar
                  avatarUrl={f.avatar_url}
                  avatarSource={f.avatar_source}
                  displayName={f.display_name}
                  username={f.username}
                  size={40}
                  className="group-hover:ring-2 group-hover:ring-tomato/50 transition-all duration-300"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-sm font-semibold truncate" style={vipNameStyle(f)}>
                      {f.display_name || (f.username ? `@${f.username}` : "Użytkownik")}
                    </span>
                    {isVipActive(f) && <VipBadge />}
                  </div>
                  {f.username && f.display_name && (
                    <div className="text-xs text-muted-foreground truncate">@{f.username}</div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="group rounded-2xl bg-card border border-border p-4 sm:p-5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-tomato/40 hover:shadow-md">
      <div
        className={`font-display text-3xl sm:text-4xl leading-none transition-transform duration-300 group-hover:scale-[1.04] ${accent ?? "text-foreground"}`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
    </div>
  );
}

function PlaceLists({
  userId,
  isMe,
  cuisines,
}: {
  userId: string;
  isMe: boolean;
  cuisines: string[];
}) {
  const want = useUserVisitedPlaces(userId, "want");
  const visited = useUserVisitedPlaces(userId, "visited");
  const favorites = useUserFavoritePlaces(userId);
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-16 sm:pb-20 space-y-10 sm:space-y-12">
      <CollapsiblePlaceList
        icon={<Bookmark size={20} className="text-amber-500" />}
        title="Chcę odwiedzić"
        places={want.data}
        loading={want.isLoading}
        emptyText={
          isMe
            ? "Zapisuj knajpy, do których chcesz się wybrać - pojawią się tutaj."
            : "Brak lokali na liście."
        }
        variant="icons"
        isMe={isMe}
        emptyIcon={<Bookmark size={24} className="text-amber-500" />}
        emptyTitle="Chcę odwiedzić"
        emptyTip={
          isMe
            ? "Zapisuj knajpy, do których chcesz się wybrać - pojawią się tutaj."
            : "Brak lokali na liście."
        }
        emptyCta={{ to: "/", label: "Przeglądaj lokale" }}
      />
      <CollapsiblePlaceList
        icon={<CheckCircle2 size={20} className="text-emerald-600" />}
        title="Odwiedzone"
        places={visited.data}
        loading={visited.isLoading}
        emptyText={
          isMe
            ? "Oznaczaj lokale, w których byłeś - zbierzesz tu swoją mapę PoŻerania."
            : "Brak odwiedzonych lokali."
        }
        variant="icons"
        isMe={isMe}
        emptyIcon={<CheckCircle2 size={24} className="text-emerald-600" />}
        emptyTitle="Odwiedzone"
        emptyTip={
          isMe
            ? "Oznaczaj lokale, w których byłeś - zbierzesz tu swoją mapę PoŻerania."
            : "Brak odwiedzonych lokali."
        }
        emptyCta={{ to: "/", label: "Przeglądaj lokale" }}
      />
      <CollapsiblePlaceList
        icon={<Heart size={20} className="text-tomato fill-tomato" />}
        title="Ulubione"
        places={favorites.data}
        loading={favorites.isLoading}
        emptyText={
          isMe ? "Klikaj serduszko na knajpie, do której chcesz wracać." : "Brak ulubionych lokali."
        }
        variant="icons"
        isMe={isMe}
        emptyIcon={<Heart size={24} className="text-tomato fill-tomato" />}
        emptyTitle="Ulubione"
        emptyTip={
          isMe ? "Klikaj serduszko na knajpie, do której chcesz wracać." : "Brak ulubionych lokali."
        }
        emptyCta={{ to: "/", label: "Przeglądaj lokale" }}
      />
      <RecommendedForCuisines cuisines={cuisines} />
    </section>
  );
}

function RecommendedForCuisines({ cuisines }: { cuisines: string[] }) {
  const { data: places } = usePlaces();
  const { data: ratings } = usePlaceRatingsMap();
  if (!cuisines.length || !places?.length) return null;
  const primary = cuisines[0];
  const recs = places
    .filter((p) => p.cuisine === primary)
    .sort((a, b) => (ratings?.get(b.id)?.avg ?? 0) - (ratings?.get(a.id)?.avg ?? 0))
    .slice(0, 3);
  if (!recs.length) return null;
  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl mb-2 flex items-center gap-2.5 tracking-tight">
        <Sparkles size={20} className="text-tomato" /> Polecane dla Ciebie · {primary}
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Top 3 knajpy pasujące do ulubionych kuchni.
      </p>
      <PlaceListGrid places={recs} emptyText="" />
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="rounded-2xl bg-card border border-border p-4 flex gap-4">
          <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Skeleton key={s} className="w-3 h-3 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            <Skeleton className="h-2.5 w-20" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReviewListItem({ review }: { review: any }) {
  const { data: photoUrl } = useReviewPhotoUrl(review.photo_url);
  return (
    <li className="group rounded-2xl bg-card border border-border p-4 sm:p-5 flex gap-4 transition-all duration-300 hover:border-tomato/40 hover:shadow-md hover:-translate-y-0.5">
      {photoUrl && (
        <img
          src={photoUrl}
          alt=""
          className="w-20 h-20 rounded-xl object-cover shrink-0 transition-transform duration-500 group-hover:scale-[1.03]"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center gap-0.5 text-tomato">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} />
            ))}
          </div>
          {review.place && (
            <Link
              to="/k/$id"
              params={{ id: review.place.slug ?? review.place.id }}
              className="text-sm font-semibold hover:text-tomato truncate"
            >
              {review.place.name}
            </Link>
          )}
        </div>
        {review.body && <p className="text-sm text-muted-foreground line-clamp-3">{review.body}</p>}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
          <span>{new Date(review.created_at).toLocaleDateString("pl-PL")}</span>
          {review.updated_at &&
            new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() >
              60_000 && (
              <span
                className="chip bg-cream border border-navy/20 text-navy/70 text-[10px] normal-case tracking-normal"
                title={new Date(review.updated_at).toLocaleString("pl-PL")}
              >
                edytowano · {relativeTimePl(review.updated_at)}
              </span>
            )}
        </div>
      </div>
    </li>
  );
}

function FriendActions({
  otherUserId,
  otherUsername,
}: {
  otherUserId: string;
  otherUsername: string | null;
}) {
  const blockedQ = useBlockedUsers();
  const isBlocked = (blockedQ.data ?? []).some((b) => b.id === otherUserId);
  const block = useBlockUser();
  const unblock = useUnblockUser();

  if (blockedQ.isLoading) {
    return (
      <div className="flex items-center gap-2 text-cream/70 text-xs">
        <Loader2 size={12} className="animate-spin" /> Ładowanie statusu…
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="flex flex-wrap gap-2">
        <span className="chip bg-destructive/20 text-cream">
          <ShieldOff size={12} /> Zablokowany
        </span>
        <button
          disabled={unblock.isPending}
          onClick={() =>
            runWithToast(() => unblock.mutateAsync(otherUserId), {
              success: "Odblokowano użytkownika",
              error: "Nie udało się odblokować",
            })
          }
          className="chip bg-cream/15 text-cream hover:bg-cream/25 disabled:opacity-50"
        >
          {unblock.isPending && <Loader2 size={12} className="animate-spin" />}
          Odblokuj
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <FriendButton otherUserId={otherUserId} otherUsername={otherUsername} />
      <button
        type="button"
        disabled={block.isPending}
        onClick={() => {
          if (!confirm("Zablokować tego użytkownika? Znajomość zostanie usunięta.")) return;
          runWithToast(() => block.mutateAsync(otherUserId), {
            loading: "Blokowanie…",
            success: "Zablokowano użytkownika",
            error: "Nie udało się zablokować",
          });
        }}
        className="chip bg-cream/15 text-cream hover:bg-destructive/30 disabled:opacity-50"
        title="Zablokuj"
      >
        {block.isPending ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}{" "}
        Zablokuj
      </button>
    </div>
  );
}

function FriendButton({
  otherUserId,
  otherUsername,
}: {
  otherUserId: string;
  otherUsername: string | null;
}) {
  const { user } = useUser();
  const { data: friendship, isLoading } = useFriendshipWith(otherUserId);
  const { data: favorites } = useFriendFavorites();
  const toggleFav = useToggleFavorite();
  const send = useSendFriendRequest();
  const respond = useRespondToFriendRequest();
  const remove = useRemoveFriendship();
  const [openLists, setOpenLists] = useState(false);
  const isFav = favorites?.has(otherUserId) ?? false;

  if (isLoading) {
    return (
      <span className="chip bg-cream/10 text-cream/70">
        <Loader2 size={12} className="animate-spin" /> Ładowanie…
      </span>
    );
  }

  if (!friendship) {
    return (
      <button
        disabled={send.isPending}
        onClick={() =>
          runWithToast(() => send.mutateAsync(otherUserId), {
            success: "Zaproszenie wysłane",
            error: "Nie udało się wysłać zaproszenia",
          })
        }
        className="chip bg-tomato text-cream hover:bg-tomato/90 disabled:opacity-50"
      >
        {send.isPending ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}{" "}
        Dodaj do znajomych
      </button>
    );
  }
  if (friendship.status === "accepted") {
    return (
      <>
        <button
          disabled={remove.isPending}
          onClick={() => {
            if (!confirm("Usunąć z grona znajomych?")) return;
            runWithToast(() => remove.mutateAsync(friendship.id), {
              success: "Usunięto znajomego",
              error: "Nie udało się usunąć",
            });
          }}
          className="chip bg-cream/15 text-cream hover:bg-cream/25 disabled:opacity-50"
          title="Usuń z grona znajomych"
        >
          {remove.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <UserCheck size={12} />
          )}{" "}
          Jesteście znajomymi
        </button>
        <button
          type="button"
          title={isFav ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
          disabled={toggleFav.isPending}
          onClick={() =>
            runWithToast(() => toggleFav.mutateAsync({ friendId: otherUserId, on: !isFav }), {
              error: isFav
                ? "Nie udało się usunąć z ulubionych"
                : "Nie udało się dodać do ulubionych",
            })
          }
          className={`chip disabled:opacity-50 ${isFav ? "bg-yellow-400/20 text-yellow-300" : "bg-cream/15 text-cream hover:bg-cream/25"}`}
        >
          <Star size={12} fill={isFav ? "currentColor" : "none"} />
          {isFav ? "Ulubiony" : "Ulubione"}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenLists((v) => !v)}
            className="chip bg-cream/15 text-cream hover:bg-cream/25"
          >
            <Folder size={12} /> Grupy
          </button>
          {openLists && (
            <FriendListsPopover friendId={otherUserId} onClose={() => setOpenLists(false)} />
          )}
        </div>
      </>
    );
  }
  // pending
  if (friendship.requester_id === user?.id) {
    return (
      <>
        <span className="chip bg-cream/10 text-cream/70">
          <Clock size={12} /> Zaproszenie wysłane
        </span>
        <button
          disabled={remove.isPending}
          onClick={() => {
            if (!confirm("Cofnąć wysłane zaproszenie?")) return;
            runWithToast(() => remove.mutateAsync(friendship.id), {
              success: "Cofnięto zaproszenie",
              error: "Nie udało się cofnąć zaproszenia",
            });
          }}
          className="chip bg-cream/15 text-cream hover:bg-cream/25 disabled:opacity-50"
        >
          {remove.isPending && <Loader2 size={12} className="animate-spin" />}
          Anuluj
        </button>
      </>
    );
  }
  // incoming pending
  void otherUsername;
  return (
    <>
      <button
        disabled={respond.isPending}
        onClick={() =>
          runWithToast(() => respond.mutateAsync({ id: friendship.id, accept: true }), {
            success: "Dodano do znajomych",
            error: "Nie udało się zaakceptować",
          })
        }
        className="chip bg-tomato text-cream hover:bg-tomato/90 disabled:opacity-50"
      >
        {respond.isPending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <UserCheck size={12} />
        )}{" "}
        Akceptuj zaproszenie
      </button>
      <button
        disabled={respond.isPending}
        onClick={() =>
          runWithToast(() => respond.mutateAsync({ id: friendship.id, accept: false }), {
            success: "Zaproszenie odrzucone",
            error: "Nie udało się odrzucić",
          })
        }
        className="chip bg-cream/10 text-cream/80 hover:bg-cream/20 disabled:opacity-50"
      >
        Odrzuć
      </button>
    </>
  );
}

function FriendListsPopover({ friendId, onClose }: { friendId: string; onClose: () => void }) {
  const { data: lists } = useFriendLists();
  return (
    <div
      className="absolute z-30 mt-2 right-0 w-64 bg-card border border-border rounded-2xl shadow-xl p-3 text-foreground"
      onMouseLeave={onClose}
    >
      <div className="text-xs font-semibold mb-2">Dodaj do grup</div>
      {(lists ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Nie masz grup.{" "}
          <Link to="/friends" search={{ tab: "groups" as const }} className="text-tomato underline">
            Utwórz
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {(lists ?? []).map((l) => (
            <ListToggleRow
              key={l.id}
              listId={l.id}
              name={l.name}
              color={l.color}
              friendId={friendId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListToggleRow({
  listId,
  name,
  color,
  friendId,
}: {
  listId: string;
  name: string;
  color: string | null;
  friendId: string;
}) {
  const { data: members } = useFriendListMembers(listId);
  const toggle = useToggleListMember();
  const on = members?.has(friendId) ?? false;
  return (
    <button
      type="button"
      disabled={toggle.isPending}
      onClick={() =>
        runWithToast(() => toggle.mutateAsync({ listId, friendId, on: !on }), {
          error: on ? "Nie udało się usunąć z grupy" : "Nie udało się dodać do grupy",
        })
      }
      className={`min-h-11 flex items-center gap-2 text-left rounded-lg px-2 py-1.5 text-xs border disabled:opacity-50 ${
        on
          ? "bg-tomato/10 border-tomato text-tomato"
          : "bg-background border-border hover:border-tomato"
      }`}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color || "#888" }} />
      <span className="flex-1">{name}</span>
      {on && <Check size={12} />}
    </button>
  );
}

function ProfileSocialsZone({
  profile,
}: {
  profile: {
    instagram_url: string | null;
    tiktok_url: string | null;
    youtube_url: string | null;
    facebook_url: string | null;
    x_url: string | null;
  };
}) {
  const links: { url: string | null; label: string; icon: React.ReactNode }[] = [
    { url: profile.instagram_url, label: "Instagram", icon: <Instagram size={14} /> },
    { url: profile.tiktok_url, label: "TikTok", icon: <Music2 size={14} /> },
    { url: profile.youtube_url, label: "YouTube", icon: <Youtube size={14} /> },
    { url: profile.facebook_url, label: "Facebook", icon: <Facebook size={14} /> },
    { url: profile.x_url, label: "X", icon: <Twitter size={14} /> },
  ];
  const active = links.filter((l) => !!l.url);
  if (active.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {active.map((l) => (
        <a
          key={l.label}
          href={l.url!}
          target="_blank"
          rel="noreferrer"
          aria-label={l.label}
          title={l.label}
          className="grid h-8 w-8 place-items-center rounded-full border border-cream/15 bg-cream/[0.06] text-cream/80 transition-colors hover:bg-cream/15 hover:text-cream"
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}

function AchievementsSection({
  isMe,
  achievements,
  unlockedIds,
  unlockedAt,
  userStats,
}: {
  isMe: boolean;
  achievements: import("@/lib/achievements-api").Achievement[];
  unlockedIds: Set<string>;
  unlockedAt: Map<string, string>;
  userStats: Record<CriteriaType, number>;
}) {
  const [showLocked, setShowLocked] = useState(false);
  const [showAllGot, setShowAllGot] = useState(false);
  const panelId = "achievements-locked-panel";
  const gotPanelId = "achievements-got-panel";
  // Stable ordering: unlocked → sorted by unlocked_at ASC (oldest first),
  // tiebreak by sort_order via original array index for determinism.
  const originalIndex = new Map(achievements.map((a, i) => [a.id, i] as const));
  const got = achievements
    .filter((a) => unlockedIds.has(a.id))
    .slice()
    .sort((a, b) => {
      const ta = unlockedAt.get(a.id) ?? "";
      const tb = unlockedAt.get(b.id) ?? "";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
    });
  const locked = achievements.filter((a) => !unlockedIds.has(a.id));
  const GOT_PREVIEW = 5;
  const gotVisible = showAllGot ? got : got.slice(0, GOT_PREVIEW);
  const gotHidden = Math.max(0, got.length - GOT_PREVIEW);

  return (
    <section
      className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-16"
      aria-labelledby="achievements-heading"
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="achievements-heading"
          className="font-display text-2xl sm:text-3xl flex items-center gap-2.5 tracking-tight"
        >
          <Trophy size={20} className="text-tomato" aria-hidden="true" /> Achievementy
          <span className="text-sm text-muted-foreground font-sans" aria-live="polite">
            ({got.length}/{achievements.length})
          </span>
        </h2>
        {isMe && (
          <Link
            to="/osiagniecia"
            className="pz-hit inline-flex items-center text-xs font-semibold text-tomato hover:underline"
          >
            Przeglądaj i szukaj wszystkich →
          </Link>
        )}
      </div>

      {achievements.length === 0 ? (
        <div className="text-sm text-muted-foreground">Brak zdefiniowanych achievementów.</div>
      ) : got.length === 0 ? (
        <div className="text-sm text-muted-foreground">Brak zdobytych achievementów.</div>
      ) : (
        <div className="relative">
          <ul
            id={gotPanelId}
            role="list"
            aria-label={`Zdobyte achievementy (${got.length})`}
            className={`grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 ${
              showAllGot
                ? "overflow-y-auto overscroll-contain pr-1 max-h-[clamp(420px,66vh,640px)]"
                : ""
            }`}
          >
            {gotVisible.map((a) => (
              <AchievementTile
                key={a.id}
                a={a}
                got
                progress={null}
                unlockedAt={unlockedAt.get(a.id) ?? null}
              />
            ))}
          </ul>
          {gotHidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAllGot((v) => !v)}
              aria-expanded={showAllGot}
              aria-controls={gotPanelId}
              className="mt-3 chip bg-card border border-border hover:border-tomato hover:text-tomato text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {showAllGot ? "Pokaż mniej" : `Zobacz więcej (${gotHidden})`}
            </button>
          )}
          {showAllGot && got.length > 15 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-10 h-8 bg-gradient-to-t from-background to-transparent rounded-b-2xl" />
          )}
        </div>
      )}

      {locked.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowLocked((v) => !v)}
            aria-expanded={showLocked}
            aria-controls={panelId}
            className="chip bg-card border border-border hover:border-tomato hover:text-tomato text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {showLocked ? "Ukryj zablokowane" : `Pokaż, które możesz zdobyć (${locked.length})`}
          </button>
          <div
            id={panelId}
            role="region"
            aria-label="Achievementy do zdobycia"
            aria-hidden={!showLocked}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              showLocked ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {locked.map((a) => (
                  <AchievementTile
                    key={a.id}
                    a={a}
                    got={false}
                    progress={computeProgress(a, userStats)}
                    unlockedAt={null}
                  />
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AchievementTile({
  a,
  got,
  progress,
  unlockedAt,
}: {
  a: import("@/lib/achievements-api").Achievement;
  got: boolean;
  progress: ReturnType<typeof computeProgress> | null;
  unlockedAt: string | null;
}) {
  if (got || !progress || progress.threshold <= 0) {
    const dateLabel = unlockedAt
      ? new Date(unlockedAt).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    const label = got
      ? `Zdobyto: ${a.name}${a.description ? ` - ${a.description}` : ""}${dateLabel ? ` · ${dateLabel}` : ""}`
      : `Zablokowany: ${a.name}${a.description ? ` - ${a.description}` : ""}`;
    return (
      <li
        tabIndex={0}
        aria-label={label}
        title={label}
        className={`aspect-square rounded-2xl border flex flex-col items-center justify-center text-center p-2 transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-tomato focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          got
            ? "bg-card border-tomato/40 shadow-sm hover:shadow-md hover:border-tomato"
            : "bg-muted/30 border-dashed border-border opacity-50 grayscale"
        }`}
      >
        <div className="text-2xl mb-1" aria-hidden="true">
          {a.icon_url?.startsWith("http") ? (
            <img src={a.icon_url} alt="" className="w-6 h-6" />
          ) : (
            (a.icon_url ?? "🏅")
          )}
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-wider leading-tight">
          {a.name}
        </div>
      </li>
    );
  }

  const meta = progress.type ? CRITERIA_LABELS[progress.type] : null;
  const hint =
    meta && progress.remaining > 0
      ? `${meta.verb} jeszcze ${progress.remaining} ${meta.unit}`
      : (a.description ?? "Wymagania nieokreślone");
  const label = `${a.name}${a.description ? ` - ${a.description}` : ""} · postęp ${progress.pct}% (${progress.current} z ${progress.threshold || "?"})`;

  return (
    <li
      tabIndex={0}
      aria-label={label}
      className="rounded-2xl border border-dashed border-border bg-muted/30 p-3 flex gap-3 items-start focus:outline-none focus-visible:ring-2 focus-visible:ring-tomato focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="text-3xl shrink-0 opacity-60 grayscale" aria-hidden="true">
        {a.icon_url?.startsWith("http") ? (
          <img src={a.icon_url} alt="" className="w-8 h-8" />
        ) : (
          (a.icon_url ?? "🏅")
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider leading-tight truncate">
          {a.name}
        </div>
        {a.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
        )}
        <div className="mt-2">
          <div
            className="h-1.5 rounded-full bg-border overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.pct}
            aria-label={`Postęp: ${progress.pct}%`}
          >
            <div
              className="h-full bg-tomato transition-[width] duration-500"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div
            className="mt-1 flex items-center justify-between gap-2 text-[10px]"
            aria-hidden="true"
          >
            <span className="text-muted-foreground">
              {progress.current}/{progress.threshold || "?"}
            </span>
            <span className="font-semibold text-tomato">{progress.pct}%</span>
          </div>
          <p className="text-[11px] text-foreground/80 mt-1.5 leading-snug">{hint}</p>
        </div>
      </div>
    </li>
  );
}

function ActivityFeedSection({ userId, isMe }: { userId: string; isMe: boolean }) {
  const { data, isLoading } = useUserActivityFeed(userId, 3);
  const events = data ?? [];

  const verb = (t: "visited" | "favorited" | "reviewed") =>
    t === "visited"
      ? isMe
        ? "Odwiedziłeś"
        : "Odwiedził(a)"
      : t === "favorited"
        ? isMe
          ? "Dodałeś do ulubionych"
          : "Dodał(a) do ulubionych"
        : isMe
          ? "Napisałeś opinię w"
          : "Napisał(a) opinię w";

  const icon = (t: "visited" | "favorited" | "reviewed") =>
    t === "visited" ? (
      <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
    ) : t === "favorited" ? (
      <Heart size={16} className="text-tomato fill-tomato" aria-hidden="true" />
    ) : (
      <Star size={16} className="text-amber-500" aria-hidden="true" />
    );

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-16">
      <h2 className="font-display text-2xl sm:text-3xl mb-5 flex items-center gap-2.5 tracking-tight">
        <Clock size={20} className="text-tomato" aria-hidden="true" /> Ostatnia aktywność
      </h2>
      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Brak aktywności jeszcze
        </div>
      ) : (
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                to="/k/$id"
                params={{ id: e.placeSlug }}
                className="flex items-center gap-3 px-3.5 py-3 hover:bg-muted/40 transition-colors"
              >
                <span className="shrink-0">{icon(e.type)}</span>
                <span className="min-w-0 flex-1 text-sm truncate">
                  <span className="text-muted-foreground">{verb(e.type)} </span>
                  <span className="font-semibold">{e.placeName}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTimePl(e.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
