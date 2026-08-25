import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  Save,
  Eye,
  EyeOff,
  Users as UsersIcon,
  Trash2,
  TriangleAlert,
  KeyRound,
  User as UserIcon,
  ShieldCheck,
  Bell,
  Database,
  Ban,
  Download,
  MapPin,
} from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { deleteMyAccount } from "@/lib/admin-users.functions";
import {
  useMyProfile,
  useUpdateProfile,
  uploadAvatar,
  exportMyData,
  POZNAN_DISTRICTS,
  type Profile,
} from "@/lib/profile-api";
import { useUserRanks } from "@/lib/ranks-api";
import { useMyFriendships, useBlockedUsers, useUnblockUser } from "@/lib/friends-api";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications-api";
import { RankBadge } from "@/components/RankBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { CUISINES } from "@/data/places";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { isVipActive, VIP_NICK_COLORS, VipBadge } from "@/components/VipBadge";
import { TitleTag } from "@/components/TitleTag";
import { useMyTitledAchievements, useSetActiveTitle } from "@/lib/achievements-api";
import { passwordStrengthError } from "@/lib/password";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Ustawienia - poŻeramy" }] }),
  component: ProfilePage,
});

const TABS = [
  { key: "profil", label: "Profil", icon: UserIcon },
  { key: "prywatnosc", label: "Prywatność", icon: ShieldCheck },
  { key: "powiadomienia", label: "Powiadomienia", icon: Bell },
  { key: "konto", label: "Konto", icon: Database },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const NOTIF_LABELS: Record<NotificationType, { label: string; hint: string }> = {
  friend_request: { label: "Zaproszenia do znajomych", hint: "Gdy ktoś chce Cię dodać." },
  friend_accepted: { label: "Zaakceptowane zaproszenia", hint: "Gdy ktoś zaakceptuje Twoje zaproszenie." },
  place_post: { label: "Nowości w ulubionych miejscach", hint: "Gdy ulubiony lokal doda coś nowego." },
  achievement: { label: "Zdobyte odznaki", hint: "Gdy odblokujesz osiągnięcie." },
};

function ProfilePage() {
  const { user } = useUser();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabKey>("profil");

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [district, setDistrict] = useState("");
  const [favCuisines, setFavCuisines] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [gender, setGender] = useState<"M" | "K" | null>(null);
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
    setGender(profile.gender);
    setAvatarPath(profile.avatar_url);
    setInstagramUrl(profile.instagram_url ?? "");
    setTiktokUrl(profile.tiktok_url ?? "");
    setYoutubeUrl(profile.youtube_url ?? "");
    setFacebookUrl(profile.facebook_url ?? "");
    setXUrl(profile.x_url ?? "");
  }, [profile]);

  const { data: ranks } = useUserRanks(user?.id);
  const { data: friendships } = useMyFriendships();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pendingCount = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;

  function toggleCuisine(c: string) {
    setFavCuisines((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
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
        gender,
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
      if (
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        msg.includes("profiles_username_unique")
      ) {
        title = "Nick zajęty";
        description = `@${cleanUsername} jest już używany przez innego użytkownika - wybierz inny.`;
      } else if (msg.includes("profiles_username_format")) {
        title = "Nieprawidłowy format nicka";
        description = "Dozwolone: 3-20 znaków, małe litery a-z, cyfry 0-9 i podkreślnik _.";
      } else if (msg.includes("profiles_bio_length")) {
        title = "Bio za długie";
        description = "Maksymalnie 500 znaków.";
      } else if (
        msg.includes("row-level security") ||
        msg.includes("permission") ||
        e?.code === "42501"
      ) {
        title = "Brak uprawnień do zapisu";
        description = "Sesja mogła wygasnąć - wyloguj się i zaloguj ponownie.";
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
          <Skeleton className="h-11 w-full rounded-full mb-6" />
          <div className="space-y-6">
            <section className="rounded-2xl bg-card border border-border p-5">
              <Skeleton className="h-3 w-32 mb-3" />
              <div className="flex items-center gap-4">
                <Skeleton className="w-20 h-20 rounded-full shrink-0" />
                <Skeleton className="h-9 w-36 rounded-full" />
              </div>
            </section>
            <section className="rounded-2xl bg-card border border-border p-5 space-y-4">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-dvh bg-background py-6 sm:py-10 px-3 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <BackButton to="/" label="Strona główna" />
          <div className="flex items-center gap-2">
            <Link to="/friends" className="chip bg-card border border-border hover:border-tomato">
              <UsersIcon size={12} /> Znajomi
              {pendingCount > 0 && (
                <span className="ml-1 inline-grid place-items-center min-w-[16px] h-[16px] px-1 rounded-full bg-tomato text-cream text-[9px] font-bold">
                  {pendingCount}
                </span>
              )}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:text-tomato min-h-11 px-2"
            >
              Wyloguj
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <UserAvatar
            avatarUrl={avatarPath}
            avatarSource={profile?.avatar_source}
            displayName={displayName || profile?.display_name}
            username={username || profile?.username}
            gender={gender}
            size={48}
          />
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl leading-tight truncate">
              {displayName || profile?.display_name || `@${username || profile?.username}`}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              @{username || profile?.username}
            </p>
          </div>
        </div>

        {ranks && ranks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {ranks.map((r) => (
              <RankBadge key={r.id} rank={r} />
            ))}
          </div>
        )}

        {profile?.username && (
          <Link
            to="/u/$username"
            params={{ username: profile.username }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-tomato hover:underline mb-6"
          >
            Zobacz publiczny profil →
          </Link>
        )}

        <div
          role="tablist"
          className="mb-6 grid grid-cols-4 gap-1 rounded-full border border-border bg-card p-1"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center justify-center gap-1 rounded-full px-1 py-2 text-[11px] font-semibold transition sm:flex-row sm:text-xs ${
                  active
                    ? "bg-navy text-cream"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                }`}
              >
                <Icon size={14} />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        {tab === "profil" && (
          <form onSubmit={handleSave} className="pz-fade-in space-y-6">
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
                  gender={gender}
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
                    {uploading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    {uploading ? "Wgrywam..." : avatarPath ? "Zmień zdjęcie" : "Wgraj zdjęcie"}
                  </button>
                  {profile?.avatar_source === "google" && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Używasz zdjęcia z Google. Wgranie nowego zastąpi je.
                    </p>
                  )}
                  {!avatarPath && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Bez zdjęcia pokazujemy inicjały na kolorowym tle.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {profile && isVipActive(profile) && <VipNickColorSection profile={profile} />}

            {profile && <TitleSection profile={profile} userId={user?.id} />}

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
                  <option value=""> - wybierz - </option>
                  {POZNAN_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </section>

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

            <section className="rounded-2xl bg-card border border-border p-5">
              <label className="block text-xs uppercase tracking-wider font-semibold mb-3">
                Moje social media
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <SocialInput
                  label="Instagram"
                  value={instagramUrl}
                  onChange={setInstagramUrl}
                  placeholder="https://instagram.com/twoj-nick"
                />
                <SocialInput
                  label="TikTok"
                  value={tiktokUrl}
                  onChange={setTiktokUrl}
                  placeholder="https://tiktok.com/@twoj-nick"
                />
                <SocialInput
                  label="YouTube"
                  value={youtubeUrl}
                  onChange={setYoutubeUrl}
                  placeholder="https://youtube.com/@twoj-kanal"
                />
                <SocialInput
                  label="Facebook"
                  value={facebookUrl}
                  onChange={setFacebookUrl}
                  placeholder="https://facebook.com/twoj-profil"
                />
                <SocialInput
                  label="X (Twitter)"
                  value={xUrl}
                  onChange={setXUrl}
                  placeholder="https://x.com/twoj-nick"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Pełne URL-e. Linki pojawią się na Twoim publicznym profilu.
              </p>
            </section>

            <section className="rounded-2xl bg-card border border-border p-5">
              <p className="font-semibold mb-1">Domyślny awatar</p>
              <p className="text-xs text-muted-foreground mb-3">
                Dobiera kolor awatara, dopóki nie wgrasz własnego zdjęcia.
              </p>
              <div className="flex gap-2">
                {([
                  ["M", "Mężczyzna"],
                  ["K", "Kobieta"],
                  [null, "Wolę nie podawać"],
                ] as const).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setGender(value)}
                    aria-pressed={gender === value}
                    className={`flex-1 rounded-xl border-2 px-2 py-2 text-xs font-semibold transition ${
                      gender === value
                        ? "border-navy bg-navy text-cream"
                        : "border-border bg-background text-foreground hover:border-tomato"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
              <MapPin size={16} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                Listy „Chcę odwiedzić”, „Odwiedziłem” i „Ulubione” przeniosły się do Moich miejsc.
              </p>
              <Link
                to="/moje-miejsca"
                className="chip bg-navy text-cream hover:bg-tomato shrink-0"
              >
                Otwórz
              </Link>
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
            </div>
            {updateProfile.isError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-2">
                {(updateProfile.error as Error).message}
              </p>
            )}
          </form>
        )}

        {tab === "prywatnosc" && (
          <div className="pz-fade-in space-y-6">
            <section className="rounded-2xl bg-card border border-border p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={async (e) => {
                    const value = e.target.checked;
                    setIsPublic(value);
                    try {
                      await updateProfile.mutateAsync({ is_public: value });
                      toast.success(value ? "Profil jest teraz publiczny" : "Profil jest teraz prywatny");
                    } catch (err) {
                      setIsPublic(!value);
                      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać");
                    }
                  }}
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

            <ChangePasswordSection />
            <BlockedUsersSection />
          </div>
        )}

        {tab === "powiadomienia" && (
          <div className="pz-fade-in">
            <NotificationsSection profile={profile ?? null} />
          </div>
        )}

        {tab === "konto" && (
          <div className="pz-fade-in space-y-6">
            <DataExportSection />
            <DeleteAccountSection />
          </div>
        )}
      </div>
    </main>
  );
}

function SocialInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
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

function ChangePasswordSection() {
  const { user } = useUser();
  const hasPasswordLogin = user?.identities?.some((i) => i.provider === "email") ?? false;

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!hasPasswordLogin) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const strengthError = passwordStrengthError(next);
    if (strengthError) {
      setError(strengthError);
      return;
    }
    if (!user?.email) return;
    setSaving(true);
    setError(null);
    try {
      // Re-authenticate with the current password before rotating it - updateUser()
      // alone would let anyone with a hijacked, still-logged-in tab change the
      // password without ever proving they know the old one.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (reauthErr) {
        setError("Obecne hasło jest nieprawidłowe.");
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) throw updateErr;
      toast.success("Hasło zmienione ✓");
      setOpen(false);
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zmienić hasła");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={18} className="text-navy" />
        <h2 className="font-display text-lg">Hasło</h2>
      </div>
      <p className="text-sm text-muted-foreground">Zmień hasło do logowania e-mailem.</p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-navy text-navy px-4 py-2 text-sm font-semibold hover:bg-navy/5"
        >
          <KeyRound size={14} /> Zmień hasło
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2.5 max-w-sm" noValidate>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); if (error) setError(null); }}
            placeholder="Obecne hasło"
            className="w-full rounded-xl border-2 border-border px-4 py-2.5 outline-none focus:border-tomato"
          />
          <div className="relative">
            <input
              type={showNext ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => { setNext(e.target.value); if (error) setError(null); }}
              placeholder="Nowe hasło (min. 8 znaków, litera i cyfra)"
              className="w-full rounded-xl border-2 border-border px-4 py-2.5 pr-11 outline-none focus:border-tomato"
            />
            <button
              type="button"
              onClick={() => setShowNext((v) => !v)}
              aria-label={showNext ? "Ukryj hasło" : "Pokaż hasło"}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-navy hover:bg-navy/5"
            >
              {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setCurrent(""); setNext(""); setError(null); }}
              disabled={saving}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              Zapisz nowe hasło
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function BlockedUsersSection() {
  const { data: blocked, isLoading } = useBlockedUsers();
  const unblock = useUnblockUser();

  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <Ban size={18} className="text-navy" />
        <h2 className="font-display text-lg">Zablokowani</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Zablokowane osoby nie mogą Cię znaleźć ani zapraszać do znajomych.
      </p>
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : !blocked || blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nikogo nie masz zablokowanego.</p>
      ) : (
        <ul className="space-y-2">
          {blocked.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar
                  avatarUrl={p.avatar_url}
                  avatarSource={p.avatar_source}
                  displayName={p.display_name}
                  username={p.username}
                  size={32}
                />
                <span className="text-sm font-semibold truncate">
                  {p.display_name || `@${p.username}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  toast.promise(unblock.mutateAsync(p.id), {
                    loading: "Odblokowywanie…",
                    success: "Odblokowano użytkownika",
                    error: "Nie udało się odblokować",
                  })
                }
                disabled={unblock.isPending}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-tomato hover:text-tomato disabled:opacity-50"
              >
                Odblokuj
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationsSection({ profile }: { profile: Profile | null }) {
  const updateProfile = useUpdateProfile();
  const prefs = profile?.notification_prefs;

  async function toggle(type: NotificationType, value: boolean) {
    try {
      await updateProfile.mutateAsync({
        notification_prefs: { ...(prefs ?? {}), [type]: value },
      });
      toast.success(value ? "Włączono" : "Wyłączono");
    } catch (err) {
      // Supabase's PostgrestError is a plain object, not an Error instance -
      // read .message/.code directly rather than gating on `instanceof Error`.
      const e = err as { message?: string; code?: string };
      const msg = e?.message ?? "";
      // A missing column shows up as PostgREST's "unknown column" 42703 -
      // this feature ships its own migration; surface a clear message
      // instead of a raw Postgres error if it hasn't been applied yet.
      if (e?.code === "PGRST204" || msg.includes("column") || msg.includes("schema cache")) {
        toast.error("Ta funkcja jeszcze nie jest w pełni skonfigurowana po stronie bazy danych.");
      } else {
        toast.error(msg || "Nie udało się zapisać ustawienia");
      }
    }
  }

  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <Bell size={18} className="text-navy" />
        <h2 className="font-display text-lg">Powiadomienia</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Wybierz, o czym chcesz dostawać powiadomienia w dzwoneczku.
      </p>
      <ul className="space-y-1">
        {NOTIFICATION_TYPES.map((type) => {
          const enabled = prefs?.[type] ?? true;
          return (
            <li
              key={type}
              className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{NOTIF_LABELS[type].label}</p>
                <p className="text-xs text-muted-foreground">{NOTIF_LABELS[type].hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => toggle(type, !enabled)}
                disabled={updateProfile.isPending}
                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
                  enabled ? "bg-tomato" : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition ${
                    enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DataExportSection() {
  const { user } = useUser();
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!user) return;
    setBusy(true);
    try {
      const data = await exportMyData(user.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pozeramy-moje-dane-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Pobrano Twoje dane");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się pobrać danych");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <Download size={18} className="text-navy" />
        <h2 className="font-display text-lg">Eksport danych</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Pobierz plik JSON ze swoim profilem, recenzjami, ulubionymi, odwiedzonymi miejscami i
        znajomościami.
      </p>
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full border-2 border-navy text-navy px-4 py-2 text-sm font-semibold hover:bg-navy/5 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Pobierz moje dane
      </button>
    </section>
  );
}

function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const doDelete = useServerFn(deleteMyAccount);

  async function handleDelete() {
    setDeleting(true);
    try {
      await doDelete();
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("Konto usunięte. Żegnamy, było miło Cię gościć.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się usunąć konta");
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <TriangleAlert className="text-destructive shrink-0 mt-0.5" size={18} />
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg text-destructive">Usuń konto</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Trwale usuwa Twoje konto oraz wszystkie powiązane dane: recenzje, ulubione, znajomości,
            powiadomienia i punkty. Tej operacji nie można cofnąć.
          </p>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-destructive text-destructive px-4 py-2 text-sm font-semibold hover:bg-destructive/10"
            >
              <Trash2 size={14} /> Usuń konto
            </button>
          ) : (
            <div className="mt-3 space-y-2 max-w-sm">
              <label className="block text-xs font-semibold text-muted-foreground">
                Wpisz <span className="font-mono text-destructive">USUŃ</span>, żeby potwierdzić
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-lg border-2 border-destructive/40 bg-background px-3 py-2 text-sm outline-none focus:border-destructive"
                placeholder="USUŃ"
                disabled={deleting}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmText("");
                  }}
                  disabled={deleting}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={confirmText !== "USUŃ" || deleting}
                  className="inline-flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground px-4 py-2 text-sm font-semibold hover:bg-destructive/90 disabled:opacity-40"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Usuń konto na zawsze
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function VipNickColorSection({ profile }: { profile: Profile }) {
  const updateProfile = useUpdateProfile();
  const current = profile.vip_nick_color;

  async function pick(color: string | null) {
    try {
      await updateProfile.mutateAsync({ vip_nick_color: color });
      toast.success(color ? "Kolor nicku zapisany ✓" : "Kolor nicku zresetowany");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać koloru");
    }
  }

  return (
    <section className="rounded-2xl bg-card border border-amber-400/40 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <VipBadge size="md" />
        <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Kolor nicku
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Benefit VIP - wybierz kolor, w jakim Twój nick pojawia się w recenzjach, na Pożeralni i
        wszędzie indziej.
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        {VIP_NICK_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => pick(color)}
            disabled={updateProfile.isPending}
            aria-label={`Wybierz kolor ${color}`}
            aria-pressed={current === color}
            className={`w-9 h-9 rounded-full transition disabled:opacity-50 ${
              current === color ? "ring-2 ring-offset-2 ring-navy scale-110" : "hover:scale-105"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
        <button
          type="button"
          onClick={() => pick(null)}
          disabled={updateProfile.isPending || !current}
          className="ml-1 text-xs font-semibold text-muted-foreground hover:text-tomato disabled:opacity-40 disabled:hover:text-muted-foreground"
        >
          Wyczyść
        </button>
      </div>
    </section>
  );
}

/** LoL-style selectable title: pick one unlocked, "wearable" achievement to
 * display next to your name on your profile, Ranking, and Friends. Player
 * chooses - never automatic - matching the design principle this was
 * adapted from (see [[project_lol_titles_plan]]). */
function TitleSection({ profile, userId }: { profile: Profile; userId: string | undefined }) {
  const { data: titled, isLoading } = useMyTitledAchievements(userId);
  const setTitle = useSetActiveTitle();
  const current = profile.active_title_achievement_id;

  async function pick(achievementId: string | null) {
    try {
      await setTitle.mutateAsync(achievementId);
      toast.success(achievementId ? "Tytuł ustawiony ✓" : "Tytuł usunięty");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać tytułu");
    }
  }

  if (isLoading) return null;
  if (!titled || titled.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        Twój tytuł
      </label>
      <p className="text-sm text-muted-foreground">
        Wybierz tytuł do wyświetlenia przy nazwie - na profilu, w Rankingu i u Znajomych. Masz{" "}
        {titled.length} do wyboru, odblokowane za osiągnięcia.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {titled.map((t) => (
          <button
            key={t.achievement_id}
            type="button"
            onClick={() => pick(t.achievement_id)}
            disabled={setTitle.isPending}
            aria-pressed={current === t.achievement_id}
            className={`rounded-full transition disabled:opacity-50 ${
              current === t.achievement_id ? "ring-2 ring-offset-2 ring-tomato" : "hover:scale-105"
            }`}
          >
            <TitleTag title={t.title} size="md" />
          </button>
        ))}
        {current && (
          <button
            type="button"
            onClick={() => pick(null)}
            disabled={setTitle.isPending}
            className="ml-1 text-xs font-semibold text-muted-foreground hover:text-tomato disabled:opacity-40"
          >
            Wyczyść
          </button>
        )}
      </div>
    </section>
  );
}
