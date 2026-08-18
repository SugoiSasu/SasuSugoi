import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, ArrowLeft, Save, Eye, EyeOff, Users as UsersIcon, Heart, Bookmark, CheckCircle2 } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import {
  useMyProfile,
  useUpdateProfile,
  uploadAvatar,
  POZNAN_DISTRICTS,
} from "@/lib/profile-api";
import { useUserRanks } from "@/lib/ranks-api";
import { useMyFriendships } from "@/lib/friends-api";
import { useMyFavoritePlaces } from "@/lib/favorites-api";
import { useUserVisitedPlaces } from "@/lib/visits-api";
import { RankBadge } from "@/components/RankBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { PlaceListGrid } from "@/components/VisitStatus";
import { CollapsiblePlaceList } from "@/components/CollapsiblePlaceList";
import { CUISINES } from "@/data/places";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mój profil — poŻeramy" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useUser();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [district, setDistrict] = useState("");
  const [favCuisines, setFavCuisines] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [xUrl, setXUrl] = useState("");

  // Hydrate the form ONCE per profile.id load so a slow profiles fetch
  // (or a post-save invalidation) does not clobber what the user is typing.
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!profile) return;
    if (hydratedFor.current === profile.id) return;
    hydratedFor.current = profile.id;
    setUsername(profile.username ?? "");
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setDistrict(profile.district ?? "");
    setFavCuisines(profile.favorite_cuisines ?? []);
    setIsPublic(profile.is_public);
    setAvatarPath(profile.avatar_url);
    setInstagramUrl(profile.instagram_url ?? "");
    setTiktokUrl(profile.tiktok_url ?? "");
    setYoutubeUrl(profile.youtube_url ?? "");
    setFacebookUrl(profile.facebook_url ?? "");
    setXUrl(profile.x_url ?? "");
  }, [profile]);

  const { data: ranks } = useUserRanks(user?.id);
  const { data: friendships } = useMyFriendships();
  const { data: favoritePlaces } = useMyFavoritePlaces();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pendingCount = (friendships ?? []).filter((f) => f.status === "pending" && f.addressee_id === user?.id).length;

  function toggleCuisine(c: string) {
    setFavCuisines((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    );
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Plik za duży (max 5 MB)");
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("To nie jest obrazek");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadAvatar(user.id, f);
      setAvatarPath(path);
      await updateProfile.mutateAsync({ avatar_url: path, avatar_source: "upload" });
      toast.success("Zdjęcie zaktualizowane");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd uploadu");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      toast.error("Nieprawidłowy nick", {
        description: "Wymagane 3-20 znaków: małe litery a-z, cyfry 0-9 i podkreślnik _.",
        duration: 6000,
      });
      return;
    }
    const tId = toast.loading("Zapisuję profil…");
    try {
      const saved = await updateProfile.mutateAsync({
        username: cleanUsername,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        district: district || null,
        favorite_cuisines: favCuisines,
        is_public: isPublic,
        instagram_url: instagramUrl.trim() || null,
        tiktok_url: tiktokUrl.trim() || null,
        youtube_url: youtubeUrl.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        x_url: xUrl.trim() || null,
      });
      toast.success("✓ Profil zapisany", {
        id: tId,
        description: `Zmiany dla @${saved.username ?? cleanUsername} są już widoczne publicznie.`,
        duration: 5000,
      });
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string; hint?: string };
      const msg = e?.message ?? "Nieznany błąd";
      let title = "Nie udało się zapisać profilu";
      let description = msg;
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("profiles_username_unique")) {
        title = "Nick zajęty";
        description = `@${cleanUsername} jest już używany przez innego użytkownika — wybierz inny.`;
      } else if (msg.includes("profiles_username_format")) {
        title = "Nieprawidłowy format nicka";
        description = "Dozwolone: 3-20 znaków, małe litery a-z, cyfry 0-9 i podkreślnik _.";
      } else if (msg.includes("profiles_bio_length")) {
        title = "Bio za długie";
        description = "Maksymalnie 500 znaków.";
      } else if (msg.includes("row-level security") || msg.includes("permission") || e?.code === "42501") {
        title = "Brak uprawnień do zapisu";
        description = "Sesja mogła wygasnąć — wyloguj się i zaloguj ponownie.";
      } else if (e?.code) {
        description = `[${e.code}] ${msg}${e.details ? ` · ${e.details}` : ""}${e.hint ? ` · ${e.hint}` : ""}`;
      }
      toast.error(title, { id: tId, description, duration: 10000 });
      // eslint-disable-next-line no-console
      console.error("[profile save]", err);
    }
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) {
    return (
      <main id="main-content" className="min-h-dvh bg-background py-6 sm:py-10 px-3 sm:px-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <Skeleton className="h-9 w-32 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>

          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-72 max-w-full mb-6" />

          <div className="space-y-6">
            {/* Avatar */}
            <section className="rounded-2xl bg-card border border-border p-5">
              <Skeleton className="h-3 w-32 mb-3" />
              <div className="flex items-center gap-4">
                <Skeleton className="w-20 h-20 rounded-full shrink-0" />
                <Skeleton className="h-9 w-36 rounded-full" />
              </div>
            </section>

            {/* Username + display name + bio + district */}
            <section className="rounded-2xl bg-card border border-border p-5 space-y-4">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </section>

            {/* Favorite cuisines */}
            <section className="rounded-2xl bg-card border border-border p-5">
              <Skeleton className="h-3 w-28 mb-3" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-20 rounded-full" />
                ))}
              </div>
            </section>

            {/* Place lists */}
            <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
              <Skeleton className="h-6 w-40" />
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background py-6 sm:py-10 px-3 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <BackButton to="/" label="Strona główna" />
          <div className="flex items-center gap-2">
            <Link to="/friends" className="chip bg-card border border-border hover:border-tomato">
              <UsersIcon size={12} /> Znajomi
              {pendingCount > 0 && (
                <span className="ml-1 inline-grid place-items-center min-w-[16px] h-[16px] px-1 rounded-full bg-tomato text-cream text-[9px] font-bold">{pendingCount}</span>
              )}
            </Link>
            <button onClick={handleSignOut} className="text-sm text-muted-foreground hover:text-tomato min-h-11 px-2">
              Wyloguj
            </button>
          </div>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl mb-2">Mój profil</h1>
        <p className="text-muted-foreground mb-4 text-sm">
          Skonfiguruj jak inni poŻeracze widzą Twój profil.
        </p>

        {ranks && ranks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {ranks.map((r) => <RankBadge key={r.id} rank={r} />)}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Avatar */}
          <section className="rounded-2xl bg-card border border-border p-5">
            <label className="block text-xs uppercase tracking-wider font-semibold mb-3">
              Zdjęcie profilowe
            </label>
            <div className="flex items-center gap-4">
              <UserAvatar
                avatarUrl={avatarPath}
                avatarSource={profile?.avatar_source}
                displayName={displayName || profile?.display_name}
                username={username || profile?.username}
                size={80}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-full bg-navy text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato transition disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Wgrywam..." : avatarPath ? "Zmień zdjęcie" : "Wgraj zdjęcie"}
                </button>
                {profile?.avatar_source === "google" && (
                  <p className="text-xs text-muted-foreground mt-2">Używasz zdjęcia z Google. Wgranie nowego zastąpi je.</p>
                )}
                {!avatarPath && (
                  <p className="text-xs text-muted-foreground mt-2">Bez zdjęcia pokazujemy inicjały na kolorowym tle.</p>
                )}
              </div>
            </div>
          </section>

          {/* Username + display name */}
          <section className="rounded-2xl bg-card border border-border p-5 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5">
                Nick (@handle) *
              </label>
              <div className="flex items-center rounded-xl border-2 border-border focus-within:border-tomato">
                <span className="pl-3 text-muted-foreground">@</span>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="np. ania_pizza"
                  className="flex-1 px-2 py-2.5 bg-transparent outline-none"
                  maxLength={20}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                3-20 znaków: małe litery, cyfry, podkreślnik.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5">
                Imię / nazwa wyświetlana
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="np. Ania K."
                className="w-full rounded-xl border-2 border-border px-4 py-2.5 outline-none focus:border-tomato"
                maxLength={80}
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Co lubisz jeść?"
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border-2 border-border px-4 py-2.5 outline-none focus:border-tomato resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">{bio.length}/500</p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5">
                Dzielnica
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full rounded-xl border-2 border-border px-4 py-2.5 outline-none focus:border-tomato bg-background"
              >
                <option value="">— wybierz —</option>
                {POZNAN_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Favorite cuisines */}
          <section className="rounded-2xl bg-card border border-border p-5">
            <label className="block text-xs uppercase tracking-wider font-semibold mb-3">
              Ulubione kuchnie
            </label>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => {
                const active = favCuisines.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCuisine(c)}
                    className={`chip transition ${
                      active
                        ? "bg-tomato text-cream"
                        : "bg-background border border-border hover:border-tomato"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Socials */}
          <section className="rounded-2xl bg-card border border-border p-5">
            <label className="block text-xs uppercase tracking-wider font-semibold mb-3">
              Moje social media
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <SocialInput label="Instagram" value={instagramUrl} onChange={setInstagramUrl} placeholder="https://instagram.com/twoj-nick" />
              <SocialInput label="TikTok" value={tiktokUrl} onChange={setTiktokUrl} placeholder="https://tiktok.com/@twoj-nick" />
              <SocialInput label="YouTube" value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://youtube.com/@twoj-kanal" />
              <SocialInput label="Facebook" value={facebookUrl} onChange={setFacebookUrl} placeholder="https://facebook.com/twoj-profil" />
              <SocialInput label="X (Twitter)" value={xUrl} onChange={setXUrl} placeholder="https://x.com/twoj-nick" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Pełne URL-e. Linki pojawią się na Twoim publicznym profilu.</p>
          </section>

          {/* Place lists */}
          <MyPlaceLists />




          {/* Privacy */}
          <section className="rounded-2xl bg-card border border-border p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2">
                  {isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
                  Profil publiczny
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isPublic
                    ? "Każdy może wyświetlić Twój profil i wall."
                    : "Tylko Twoi znajomi widzą wall i listy miejsc."}
                </p>
              </div>
            </label>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-6 py-3 font-semibold hover:scale-[1.02] transition disabled:opacity-50"
            >
              {updateProfile.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Zapisz profil
            </button>
            {profile?.username && (
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-6 py-3 font-semibold hover:border-tomato transition"
              >
                Zobacz publiczny profil
              </Link>
            )}
          </div>
          {updateProfile.isError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-2">
              {(updateProfile.error as Error).message}
            </p>
          )}
          {updateProfile.isSuccess && !updateProfile.isPending && (
            <p className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/40 rounded-xl px-4 py-2">
              ✓ Profil zapisany pomyślnie.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

function SocialInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-tomato outline-none"
      />
    </label>
  );
}

function MyPlaceLists() {
  const { user } = useUser();
  const want = useUserVisitedPlaces(user?.id, "want");
  const visited = useUserVisitedPlaces(user?.id, "visited");
  const favorites = useMyFavoritePlaces();

  return (
    <section className="rounded-2xl bg-card border border-border p-5 space-y-8">
      <CollapsiblePlaceList
        icon={<Bookmark size={20} className="text-amber-500" />}
        title="Chcę odwiedzić"
        places={want.data}
        loading={want.isLoading}
        emptyText="Zapisuj knajpy, do których chcesz się wybrać — pojawią się tutaj."
        variant="icons"
        isMe={true}
        emptyIcon={<Bookmark size={24} className="text-amber-500" />}
        emptyTitle="Chcę odwiedzić"
        emptyTip="Zapisuj knajpy, do których chcesz się wybrać — pojawią się tutaj."
        emptyCta={{ to: "/", label: "Przeglądaj lokale" }}
      />
      <CollapsiblePlaceList
        icon={<CheckCircle2 size={20} className="text-emerald-600" />}
        title="Odwiedziłem"
        places={visited.data}
        loading={visited.isLoading}
        emptyText="Oznaczaj knajpy, w których byłeś — zbierzesz tu swoją mapę PoŻerania."
        variant="icons"
        isMe={true}
        emptyIcon={<CheckCircle2 size={24} className="text-emerald-600" />}
        emptyTitle="Odwiedziłem"
        emptyTip="Oznaczaj knajpy, w których byłeś — zbierzesz tu swoją mapę PoŻerania."
        emptyCta={{ to: "/", label: "Przeglądaj lokale" }}
      />
      <CollapsiblePlaceList
        icon={<Heart size={20} className="text-tomato fill-tomato" />}
        title="Ulubione"
        places={favorites.data}
        loading={favorites.isLoading}
        emptyText="Klikaj serduszko na knajpie, do której chcesz wracać."
        variant="icons"
        isMe={true}
        emptyIcon={<Heart size={24} className="text-tomato fill-tomato" />}
        emptyTitle="Ulubione"
        emptyTip="Klikaj serduszko na knajpie, do której chcesz wracać."
        emptyCta={{ to: "/", label: "Przeglądaj lokale" }}
      />
    </section>
  );
}
