import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
}

export interface FriendProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: "google" | "upload" | "initials";
  is_vip: boolean;
  vip_until: string | null;
  vip_nick_color: string | null;
}

export function useFriendsCount(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["friends-count", userId ?? null],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_friends_count", { _user_id: userId! });
      if (error) throw error;
      return Number(data) || 0;
    },
  });
}

export function useMyFriendships() {
  return useQuery({
    queryKey: ["my-friendships"],
    queryFn: async (): Promise<Friendship[]> => {
      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Friendship[];
    },
  });
}

export function useFriendProfiles(myId: string | null | undefined) {
  return useQuery({
    queryKey: ["friend-profiles", myId ?? null],
    enabled: !!myId,
    queryFn: async (): Promise<FriendProfile[]> => {
      const { data: fs, error } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted");
      if (error) throw error;
      const ids = (fs ?? [])
        .map((f) => (f.requester_id === myId ? f.addressee_id : f.requester_id))
        .filter((id): id is string => !!id);
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
        )
        .in("id", ids);
      if (pErr) throw pErr;
      return (profiles ?? []) as FriendProfile[];
    },
  });
}

export function useUserFriendProfiles(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["user-friend-profiles", userId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<FriendProfile[]> => {
      const { data: rows, error } = await supabase.rpc("friends_of", { _user: userId! });
      if (error) throw error;
      const ids = (rows ?? []).map((r: { friend_id: string }) => r.friend_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
        )
        .in("id", ids);
      if (pErr) throw pErr;
      return (profiles ?? []) as FriendProfile[];
    },
  });
}

