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
  Folder,
  Link as LinkIcon,
  Mail,
  QrCode,
  Copy,
  ShieldOff,
  Plus,
  Sparkles,
  Share2,
  Home,
  User as UserIcon,
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
  useFriendLists,
  useFriendListMembers,
  useCreateFriendList,
  useDeleteFriendList,
  useToggleListMember,
  useFriendNote,
  useSetFriendNote,
  useBlockedUsers,
  useBlockUser,
  useUnblockUser,
  useMyInvites,
  useCreateInvite,
  useRevokeInvite,
  useFriendSuggestions,
  useFriendLeaderboard,
  type FriendProfile,
} from "@/lib/friends-api";
import { useUserSearch } from "@/lib/wall-api";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { AsyncState, runWithToast } from "@/components/AsyncState";
import { VipBadge, isVipActive, vipNameStyle } from "@/components/VipBadge";

const TAB_KEYS = ["friends", "requests", "find", "groups", "leaderboard", "blocked"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const searchSchema = z.object({
  tab: z.enum(TAB_KEYS).catch("friends").default("friends"),
});

export const Route = createFileRoute("/_authenticated/friends")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Znajomi — poŻeramy" },
      { name: "description", content: "Twoi znajomi, zaproszenia, grupy i ranking w poŻeramy." },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const { user } = useUser();
  const { data: myProfile } = useMyProfile();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setTab = (next: TabKey) =>
    navigate({ search: (prev: { tab: TabKey }) => ({ ...prev, tab: next }), replace: true });

  if (!user) {
    return (
      <main id="main-content" className="grid place-items-center py-20">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background py-6 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl mb-1">Znajomi</h1>
              <p className="text-muted-foreground text-sm">
                Zarządzaj znajomymi, grupami, zaproszeniami i blokadami w jednym miejscu.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
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

        <TabsBar tab={tab} onChange={setTab} />

        {tab === "friends" && (
          <>
            <FriendsTab myId={user.id} />
            <SuggestionsBlock />
          </>
        )}
        {tab === "requests" && <RequestsTab myId={user.id} />}
        {tab === "find" && <FindTab myId={user.id} />}
        {tab === "groups" && <GroupsTab />}
        {tab === "leaderboard" && <LeaderboardTab myId={user.id} />}
        {tab === "blocked" && <BlockedTab />}
      </div>
    </main>
  );
}

/* ============================================================
 * QUICK BAR — liczniki + akcje
 * ============================================================ */
function QuickBar({ onTab }: { onTab: (t: TabKey) => void }) {
  const { user } = useUser();
  const { data: friendships } = useMyFriendships();
  const { data: suggestions } = useFriendSuggestions();
  const friendsCount = (friendships ?? []).filter((f) => f.status === "accepted").length;
  const incoming = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;
  const outgoing = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.requester_id === user?.id,
  ).length;
  const suggestionCount = suggestions?.length ?? 0;

  return (
    <section className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Znajomych" value={friendsCount} onClick={() => onTab("friends")} />
      <Stat
        label="Do akceptacji"
        value={incoming}
        highlight={incoming > 0}
        onClick={() => onTab("requests")}
      />
      <Stat label="Wysłane" value={outgoing} onClick={() => onTab("requests")} />
      <Stat label="Sugestii" value={suggestionCount} onClick={() => onTab("find")} />
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
 * SEARCH BAR — zawsze widoczna, przechodzi do "find" z zapytaniem
 * ============================================================ */
function SearchBar({ myId }: { myId: string }) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 250);
  const { data: results, isFetching } = useUserSearch(debounced);
  const send = useSendFriendRequest();
  const filtered = useMemo(() => (results ?? []).filter((u) => u.id !== myId), [results, myId]);

  return (
    <section className="mb-5">
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
                  onAdd={(id) => send.mutate(id)}
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
    { key: "find", label: "Znajdź", icon: <Search size={14} /> },
    { key: "groups", label: "Grupy", icon: <Folder size={14} /> },
    { key: "leaderboard", label: "Ranking", icon: <Trophy size={14} /> },
    { key: "blocked", label: "Zablokowani", icon: <ShieldOff size={14} /> },
  ];
  return (
    <div className="-mx-4 px-4 mb-6 overflow-x-auto">
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
  const { data: lists } = useFriendLists();
  const [filter, setFilter] = useState<"all" | "favorites" | string>("all");
  const [q, setQ] = useState("");
  const { data: listMembers } = useFriendListMembers(
    filter !== "all" && filter !== "favorites" ? filter : null,
  );
  const friends = friendsQ.data;

  const filtered = useMemo(() => {
    let arr = friends ?? [];
    if (filter === "favorites" && favorites) {
      arr = arr.filter((f) => favorites.has(f.id));
    } else if (filter !== "all" && listMembers) {
      arr = arr.filter((f) => listMembers.has(f.id));
    }
    if (q.trim()) {
      const qq = q.toLowerCase();
      arr = arr.filter(
        (f) =>
          (f.display_name ?? "").toLowerCase().includes(qq) ||
          (f.username ?? "").toLowerCase().includes(qq),
      );
    }
    if (favorites) {
      arr = [...arr].sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)));
    }
    return arr;
  }, [friends, favorites, listMembers, filter, q]);

  return (
    <section>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`chip ${filter === "all" ? "bg-tomato text-cream" : "bg-card border border-border"}`}
        >
          Wszyscy ({(friends ?? []).length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("favorites")}
          className={`chip ${filter === "favorites" ? "bg-tomato text-cream" : "bg-card border border-border"}`}
        >
          <Star size={12} /> Ulubieni ({favorites?.size ?? 0})
        </button>
        {(lists ?? []).map((l) => (
          <ListChip key={l.id} list={l} active={filter === l.id} onClick={() => setFilter(l.id)} />
        ))}
      </div>

      <div className="relative mb-3">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj wśród znajomych…"
          className="w-full pl-9 pr-3 py-2.5 rounded-full bg-card border border-border focus:border-tomato outline-none text-sm"
        />
      </div>

      <AsyncState
        isLoading={friendsQ.isLoading}
        isError={friendsQ.isError}
        error={friendsQ.error}
        isFetching={friendsQ.isFetching}
        isEmpty={(friends ?? []).length === 0 || filtered.length === 0}
        emptyText={
          (friends ?? []).length === 0
            ? 'Nikogo tu jeszcze nie ma. Wejdź w zakładkę „Znajdź".'
            : "Nic nie pasuje do filtra."
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

function ListChip({
  list,
  active,
  onClick,
}: {
  list: { id: string; name: string; color: string | null };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip ${active ? "bg-tomato text-cream" : "bg-card border border-border"}`}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: list.color || "#888" }} />
      {list.name}
    </button>
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
  const [openLists, setOpenLists] = useState(false);

  return (
    <li className="bg-card border border-border rounded-2xl p-3">
      <div className="flex items-center gap-3 flex-wrap">
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
          className={`p-2 rounded-full border disabled:opacity-50 ${isFavorite ? "bg-yellow-400/15 border-yellow-500/40 text-yellow-500" : "bg-card border-border hover:border-tomato"}`}
        >
          <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          title="Grupy"
          onClick={() => setOpenLists((v) => !v)}
          className="p-2 rounded-full border bg-card border-border hover:border-tomato"
        >
          <Folder size={14} />
        </button>

        <button
          type="button"
          title="Notatka"
          onClick={() => setOpenNote((v) => !v)}
          className="p-2 rounded-full border bg-card border-border hover:border-tomato"
        >
          <StickyNote size={14} />
        </button>

        {profile.username && (
          <Link
            to="/u/$username"
            params={{ username: profile.username }}
            className="chip bg-card border border-border hover:border-tomato"
          >
            Profil
          </Link>
        )}

        {friendshipId && (
          <button
            type="button"
            title="Usuń znajomego"
            disabled={remove.isPending}
            onClick={() => {
              if (!confirm("Usunąć z grona znajomych?")) return;
              runWithToast(() => remove.mutateAsync(friendshipId), {
                loading: "Usuwanie…",
                success: "Usunięto z grona znajomych",
                error: "Nie udało się usunąć znajomego",
              });
            }}
            className="p-2 rounded-full border bg-card border-border hover:border-destructive hover:text-destructive disabled:opacity-50"
          >
            {remove.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        )}

        <button
          type="button"
          title="Zablokuj"
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
          className="p-2 rounded-full border bg-card border-border hover:border-destructive hover:text-destructive disabled:opacity-50"
        >
          {block.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
        </button>
      </div>

      {openNote && <NoteEditor friendId={profile.id} />}
      {openLists && <ListsAssign friendId={profile.id} />}
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

function ListsAssign({ friendId }: { friendId: string }) {
  const { data: lists } = useFriendLists();
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="text-xs text-muted-foreground mb-2">Dodaj do grup:</div>
      {(lists ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nie masz jeszcze żadnych grup. Utwórz je w zakładce „Grupy".
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(lists ?? []).map((l) => (
            <ListAssignToggle
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

function ListAssignToggle({
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
      className={`chip disabled:opacity-50 ${on ? "bg-tomato text-cream" : "bg-card border border-border"}`}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color || "#888" }} />
      {name}
    </button>
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
 * FIND TAB
 * ============================================================ */
function FindTab({ myId }: { myId: string }) {
  return (
    <>
      <SearchUsers myId={myId} />
      <SuggestionsBlock />
      <InviteBlock />
    </>
  );
}

function SearchUsers({ myId }: { myId: string }) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 250);
  const { data: results, isFetching } = useUserSearch(debounced);
  const send = useSendFriendRequest();
  const filtered = useMemo(() => (results ?? []).filter((u) => u.id !== myId), [results, myId]);

  return (
    <section className="mb-8">
      <h2 className="font-display text-xl mb-3">Wyszukaj</h2>
      <div className="relative mb-3">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nick, imię, e-mail…"
          className="w-full pl-9 pr-3 py-2.5 rounded-full bg-card border border-border focus:border-tomato outline-none text-sm"
        />
      </div>
      {debounced.length < 2 ? (
        <p className="text-xs text-muted-foreground">Wpisz co najmniej 2 znaki.</p>
      ) : isFetching ? (
        <div className="text-sm text-muted-foreground">Szukam…</div>
      ) : filtered.length === 0 ? (
        <Empty text="Brak wyników." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((u) => (
            <li
              key={u.id}
              className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
            >
              <AvatarLink
                username={u.username}
                userId={u.id}
                avatarUrl={u.avatar_url}
                avatarSource={(u.avatar_source as FriendProfile["avatar_source"]) ?? "initials"}
                displayName={u.display_name}
                size={36}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {u.display_name || (u.username ? `@${u.username}` : "Użytkownik")}
                </div>
                {u.username && u.display_name && (
                  <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
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
            </li>
          ))}
        </ul>
      )}
    </section>
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
  // Nic nie pokazuj jeśli pusto lub błąd — to blok pomocniczy
  if (suggQ.isLoading) {
    return (
      <section className="mt-8">
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
      <section className="mt-8">
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
    <section className="mt-8">
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
    <section className="mt-8">
      <h2 className="font-display text-xl mb-3 flex items-center gap-2">
        <Share2 size={18} className="text-tomato" /> Zaproś spoza poŻeramy
      </h2>
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
    </section>
  );
}

/* ============================================================
 * GROUPS TAB
 * ============================================================ */
function GroupsTab() {
  const listsQ = useFriendLists();
  const create = useCreateFriendList();
  const del = useDeleteFriendList();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#FF6B47");
  const lists = listsQ.data;

  return (
    <section>
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <h3 className="font-semibold mb-2">Nowa grupa</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Ekipa na pizzę"
            className="flex-1 rounded-full bg-background border border-border focus:border-tomato outline-none px-3 py-2 text-sm"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-10 rounded border border-border bg-background"
          />
          <button
            type="button"
            disabled={!name.trim() || create.isPending}
            onClick={async () => {
              const ok = await runWithToast(
                () => create.mutateAsync({ name: name.trim(), color }),
                { success: "Grupa utworzona", error: "Nie udało się utworzyć grupy" },
              );
              if (ok !== undefined) setName("");
            }}
            className="inline-flex items-center justify-center gap-1 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{" "}
            Dodaj
          </button>
        </div>
      </div>

      <AsyncState
        isLoading={listsQ.isLoading}
        isError={listsQ.isError}
        error={listsQ.error}
        isFetching={listsQ.isFetching}
        isEmpty={(lists ?? []).length === 0}
        emptyText="Nie masz jeszcze żadnych grup."
        onRetry={() => listsQ.refetch()}
        skeletonRows={2}
      >
        <ul className="space-y-2">
          {(lists ?? []).map((l) => (
            <li
              key={l.id}
              className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
            >
              <span className="w-3 h-3 rounded-full" style={{ background: l.color || "#888" }} />
              <div className="flex-1 font-semibold">{l.name}</div>
              <GroupMembersCount listId={l.id} />
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => {
                  if (!confirm(`Usunąć grupę "${l.name}"?`)) return;
                  runWithToast(() => del.mutateAsync(l.id), {
                    success: "Grupa usunięta",
                    error: "Nie udało się usunąć grupy",
                  });
                }}
                className="p-2 rounded-full border bg-card border-border hover:border-destructive hover:text-destructive disabled:opacity-50"
              >
                {del.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </li>
          ))}
        </ul>
      </AsyncState>
      <p className="text-xs text-muted-foreground mt-4">
        Dodajesz znajomych do grup w zakładce „Znajomi" — kliknij ikonę folderu obok znajomego.
      </p>
    </section>
  );
}

function GroupMembersCount({ listId }: { listId: string }) {
  const { data } = useFriendListMembers(listId);
  return <span className="text-xs text-muted-foreground">{data?.size ?? 0} osób</span>;
}

/* ============================================================
 * LEADERBOARD TAB
 * ============================================================ */
function LeaderboardTab({ myId }: { myId: string }) {
  const lbQ = useFriendLeaderboard();
  const rows = lbQ.data;
  return (
    <AsyncState
      isLoading={lbQ.isLoading}
      isError={lbQ.isError}
      error={lbQ.error}
      isFetching={lbQ.isFetching}
      isEmpty={!rows || rows.length === 0}
      emptyText="Brak danych do rankingu."
      onRetry={() => lbQ.refetch()}
      skeletonRows={5}
    >
      <section>
        <ol className="space-y-2">
          {(rows ?? []).map((r, idx) => {
            const isMe = r.user_id === myId;
            return (
              <li
                key={r.user_id}
                className={`bg-card border rounded-2xl p-3 flex items-center gap-3 ${
                  isMe ? "border-tomato" : "border-border"
                }`}
              >
                <span
                  className={`w-7 h-7 grid place-items-center rounded-full text-xs font-bold ${
                    idx === 0
                      ? "bg-yellow-400 text-navy"
                      : idx === 1
                        ? "bg-gray-300 text-navy"
                        : idx === 2
                          ? "bg-orange-400 text-navy"
                          : "bg-muted text-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                <AvatarLink
                  username={r.username}
                  avatarUrl={r.avatar_url}
                  displayName={r.display_name}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {r.display_name || `@${r.username}`}{" "}
                    {isMe && <span className="text-tomato text-xs">(Ty)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.reviews_count} recenzji · {r.achievements_count} odznak
                  </div>
                </div>
                <div className="font-display text-lg text-tomato">{r.points_total}</div>
              </li>
            );
          })}
        </ol>
      </section>
    </AsyncState>
  );
}

/* ============================================================
 * BLOCKED TAB
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
