import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  X,
  Loader2,
  UserPlus,
  Trash2,
  Search,
  Star,
  StickyNote,
  Ban,
  Trophy,
  Users,
  Link as LinkIcon,
  Mail,
  QrCode,
  Copy,
  ShieldOff,
  Sparkles,
  Share2,
  Home,
  User as UserIcon,
  MoreVertical,
  ArrowLeft,
} from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { useMyProfile } from "@/lib/profile-api";
import {
  useMyFriendships,
  useRespondToFriendRequest,
  useRemoveFriendship,
  useFriendProfiles,
  useSendFriendRequest,
  useFriendshipWith,
  useFriendFavorites,
  useToggleFavorite,
  useFriendNote,
  useSetFriendNote,
  useBlockedUsers,
  useBlockUser,
  useUnblockUser,
  useMyInvites,
  useCreateInvite,
  useRevokeInvite,
  useFriendSuggestions,
  useInviteStats,
  type FriendProfile,
} from "@/lib/friends-api";
import { useUserSearch } from "@/lib/wall-api";
import { UserAvatar } from "@/components/UserAvatar";
import { AsyncState, runWithToast } from "@/components/AsyncState";
import { VipBadge, isVipActive, vipNameStyle } from "@/components/VipBadge";
import { VipReferralProgress } from "@/components/VipReferralProgress";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Redesigned 2026-08-25: was 6 flat tabs (incl. an unused-in-practice
// "Grupy" feature) plus THREE separate search inputs across the page
// (a global one, one inside "Znajomi", one inside "Znajdź") and the
// suggestions block rendered twice. Down to 4 tabs + one search bar that
// does double duty (finds people, shows "Znajomy"/"Wysłano" state inline).
// "Zablokowani" is real but rarely used - reachable via a small header
// link instead of taking a permanent slot in the main tab row.
//
// Update 2026-08-25: dropped the "Ranking" tab (was a standalone,
// differently-styled friends-only leaderboard living only here) in favor
// of a single shared ranking UI at /u with a Wszyscy/Znajomi scope
// toggle - see [[project_ranking_page_redesign_todo]]. This page now
// links out to it instead of duplicating it.
const TAB_KEYS = ["friends", "requests", "invite", "blocked"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const searchSchema = z.object({
  tab: z.enum(TAB_KEYS).catch("friends").default("friends"),
});

export const Route = createFileRoute("/_authenticated/friends")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Znajomi - poŻeramy" },
      { name: "description", content: "Twoi znajomi, zaproszenia i ranking w poŻeramy." },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const { user } = useUser();
  const { data: myProfile } = useMyProfile();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: blocked } = useBlockedUsers();

  const setTab = (next: TabKey) =>
    navigate({ search: (prev: { tab: TabKey }) => ({ ...prev, tab: next }), replace: true });

  if (!user) {
    return (
      <main id="main-content" className="grid place-items-center py-20">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  if (tab === "blocked") {
    return (
      <main className="min-h-dvh bg-background py-6 sm:py-8 px-3 sm:px-4">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => setTab("friends")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-tomato transition-colors mb-4"
          >
            <ArrowLeft size={16} /> Wróć do znajomych
          </button>
          <h1 className="font-display text-3xl mb-4 flex items-center gap-2">
            <ShieldOff size={26} /> Zablokowani
          </h1>
          <BlockedTab />
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-dvh bg-background py-6 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-1">Znajomi 👥</h1>
              <p className="text-muted-foreground text-sm">
                Znajdź, zaproś i śledź znajomych foodies.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Link
                to="/u"
                search={{ scope: "friends", q: "", page: 1 }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-tomato/40 bg-tomato/10 px-3 py-1.5 text-sm font-medium text-tomato hover:bg-tomato/15 transition-colors"
              >
                <Trophy size={16} /> Ranking znajomych
              </Link>
              {myProfile?.username && (
                <Link
                  to="/u/$username"
                  params={{ username: myProfile.username }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-tomato hover:text-tomato transition-colors"
                >
                  <Users size={16} /> Mój profil
                </Link>
              )}
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-tomato hover:text-tomato transition-colors"
              >
                <Home size={16} /> Strona główna
              </Link>
            </div>
          </div>
        </header>

        <QuickBar onTab={setTab} />

        <SearchBar myId={user.id} />

        <div className="flex items-center justify-between gap-2 mb-6">
          <TabsBar tab={tab} onChange={setTab} />
          {(blocked ?? []).length > 0 && (
            <button
              type="button"
              onClick={() => setTab("blocked")}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-tomato transition-colors"
            >
              <ShieldOff size={13} /> Zablokowani ({blocked!.length})
            </button>
          )}
        </div>

        {tab === "friends" && (
          <div className="pz-fade-in">
            <FriendsTab myId={user.id} />
          </div>
        )}
        {tab === "requests" && (
          <div className="pz-fade-in">
            <RequestsTab myId={user.id} />
          </div>
        )}
        {tab === "invite" && (
          <div className="pz-fade-in">
            <InviteTab />
          </div>
        )}
      </div>
    </main>
  );
}

/* ============================================================
 * QUICK BAR - liczniki + akcje
 * ============================================================ */
function QuickBar({ onTab }: { onTab: (t: TabKey) => void }) {
  const { user } = useUser();
  const { data: friendships } = useMyFriendships();
  const { data: suggestions } = useFriendSuggestions();
  const friendsCount = (friendships ?? []).filter((f) => f.status === "accepted").length;
  const incoming = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;
  const suggestionCount = suggestions?.length ?? 0;

  return (
    <section className="mb-5 grid grid-cols-3 gap-2">
      <Stat label="Znajomych" value={friendsCount} onClick={() => onTab("friends")} />
      <Stat
        label="Do akceptacji"
        value={incoming}
        highlight={incoming > 0}
        onClick={() => onTab("requests")}
      />
      <Stat label="Może znasz" value={suggestionCount} onClick={() => onTab("invite")} />
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
  onClick,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-3 transition hover:border-tomato ${
        highlight ? "bg-tomato/10 border-tomato/50" : "bg-card border-border"
      }`}
    >
      <div className={`font-display text-2xl leading-none ${highlight ? "text-tomato" : ""}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
        {label}
      </div>
    </button>
  );
}

/* ============================================================
 * SEARCH BAR - jedyna wyszukiwarka na stronie. Szuka wśród
 * wszystkich użytkowników; stan przycisku (Dodaj/Wysłano/Znajomy)
 * mówi wprost, czy to już Twój znajomy.
 * ============================================================ */
function SearchBar({ myId }: { myId: string }) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 250);
  const { data: results, isFetching } = useUserSearch(debounced);
  const send = useSendFriendRequest();
  const filtered = useMemo(() => (results ?? []).filter((u) => u.id !== myId), [results, myId]);

  return (
    <section className="mb-6">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj osób po nicku, imieniu lub e-mailu…"
          className="w-full pl-9 pr-3 py-2.5 rounded-full bg-card border border-border focus:border-tomato outline-none text-sm"
        />
        {isFetching && debounced.length >= 2 && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>
      {debounced.length >= 2 && (
        <div className="mt-2 bg-card border border-border rounded-2xl divide-y divide-border max-h-72 overflow-y-auto">
          {filtered.length === 0 && !isFetching ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">Brak wyników.</div>
          ) : (
            filtered.slice(0, 6).map((u) => (
              <div key={u.id} className="px-3 py-2 flex items-center gap-3">
                <AvatarLink
                  username={u.username}
                  userId={u.id}
                  avatarUrl={u.avatar_url}
                  avatarSource={(u.avatar_source as FriendProfile["avatar_source"]) ?? "initials"}
                  displayName={u.display_name}
                  size={32}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {u.display_name || (u.username ? `@${u.username}` : "Użytkownik")}
                  </div>
                  {u.username && u.display_name && (
                    <div className="text-[11px] text-muted-foreground truncate">@{u.username}</div>
                  )}
                </div>
                <ViewProfileLink username={u.username} userId={u.id} />
                <SendFriendButton
                  targetId={u.id}
                  onAdd={(id) =>
                    runWithToast(() => send.mutateAsync(id), {
                      success: "Zaproszenie wysłane",
                      error: "Nie udało się wysłać zaproszenia",
                    })
                  }
                  pending={send.isPending}
                />
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

/* ============================================================
 * TABS BAR
 * ============================================================ */
function TabsBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  const { data: friendships } = useMyFriendships();
  const { user } = useUser();
  const incoming = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;
  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "friends", label: "Znajomi", icon: <Users size={14} /> },
    {
      key: "requests",
      label: "Zaproszenia",
      icon: <UserPlus size={14} />,
      badge: incoming || undefined,
    },
    { key: "invite", label: "Zaproś", icon: <Share2 size={14} /> },
  ];
  return (
    <div className="-mx-4 px-4 flex-1 min-w-0 overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
              tab === t.key
                ? "bg-tomato text-cream border-tomato"
                : "bg-card text-foreground border-border hover:border-tomato"
            }`}
          >
            {t.icon} {t.label}
            {t.badge && (
              <span className="ml-1 inline-grid min-w-[16px] h-4 px-1 place-items-center rounded-full bg-tomato text-cream text-[10px] font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 * FRIENDS TAB
 * ============================================================ */
function FriendsTab({ myId }: { myId: string }) {
  const friendsQ = useFriendProfiles(myId);
  const { data: friendships } = useMyFriendships();
  const { data: favorites } = useFriendFavorites();
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const friends = friendsQ.data;

  const filtered = useMemo(() => {
    let arr = friends ?? [];
    if (onlyFavorites && favorites) {
      arr = arr.filter((f) => favorites.has(f.id));
    }
    if (favorites) {
      arr = [...arr].sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)));
    }
    return arr;
  }, [friends, favorites, onlyFavorites]);

  return (
    <section>
      {(friends ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setOnlyFavorites(false)}
            className={`chip ${!onlyFavorites ? "bg-tomato text-cream" : "bg-card border border-border"}`}
          >
            Wszyscy ({(friends ?? []).length})
          </button>
          <button
            type="button"
            onClick={() => setOnlyFavorites(true)}
            className={`chip ${onlyFavorites ? "bg-tomato text-cream" : "bg-card border border-border"}`}
          >
            <Star size={12} /> Ulubieni ({favorites?.size ?? 0})
          </button>
        </div>
      )}

      <AsyncState
        isLoading={friendsQ.isLoading}
        isError={friendsQ.isError}
        error={friendsQ.error}
        isFetching={friendsQ.isFetching}
        isEmpty={(friends ?? []).length === 0 || filtered.length === 0}
        emptyText={
          (friends ?? []).length === 0
            ? "Nikogo tu jeszcze nie ma. Poszukaj kogoś w pasku wyżej, albo zajrzyj do zakładki „Zaproś”."
            : "Nikogo z ulubionych."
        }
        onRetry={() => friendsQ.refetch()}
        skeletonRows={4}
      >
        <ul className="space-y-2">
          {filtered.map((p) => {
            const friendship = (friendships ?? []).find(
              (f) =>
                f.status === "accepted" && (f.requester_id === p.id || f.addressee_id === p.id),
            );
            return (
              <FriendRow
                key={p.id}
                profile={p}
                isFavorite={favorites?.has(p.id) ?? false}
                friendshipId={friendship?.id}
              />
            );
          })}
        </ul>
      </AsyncState>
    </section>
  );
}

function FriendRow({
  profile,
  isFavorite,
  friendshipId,
}: {
  profile: FriendProfile;
  isFavorite: boolean;
  friendshipId?: string;
}) {
  const toggleFav = useToggleFavorite();
  const remove = useRemoveFriendship();
  const block = useBlockUser();
  const [openNote, setOpenNote] = useState(false);

  return (
    <li className="bg-card border border-border rounded-2xl p-3">
      <div className="flex items-center gap-2.5">
        <FriendAvatar profile={profile} size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">
            {profile.display_name || `@${profile.username}`}
          </div>
          {profile.username && profile.display_name && (
            <div className="text-xs text-muted-foreground truncate">@{profile.username}</div>
          )}
        </div>

        <button
          type="button"
          title={isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
          disabled={toggleFav.isPending}
          onClick={() =>
            runWithToast(() => toggleFav.mutateAsync({ friendId: profile.id, on: !isFavorite }), {
              error: isFavorite
                ? "Nie udało się usunąć z ulubionych"
                : "Nie udało się dodać do ulubionych",
            })
          }
          className={`shrink-0 p-2 rounded-full border disabled:opacity-50 ${isFavorite ? "bg-yellow-400/15 border-yellow-500/40 text-yellow-500" : "bg-card border-border hover:border-tomato"}`}
        >
          <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
        </button>

        {profile.username && (
          <Link
            to="/u/$username"
            params={{ username: profile.username }}
            title="Profil"
            className="shrink-0 grid h-[34px] w-[34px] place-items-center rounded-full border border-border bg-card hover:border-tomato"
          >
            <UserIcon size={14} />
          </Link>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Więcej opcji"
            className="shrink-0 grid h-[34px] w-[34px] place-items-center rounded-full border border-border bg-card hover:border-tomato outline-none"
          >
            <MoreVertical size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setOpenNote((v) => !v)} className="cursor-pointer">
              <StickyNote size={14} className="mr-2" /> Notatka
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {friendshipId && (
              <DropdownMenuItem
                disabled={remove.isPending}
                onClick={() => {
                  if (!confirm("Usunąć z grona znajomych?")) return;
                  runWithToast(() => remove.mutateAsync(friendshipId), {
                    loading: "Usuwanie…",
                    success: "Usunięto z grona znajomych",
                    error: "Nie udało się usunąć znajomego",
                  });
                }}
                className="cursor-pointer"
              >
                <Trash2 size={14} className="mr-2" /> Usuń znajomego
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={block.isPending}
              onClick={() => {
                if (
                  !confirm(
                    `Zablokować ${profile.display_name || profile.username}? Znajomość zostanie usunięta.`,
                  )
                )
                  return;
                runWithToast(() => block.mutateAsync(profile.id), {
                  loading: "Blokowanie…",
                  success: "Zablokowano użytkownika",
                  error: "Nie udało się zablokować",
                });
              }}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Ban size={14} className="mr-2" /> Zablokuj
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {openNote && <NoteEditor friendId={profile.id} />}
    </li>
  );
}

function NoteEditor({ friendId }: { friendId: string }) {
  const { data: note } = useFriendNote(friendId);
  const save = useSetFriendNote();
  const [val, setVal] = useState("");
  useEffect(() => {
    setVal(note ?? "");
  }, [note]);
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <label className="text-xs text-muted-foreground mb-1 block">
        Prywatna notatka (widzisz tylko Ty)
      </label>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={2}
        className="w-full rounded-xl bg-background border border-border focus:border-tomato outline-none p-2 text-sm"
      />
      <div className="flex justify-end mt-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() =>
            runWithToast(() => save.mutateAsync({ friendId, note: val }), {
              success: "Zapisano notatkę",
              error: "Nie udało się zapisać notatki",
            })
          }
          className="chip bg-tomato text-cream disabled:opacity-50"
        >
          {save.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
          Zapisz notatkę
        </button>
      </div>
    </div>
  );
}

/* ============================================================
 * REQUESTS TAB
 * ============================================================ */
function RequestsTab({ myId }: { myId: string }) {
  const friendshipsQ = useMyFriendships();
  const friendships = friendshipsQ.data;
  const respond = useRespondToFriendRequest();
  const remove = useRemoveFriendship();
  const [profiles, setProfiles] = useState<Record<string, FriendProfile>>({});

  useEffect(() => {
    const ids = Array.from(
      new Set(
        (friendships ?? [])
          .filter((f) => f.status === "pending")
          .map((f) => (f.requester_id === myId ? f.addressee_id : f.requester_id)),
      ),
    );
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
      )
      .in("id", ids)
      .then(({ data }) => {
        const m: Record<string, FriendProfile> = {};
        (data ?? []).forEach((p) => {
          m[p.id] = p as FriendProfile;
        });
        setProfiles(m);
      });
  }, [friendships, myId]);

  const incoming = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === myId,
  );
  const outgoing = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.requester_id === myId,
  );

  const handleRespond = (id: string, accept: boolean) =>
    runWithToast(() => respond.mutateAsync({ id, accept }), {
      success: accept ? "Dodano do znajomych" : "Zaproszenie odrzucone",
      error: accept ? "Nie udało się zaakceptować" : "Nie udało się odrzucić",
    });
  const handleCancel = (id: string) =>
    runWithToast(() => remove.mutateAsync(id), {
      success: "Cofnięto zaproszenie",
      error: "Nie udało się cofnąć zaproszenia",
    });

  return (
    <AsyncState
      isLoading={friendshipsQ.isLoading}
      isError={friendshipsQ.isError}
      error={friendshipsQ.error}
      isFetching={friendshipsQ.isFetching}
      onRetry={() => friendshipsQ.refetch()}
      skeletonRows={3}
    >
      <h2 className="font-display text-xl mb-3">Zaproszenia do Ciebie ({incoming.length})</h2>
      {incoming.length === 0 ? (
        <Empty text="Brak nowych zaproszeń." />
      ) : (
        <ul className="space-y-2 mb-6">
          {incoming.map((f) => {
            const p = profiles[f.requester_id];
            return (
              <li
                key={f.id}
                className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 flex-wrap"
              >
                <FriendAvatar profile={p} size={40} />
                <div className="flex-1 min-w-0">
                  <FriendName profile={p} />
                </div>
                <ViewProfileLink username={p?.username} userId={f.requester_id} />
                <button
                  disabled={respond.isPending}
                  onClick={() => handleRespond(f.id, true)}
                  className="inline-flex items-center gap-1 rounded-full bg-tomato text-cream px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {respond.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}{" "}
                  Akceptuj
                </button>
                <button
                  disabled={respond.isPending}
                  onClick={() => handleRespond(f.id, false)}
                  className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  <X size={12} /> Odrzuć
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="font-display text-xl mb-3">Wysłane ({outgoing.length})</h2>
      {outgoing.length === 0 ? (
        <Empty text="Brak wysłanych." />
      ) : (
        <ul className="space-y-2">
          {outgoing.map((f) => {
            const p = profiles[f.addressee_id];
            return (
              <li
                key={f.id}
                className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 flex-wrap"
              >
                <FriendAvatar profile={p} size={40} />
                <div className="flex-1 min-w-0">
                  <FriendName profile={p} />
                  <div className="text-xs text-muted-foreground">Oczekuje na odpowiedź…</div>
                </div>
                <ViewProfileLink username={p?.username} userId={f.addressee_id} />
                <button
                  disabled={remove.isPending}
                  onClick={() => handleCancel(f.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-semibold hover:border-destructive hover:text-destructive disabled:opacity-50"
                >
                  <X size={12} /> Cofnij
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AsyncState>
  );
}

/* ============================================================
 * ZAPROŚ TAB (dawniej "Znajdź" - wyszukiwarka wyżej jest wspólna
 * dla całej strony, więc zostają tu tylko sugestie + zapraszanie
 * spoza aplikacji, zamiast trzeciej kopii tego samego pola)
 * ============================================================ */
function InviteTab() {
  return (
    <>
      <SuggestionsBlock />
      <InviteBlock />
    </>
  );
}

function SendFriendButton({
  targetId,
  onAdd,
  pending,
}: {
  targetId: string;
  onAdd: (id: string) => void;
  pending: boolean;
}) {
  const { data: existing } = useFriendshipWith(targetId);
  if (existing?.status === "accepted")
    return (
      <span className="chip bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Znajomy</span>
    );
  if (existing?.status === "pending")
    return <span className="chip bg-muted text-muted-foreground">Wysłano</span>;
  return (
    <button
      onClick={() => onAdd(targetId)}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-full bg-tomato text-cream px-3 py-1.5 text-xs font-semibold hover:bg-tomato/90 disabled:opacity-50"
    >
      <UserPlus size={12} /> Dodaj
    </button>
  );
}

function SuggestionsBlock() {
  const suggQ = useFriendSuggestions();
  const send = useSendFriendRequest();
  const sugg = suggQ.data;
  if (suggQ.isLoading) {
    return (
      <section className="mb-8">
        <h2 className="font-display text-xl mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-tomato" /> Może znasz
        </h2>
        <AsyncState isLoading isError={false} skeletonRows={2}>
          {null}
        </AsyncState>
      </section>
    );
  }
  if (suggQ.isError) {
    return (
      <section className="mb-8">
        <h2 className="font-display text-xl mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-tomato" /> Może znasz
        </h2>
        <AsyncState isLoading={false} isError error={suggQ.error} onRetry={() => suggQ.refetch()}>
          {null}
        </AsyncState>
      </section>
    );
  }
  if (!sugg || sugg.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl mb-3 flex items-center gap-2">
        <Sparkles size={18} className="text-tomato" /> Może znasz
      </h2>
      <ul className="space-y-2">
        {sugg.slice(0, 8).map((s) => (
          <li
            key={s.id}
            className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
          >
            <FriendAvatar profile={s} size={36} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{s.display_name || `@${s.username}`}</div>
              <div className="text-xs text-muted-foreground">
                {s.mutuals > 0 && <span>{s.mutuals} wsp. znajomych</span>}
                {s.mutuals > 0 && s.shared_places > 0 && " · "}
                {s.shared_places > 0 && <span>{s.shared_places} wsp. lokali</span>}
              </div>
            </div>
            <ViewProfileLink username={s.username} userId={s.id} />
            <button
              onClick={() =>
                runWithToast(() => send.mutateAsync(s.id), {
                  success: "Zaproszenie wysłane",
                  error: "Nie udało się wysłać zaproszenia",
                })
              }
              disabled={send.isPending}
              className="inline-flex items-center gap-1 rounded-full bg-tomato text-cream px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <UserPlus size={12} /> Dodaj
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InviteBlock() {
  const { data: invites } = useMyInvites();
  const { data: stats } = useInviteStats();
  const create = useCreateInvite();
  const revoke = useRevokeInvite();
  const [email, setEmail] = useState("");
  const [openQr, setOpenQr] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function handleCreate(withEmail: boolean) {
    try {
      const inv = await create.mutateAsync(withEmail ? email : undefined);
      const url = `${origin}/i/${inv.token}`;
      if (withEmail && email) {
        const subject = encodeURIComponent("Dołącz do mnie na poŻeramy!");
        const body = encodeURIComponent(
          `Cześć! Zapraszam Cię do znajomych na poŻeramy:\n\n${url}\n\nDo zobaczenia w lokalu!`,
        );
        window.open(`mailto:${email}?subject=${subject}&body=${body}`);
        setEmail("");
      } else {
        await navigator.clipboard?.writeText(url).catch(() => {});
        toast.success("Link skopiowany do schowka");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się utworzyć zaproszenia");
    }
  }

  return (
    <section>
      <h2 className="font-display text-xl mb-3 flex items-center gap-2">
        <Share2 size={18} className="text-tomato" /> Zaproś spoza poŻeramy
      </h2>

      {stats && stats.sent > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-card border border-border rounded-2xl p-3 text-center">
            <div className="font-display text-2xl leading-none">{stats.sent}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
              Wysłane
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3 text-center">
            <div className="font-display text-2xl leading-none text-emerald-600">
              {stats.accepted}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
              Dołączyło
            </div>
          </div>
          <div className="bg-tomato/10 border border-tomato/40 rounded-2xl p-3 text-center">
            <div className="font-display text-2xl leading-none text-tomato">
              +{stats.totalPoints}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
              Punktów
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <VipReferralProgress />
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <button
          type="button"
          onClick={() => handleCreate(false)}
          disabled={create.isPending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream px-4 py-2.5 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-50"
        >
          <LinkIcon size={14} /> Wygeneruj link zaproszeniowy
        </button>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="adres@email.pl"
            className="flex-1 rounded-full bg-background border border-border focus:border-tomato outline-none px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!email || create.isPending}
            onClick={() => handleCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-card border border-border hover:border-tomato px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Mail size={14} /> Zaproś mailem
          </button>
        </div>
      </div>

      {(invites ?? []).filter((i) => i.status === "pending").length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Aktywne zaproszenia</h3>
          <ul className="space-y-2">
            {(invites ?? [])
              .filter((i) => i.status === "pending")
              .map((inv) => {
                const url = `${origin}/i/${inv.token}`;
                return (
                  <li key={inv.id} className="bg-card border border-border rounded-2xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground truncate">
                          {inv.email || "Link"}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground truncate">
                          {url}
                        </div>
                      </div>
                      <button
                        type="button"
                        title="Kopiuj"
                        onClick={() => {
                          navigator.clipboard?.writeText(url);
                          toast.success("Skopiowano");
                        }}
                        className="p-2 rounded-full border bg-card border-border hover:border-tomato"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        title="QR"
                        onClick={() => setOpenQr(openQr === inv.id ? null : inv.id)}
                        className="p-2 rounded-full border bg-card border-border hover:border-tomato"
                      >
                        <QrCode size={14} />
                      </button>
                      <button
                        type="button"
                        title="Cofnij"
                        disabled={revoke.isPending}
                        onClick={() =>
                          runWithToast(() => revoke.mutateAsync(inv.id), {
                            success: "Zaproszenie cofnięte",
                            error: "Nie udało się cofnąć zaproszenia",
                          })
                        }
                        className="p-2 rounded-full border bg-card border-border hover:border-destructive hover:text-destructive disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {openQr === inv.id && (
                      <div className="grid place-items-center p-3 bg-white rounded-xl">
                        <QRCodeSVG value={url} size={180} />
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {stats && stats.acceptedList.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Dołączyli z Twojego zaproszenia</h3>
          <ul className="space-y-2">
            {stats.acceptedList.map((r) => (
              <li
                key={r.inviteId}
                className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
              >
                <FriendAvatar profile={r.profile ?? undefined} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {r.profile?.display_name || (r.profile?.username ? `@${r.profile.username}` : "Użytkownik")}
                  </div>
                  {r.acceptedAt && (
                    <div className="text-xs text-muted-foreground">
                      Dołączył(a) {new Date(r.acceptedAt).toLocaleDateString("pl-PL")}
                    </div>
                  )}
                </div>
                {r.points > 0 && (
                  <span className="chip bg-tomato/10 text-tomato shrink-0">
                    <Trophy size={11} /> +{r.points}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ============================================================
 * BLOCKED - reached via a small header link, not a main tab
 * ============================================================ */
function BlockedTab() {
  const blockedQ = useBlockedUsers();
  const unblock = useUnblockUser();
  const blocked = blockedQ.data;
  return (
    <AsyncState
      isLoading={blockedQ.isLoading}
      isError={blockedQ.isError}
      error={blockedQ.error}
      isFetching={blockedQ.isFetching}
      isEmpty={!blocked || blocked.length === 0}
      emptyText="Nie masz zablokowanych użytkowników."
      onRetry={() => blockedQ.refetch()}
      skeletonRows={2}
    >
      <ul className="space-y-2">
        {(blocked ?? []).map((p) => (
          <li
            key={p.id}
            className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
          >
            <FriendAvatar profile={p} size={40} />
            <div className="flex-1 min-w-0">
              <FriendName profile={p} />
            </div>
            <button
              type="button"
              disabled={unblock.isPending}
              onClick={() =>
                runWithToast(() => unblock.mutateAsync(p.id), {
                  success: "Odblokowano użytkownika",
                  error: "Nie udało się odblokować",
                })
              }
              className="chip bg-card border border-border hover:border-tomato disabled:opacity-50"
            >
              {unblock.isPending && <Loader2 size={12} className="animate-spin" />}
              Odblokuj
            </button>
          </li>
        ))}
      </ul>
    </AsyncState>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */
function Empty({ text }: { text: string }) {
  return (
    <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function FriendName({ profile }: { profile?: FriendProfile }) {
  if (!profile) return <div className="text-muted-foreground text-sm">Ładowanie…</div>;
  const label = profile.display_name || (profile.username ? `@${profile.username}` : "Użytkownik");
  const inner = (
    <>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-semibold truncate" style={vipNameStyle(profile)}>
          {label}
        </span>
        {isVipActive(profile) && <VipBadge />}
      </div>
      {profile.username && profile.display_name && (
        <div className="text-xs text-muted-foreground truncate">@{profile.username}</div>
      )}
    </>
  );
  const handle = profile.username ?? profile.id;
  if (!handle) return <div>{inner}</div>;
  return (
    <Link
      to="/u/$username"
      params={{ username: handle }}
      className="block min-w-0 hover:text-tomato transition-colors"
    >
      {inner}
    </Link>
  );
}

function AvatarLink({
  username,
  userId,
  avatarUrl,
  avatarSource,
  displayName,
  size,
  className,
}: {
  username: string | null | undefined;
  userId?: string | null | undefined;
  avatarUrl: string | null | undefined;
  avatarSource?: FriendProfile["avatar_source"] | null | undefined;
  displayName: string | null | undefined;
  size: number;
  className?: string;
}) {
  const avatar = (
    <UserAvatar
      avatarUrl={avatarUrl}
      avatarSource={avatarSource ?? "initials"}
      displayName={displayName}
      username={username}
      size={size}
      className={`hover:ring-2 hover:ring-tomato/50 transition ${className ?? ""}`}
    />
  );
  const handle = username ?? userId ?? null;
  if (!handle) return avatar;
  return (
    <Link to="/u/$username" params={{ username: handle }} className="shrink-0">
      {avatar}
    </Link>
  );
}

function FriendAvatar({ profile, size }: { profile?: FriendProfile; size: number }) {
  return (
    <AvatarLink
      username={profile?.username}
      userId={profile?.id}
      avatarUrl={profile?.avatar_url}
      avatarSource={profile?.avatar_source}
      displayName={profile?.display_name}
      size={size}
    />
  );
}

function ViewProfileLink({
  username,
  userId,
}: {
  username: string | null | undefined;
  userId: string | null | undefined;
}) {
  const handle = username ?? userId ?? null;
  if (!handle) return null;
  return (
    <Link
      to="/u/$username"
      params={{ username: handle }}
      className="inline-flex items-center gap-1 shrink-0 rounded-full bg-card border border-border hover:border-tomato px-3 py-1.5 text-xs font-medium text-foreground hover:text-tomato transition-colors"
    >
      <UserIcon size={12} /> Zobacz profil
    </Link>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