export function useFriendshipWith(otherUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["friendship-with", otherUserId ?? null],
    enabled: !!otherUserId,
    queryFn: async (): Promise<Friendship | null> => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return null;
      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(requester_id.eq.${me.user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${me.user.id})`,
        )
        .maybeSingle();
      if (error) throw error;
      return (data as Friendship) ?? null;
    },
  });
}

export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (toUserId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      const { error } = await supabase
        .from("friendships")
        .insert({ requester_id: me.user.id, addressee_id: toUserId });
      if (error) throw error;
    },
    onSuccess: (_d, toUserId) => {
      qc.invalidateQueries({ queryKey: ["friendship-with", toUserId] });
      qc.invalidateQueries({ queryKey: ["my-friendships"] });
      qc.invalidateQueries({ queryKey: ["friends-count"] });
    },
  });
}

export function useRespondToFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted", responded_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("friendships").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-friendships"] });
      qc.invalidateQueries({ queryKey: ["friendship-with"] });
      qc.invalidateQueries({ queryKey: ["friends-count"] });
      qc.invalidateQueries({ queryKey: ["friend-profiles"] });
    },
  });
}

export function useRemoveFriendship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-friendships"] });
      qc.invalidateQueries({ queryKey: ["friendship-with"] });
      qc.invalidateQueries({ queryKey: ["friends-count"] });
      qc.invalidateQueries({ queryKey: ["friend-profiles"] });
    },
  });
}

/* ============================================================
 * Favorites
 * ============================================================ */
export function useFriendFavorites() {
  return useQuery({
    queryKey: ["friend-favorites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("friend_favorites").select("friend_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.friend_id as string));
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ friendId, on }: { friendId: string; on: boolean }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      if (on) {
        const { error } = await supabase
          .from("friend_favorites")
          .insert({ user_id: me.user.id, friend_id: friendId });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("friend_favorites")
          .delete()
          .eq("user_id", me.user.id)
          .eq("friend_id", friendId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friend-favorites"] }),
  });
}

/* ============================================================
 * Lists / groups
 * ============================================================ */
export interface FriendList {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export function useFriendLists() {
  return useQuery({
    queryKey: ["friend-lists"],
    queryFn: async (): Promise<FriendList[]> => {
      const { data, error } = await supabase.from("friend_lists").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as FriendList[];
    },
  });
}

export function useFriendListMembers(listId: string | null) {
  return useQuery({
    queryKey: ["friend-list-members", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friend_list_members")
        .select("friend_id")
        .eq("list_id", listId!);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.friend_id as string));
    },
  });
}

export function useCreateFriendList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string; icon?: string }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      const { error } = await supabase
        .from("friend_lists")
        .insert({ user_id: me.user.id, name: input.name, color: input.color, icon: input.icon });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friend-lists"] }),
  });
}

export function useDeleteFriendList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friend_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friend-lists"] }),
  });
}

export function useToggleListMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      listId,
      friendId,
      on,
    }: {
      listId: string;
      friendId: string;
      on: boolean;
    }) => {
      if (on) {
        const { error } = await supabase
          .from("friend_list_members")
          .insert({ list_id: listId, friend_id: friendId });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("friend_list_members")
          .delete()
          .eq("list_id", listId)
          .eq("friend_id", friendId);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["friend-list-members", vars.listId] }),
  });
}

/* ============================================================
 * Notes
 * ============================================================ */
export function useFriendNote(friendId: string | null) {
  return useQuery({
    queryKey: ["friend-note", friendId],
    enabled: !!friendId,
    queryFn: async (): Promise<string> => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return "";
      const { data, error } = await supabase
        .from("friend_notes")
        .select("note")
        .eq("user_id", me.user.id)
        .eq("friend_id", friendId!)
        .maybeSingle();
      if (error) throw error;
      return data?.note ?? "";
    },
  });
}

export function useSetFriendNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ friendId, note }: { friendId: string; note: string }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      const { error } = await supabase.from("friend_notes").upsert({
        user_id: me.user.id,
        friend_id: friendId,
        note,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["friend-note", v.friendId] }),
  });
}

/* ============================================================
 * Blocking
 * ============================================================ */
export function useBlockedUsers() {
  return useQuery({
    queryKey: ["blocked-users"],
    queryFn: async (): Promise<FriendProfile[]> => {
      const { data: blocks, error } = await supabase.from("user_blocks").select("blocked_id");
      if (error) throw error;
      const ids = (blocks ?? []).map((b) => b.blocked_id as string);
      if (ids.length === 0) return [];
      const { data, error: pErr } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
        )
        .in("id", ids);
      if (pErr) throw pErr;
      return (data ?? []) as FriendProfile[];
    },
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      const { error } = await supabase
        .from("user_blocks")
        .insert({ blocker_id: me.user.id, blocked_id: blockedId });
      if (error && !String(error.message).includes("duplicate")) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked-users"] });
      qc.invalidateQueries({ queryKey: ["my-friendships"] });
      qc.invalidateQueries({ queryKey: ["friend-profiles"] });
      qc.invalidateQueries({ queryKey: ["friends-count"] });
    },
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", me.user.id)
        .eq("blocked_id", blockedId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked-users"] }),
  });
}

/* ============================================================
 * Invites (link / email / QR)
 * ============================================================ */
export interface FriendInvite {
  id: string;
  token: string;
  email: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  accepted_by: string | null;
  expires_at: string;
  created_at: string;
}

export function useMyInvites(enabled = true) {
  return useQuery({
    queryKey: ["friend-invites"],
    enabled,
    queryFn: async (): Promise<FriendInvite[]> => {
      const { data, error } = await supabase
        .from("friend_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FriendInvite[];
    },
  });
}

function randomToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email?: string): Promise<FriendInvite> => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      const token = randomToken();
      const { data, error } = await supabase
        .from("friend_invites")
        .insert({ inviter_id: me.user.id, token, email: email || null })
        .select("*")
        .single();
      if (error) throw error;
      return data as FriendInvite;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friend-invites"] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("friend_invites")
        .update({ status: "revoked" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friend-invites"] }),
  });
}

const ACCEPT_INVITE_ERROR_MESSAGES: Record<string, string> = {
  invite_not_found: "Nie znaleźliśmy tego zaproszenia. Może link jest niepoprawny?",
  invite_used: "To zaproszenie zostało już wykorzystane.",
  invite_expired: "To zaproszenie już wygasło.",
  cannot_invite_self: "To Twój własny link zaproszenia - wyślij go znajomym!",
  blocked: "Nie można dołączyć do znajomych w tym przypadku.",
};

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("accept_friend_invite", { _token: token });
      if (error) {
        throw new Error(ACCEPT_INVITE_ERROR_MESSAGES[error.message] ?? "Nie udało się przyjąć zaproszenia.");
      }
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-friendships"] });
      qc.invalidateQueries({ queryKey: ["friend-profiles"] });
      qc.invalidateQueries({ queryKey: ["friend-leaderboard"] });
      qc.invalidateQueries({ queryKey: ["user-achievements"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export interface InvitePreview {
  inviter_display_name: string | null;
  inviter_username: string | null;
  inviter_avatar_url: string | null;
  status: string;
  expired: boolean;
}

/** Public preview of an invite (inviter identity + status) - safe to show
 * before the visitor logs in, so they know who invited them. */
export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ["invite-preview", token ?? null],
    enabled: !!token,
    queryFn: async (): Promise<InvitePreview | null> => {
      const { data, error } = await supabase.rpc("get_invite_preview", { _token: token! });
      if (error) throw error;
      return (data?.[0] as InvitePreview | undefined) ?? null;
    },
  });
}

/** Get-or-create the caller's active (pending, non-expired) invite link - * reuses an existing one from useMyInvites rather than minting a new token
 * every time the sidebar share button is opened. */
export function useMyInviteLink(userId: string | null | undefined) {
  const invites = useMyInvites(!!userId);
  const create = useCreateInvite();
  const active = (invites.data ?? []).find(
    (i) => i.status === "pending" && new Date(i.expires_at).getTime() > Date.now(),
  );

  return {
    token: active?.token,
    isLoading: invites.isLoading,
    ensure: async (): Promise<string> => {
      if (active?.token) return active.token;
      const created = await create.mutateAsync(undefined);
      return created.token;
    },
  };
}

export interface AcceptedInviteRow {
  inviteId: string;
  acceptedAt: string | null;
  points: number;
  profile: FriendProfile | null;
}

export interface InviteStats {
  sent: number;
  accepted: number;
  totalPoints: number;
  acceptedList: AcceptedInviteRow[];
}

/** Stats for the invites I've sent: how many, how many accepted, points earned,
 * and who joined via my link - surfaced on /friends so invites feel tracked. */
export function useInviteStats() {
  return useQuery({
    queryKey: ["invite-stats"],
    queryFn: async (): Promise<InviteStats> => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return { sent: 0, accepted: 0, totalPoints: 0, acceptedList: [] };

      const { data: invites, error } = await supabase
        .from("friend_invites")
        .select("id, accepted_by, accepted_at, status")
        .eq("inviter_id", me.user.id);
      if (error) throw error;

      const acceptedRows = (invites ?? []).filter(
        (i): i is typeof i & { accepted_by: string } => i.status === "accepted" && !!i.accepted_by,
      );

      const profileIds = Array.from(new Set(acceptedRows.map((i) => i.accepted_by)));
      let profilesById = new Map<string, FriendProfile>();
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
          )
          .in("id", profileIds);
        profilesById = new Map((profiles ?? []).map((p) => [p.id, p as FriendProfile]));
      }

      const inviteIds = acceptedRows.map((i) => i.id);
      let pointsByInvite = new Map<string, number>();
      if (inviteIds.length > 0) {
        const { data: txns } = await supabase
          .from("points_transactions")
          .select("ref_id, points")
          .eq("event_key", "invite_accepted")
          .in("ref_id", inviteIds);
        pointsByInvite = new Map((txns ?? []).map((t) => [t.ref_id as string, t.points as number]));
      }

      const acceptedList: AcceptedInviteRow[] = acceptedRows
        .map((i) => ({
          inviteId: i.id,
          acceptedAt: i.accepted_at,
          points: pointsByInvite.get(i.id) ?? 0,
          profile: profilesById.get(i.accepted_by) ?? null,
        }))
        .sort((a, b) => (b.acceptedAt ?? "").localeCompare(a.acceptedAt ?? ""));

      return {
        sent: (invites ?? []).length,
        accepted: acceptedRows.length,
        totalPoints: acceptedList.reduce((sum, r) => sum + r.points, 0),
        acceptedList,
      };
    },
  });
}

/* ============================================================
 * Friend activity feed + leaderboard
 * ============================================================ */
export interface FriendFeedItem {
  kind: string;
  review_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  place_id: string;
  place_name: string;
  place_slug: string;
  rating: number;
  body: string | null;
  photo_url: string | null;
  created_at: string;
}

export function useFriendFeed(limit = 20, before?: string) {
  return useQuery({
    queryKey: ["friend-feed", limit, before ?? null],
    queryFn: async (): Promise<FriendFeedItem[]> => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return [];
      const args: { _user: string; _limit: number; _before?: string } = {
        _user: me.user.id,
        _limit: limit,
      };
      if (before) args._before = before;
      const { data, error } = await supabase.rpc("friend_activity_feed", args);
      if (error) throw error;
      return (data ?? []) as FriendFeedItem[];
    },
  });
}

export interface FriendLeaderRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  points_total: number;
  reviews_count: number;
  achievements_count: number;
}

export function useFriendLeaderboard() {
  return useQuery({
    queryKey: ["friend-leaderboard"],
    queryFn: async (): Promise<FriendLeaderRow[]> => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return [];
      const { data, error } = await supabase.rpc("friend_leaderboard", { _user: me.user.id });
      if (error) throw error;
      return (data ?? []) as FriendLeaderRow[];
    },
  });
}

/* ============================================================
 * Reactions and comments on reviews
 * ============================================================ */
export function useReviewReactions(reviewId: string) {
  return useQuery({
    queryKey: ["review-reactions", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_reactions")
        .select("user_id, type")
        .eq("review_id", reviewId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      type = "like",
      on,
    }: {
      reviewId: string;
      type?: string;
      on: boolean;
    }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      if (on) {
        const { error } = await supabase
          .from("review_reactions")
          .insert({ review_id: reviewId, user_id: me.user.id, type });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("review_reactions")
          .delete()
          .eq("review_id", reviewId)
          .eq("user_id", me.user.id)
          .eq("type", type);
        if (error) throw error;
      }
    },
    onMutate: async ({ reviewId, type = "like", on }) => {
      const key = ["review-reactions", reviewId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Array<{ user_id: string; type: string }>>(key);
      const { data: me } = await supabase.auth.getUser();
      const myId = me.user?.id;
      if (myId) {
        const current = previous ?? [];
        const next = on
          ? current.some((r) => r.user_id === myId && r.type === type)
            ? current
            : [...current, { user_id: myId, type }]
          : current.filter((r) => !(r.user_id === myId && r.type === type));
        qc.setQueryData(key, next);
      }
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ["review-reactions", v.reviewId] }),
  });
}

export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    avatar_source: "google" | "upload" | "initials";
    is_vip: boolean;
    vip_until: string | null;
    vip_nick_color: string | null;
  } | null;
}

export function useReviewComments(reviewId: string) {
  return useQuery({
    queryKey: ["review-comments", reviewId],
    queryFn: async (): Promise<ReviewComment[]> => {
      const { data, error } = await supabase
        .from("review_comments")
        .select("*")
        .eq("review_id", reviewId)
        .order("created_at");
      if (error) throw error;
      const rows = (data ?? []) as ReviewComment[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows;
      const { data: authors } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
        )
        .in("id", ids);
      const byId = new Map((authors ?? []).map((a) => [a.id, a as ReviewComment["author"]]));
      return rows.map((r) => ({ ...r, author: byId.get(r.user_id) ?? null }));
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      body,
      _tempId: _t,
    }: {
      reviewId: string;
      body: string;
      _tempId?: string;
    }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      const { error } = await supabase
        .from("review_comments")
        .insert({ review_id: reviewId, user_id: me.user.id, body });
      if (error) throw error;
    },
    onMutate: async ({ reviewId, body }) => {
      const key = ["review-comments", reviewId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ReviewComment[]>(key);
      const { data: me } = await supabase.auth.getUser();
      const myId = me.user?.id;
      if (myId) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimistic: ReviewComment = {
          id: tempId,
          review_id: reviewId,
          user_id: myId,
          body,
          created_at: new Date().toISOString(),
        };
        qc.setQueryData<ReviewComment[]>(key, [...(previous ?? []), optimistic]);
      }
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ["review-comments", v.reviewId] }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reviewId: _r }: { id: string; reviewId: string }) => {
      const { error } = await supabase.from("review_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, reviewId }) => {
      const key = ["review-comments", reviewId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ReviewComment[]>(key);
      qc.setQueryData<ReviewComment[]>(
        key,
        (previous ?? []).filter((c) => c.id !== id),
      );
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ["review-comments", v.reviewId] }),
  });
}

/* ============================================================
 * Review tags ("byliśmy razem")
 * ============================================================ */
export function useReviewTags(reviewId: string) {
  return useQuery({
    queryKey: ["review-tags", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_tags")
        .select("tagged_user_id")
        .eq("review_id", reviewId);
      if (error) throw error;
      return (data ?? []).map((r) => r.tagged_user_id as string);
    },
  });
}

export function useTagFriendsInReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, friendIds }: { reviewId: string; friendIds: string[] }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Nie zalogowano");
      if (friendIds.length === 0) return;
      const rows = friendIds.map((fid) => ({
        review_id: reviewId,
        tagged_user_id: fid,
        tagger_id: me.user!.id,
      }));
      const { error } = await supabase.from("review_tags").insert(rows);
      if (error && !String(error.message).includes("duplicate")) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["review-tags", v.reviewId] }),
  });
}

/* ============================================================
 * Suggestions ("Może znasz")
 * ============================================================ */
export interface Suggestion extends FriendProfile {
  score: number;
  mutuals: number;
  shared_places: number;
}

export function useFriendSuggestions() {
  return useQuery({
    queryKey: ["friend-suggestions"],
    queryFn: async (): Promise<Suggestion[]> => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return [];
      const myId = me.user.id;

      // accepted friends + pending + blocks → exclude
      const { data: fs } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id, status");
      const knownIds = new Set<string>([myId]);
      const friendIds = new Set<string>();
      (fs ?? []).forEach((f) => {
        const other = f.requester_id === myId ? f.addressee_id : f.requester_id;
        if (!other) return;
        knownIds.add(other);
        if (f.status === "accepted") friendIds.add(other);
      });
      const { data: blocks } = await supabase.from("user_blocks").select("blocker_id, blocked_id");
      (blocks ?? []).forEach((b) => {
        knownIds.add(b.blocker_id === myId ? (b.blocked_id as string) : (b.blocker_id as string));
      });

      // mutual friends: friends of my friends
      const mutualMap = new Map<string, number>();
      if (friendIds.size > 0) {
        const { data: fof } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id, status")
          .eq("status", "accepted")
          .or(
            Array.from(friendIds)
              .map((id) => `requester_id.eq.${id},addressee_id.eq.${id}`)
              .join(","),
          );
        (fof ?? []).forEach((f) => {
          [f.requester_id, f.addressee_id].forEach((id) => {
            if (!id || knownIds.has(id as string)) return;
            mutualMap.set(id as string, (mutualMap.get(id as string) ?? 0) + 1);
          });
        });
      }

      // shared places: users who reviewed places I reviewed
      const sharedMap = new Map<string, number>();
      const { data: myReviews } = await supabase
        .from("reviews")
        .select("place_id")
        .eq("user_id", myId);
      const myPlaces = Array.from(new Set((myReviews ?? []).map((r) => r.place_id as string)));
      if (myPlaces.length > 0) {
        const { data: others } = await supabase
          .from("reviews")
          .select("user_id, place_id")
          .in("place_id", myPlaces);
        (others ?? []).forEach((r) => {
          const uid = r.user_id as string;
          if (!uid || knownIds.has(uid)) return;
          sharedMap.set(uid, (sharedMap.get(uid) ?? 0) + 1);
        });
      }

      const candidateIds = new Set<string>([...mutualMap.keys(), ...sharedMap.keys()]);
      if (candidateIds.size === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
        )
        .in("id", Array.from(candidateIds));

      const list: Suggestion[] = (profiles ?? []).map((p) => {
        const mutuals = mutualMap.get(p.id) ?? 0;
        const shared = sharedMap.get(p.id) ?? 0;
        return {
          ...(p as FriendProfile),
          mutuals,
          shared_places: shared,
          score: mutuals * 3 + shared * 2,
        };
      });
      list.sort((a, b) => b.score - a.score);
      return list.slice(0, 20);
    },
  });
}

export interface FriendRecommendation {
  place_id: string;
  slug: string | null;
  name: string;
  cuisine: string | null;
  cover_image_url: string | null;
  avatar_url: string | null;
  avg_rating: number;
  friend_reviews: number;
  latest_at: string;
}

/** Places friends rated >=4★ in the last 60 days. */
export function useFriendRecommendations() {
  return useQuery({
    queryKey: ["friend-recommendations"],
    queryFn: async (): Promise<FriendRecommendation[]> => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return [];
      const { data: fs } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted");
      const friendIds = (fs ?? [])
        .map((f) => (f.requester_id === me.user!.id ? f.addressee_id : f.requester_id))
        .filter((id): id is string => !!id);
      if (friendIds.length === 0) return [];
      const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();
      const { data: revs } = await supabase
        .from("reviews")
        .select("place_id, rating, created_at")
        .in("user_id", friendIds)
        .gte("rating", 4)
        .gte("created_at", sinceIso);
      const map = new Map<string, { sum: number; n: number; latest: string }>();
      (revs ?? []).forEach((r) => {
        const e = map.get(r.place_id) ?? { sum: 0, n: 0, latest: r.created_at };
        e.sum += r.rating;
        e.n += 1;
        if (r.created_at > e.latest) e.latest = r.created_at;
        map.set(r.place_id, e);
      });
      const placeIds = Array.from(map.keys());
      if (placeIds.length === 0) return [];
      const { data: places } = await supabase
        .from("places")
        .select("id, slug, name, cuisine, cover_image_url, avatar_url, is_published")
        .in("id", placeIds);
      const list: FriendRecommendation[] = (places ?? [])
        .filter((p) => p.is_published !== false)
        .map((p) => {
          const s = map.get(p.id)!;
          return {
            place_id: p.id,
            slug: p.slug ?? null,
            name: p.name,
            cuisine: p.cuisine ?? null,
            cover_image_url: (p as { cover_image_url?: string | null }).cover_image_url ?? null,
            avatar_url: (p as { avatar_url?: string | null }).avatar_url ?? null,
            avg_rating: s.sum / s.n,
            friend_reviews: s.n,
            latest_at: s.latest,
          };
        });
      list.sort((a, b) => b.friend_reviews - a.friend_reviews || b.avg_rating - a.avg_rating);
      return list.slice(0, 3);
    },
  });
}
