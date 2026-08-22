import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

/**
 * Generic reactions/comments for wall item kinds that have no dedicated
 * social table of their own ('favorite', 'achievement_group', 'post').
 * 'review' and 'place_post' keep using review-social-api / post-social-api
 * against their own dedicated tables - this is not a replacement for those.
 */
export type WallSocialKind =
  "favorite" | "achievement" | "achievement_group" | "post" | "list" | "challenge_complete";

export const WALL_REACTION_TYPES = ["yum", "must_try", "love"] as const;
export type WallReactionType = (typeof WALL_REACTION_TYPES)[number];

export const WALL_REACTION_EMOJI: Record<WallReactionType, string> = {
  yum: "😋",
  must_try: "🤤",
  love: "❤️",
};
export const WALL_REACTION_LABEL: Record<WallReactionType, string> = {
  yum: "Pyszne",
  must_try: "Muszę spróbować",
  love: "Serducho",
};

export interface WallReaction {
  kind: WallSocialKind;
  ref_id: string;
  user_id: string;
  type: WallReactionType;
  created_at: string;
}

export interface WallComment {
  id: string;
  kind: WallSocialKind;
  ref_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    avatar_source: string | null;
    is_vip: boolean;
    vip_until: string | null;
    vip_nick_color: string | null;
  } | null;
}

export function useWallReactions(kind: WallSocialKind, refId: string | undefined) {
  return useQuery({
    queryKey: ["wall-reactions", kind, refId ?? null],
    enabled: !!refId,
    queryFn: async (): Promise<WallReaction[]> => {
      const { data, error } = await supabase
        .from("wall_reactions")
        .select("*")
        .eq("kind", kind)
        .eq("ref_id", refId!);
      if (error) throw error;
      return (data ?? []) as WallReaction[];
    },
  });
}

export function useToggleWallReaction(kind: WallSocialKind, refId: string) {
  const qc = useQueryClient();
  const { user } = useUser();
  const key = ["wall-reactions", kind, refId];
  return useMutation({
    mutationFn: async (type: WallReactionType) => {
      if (!user) throw new Error("Zaloguj się");
      const { data: existing } = await supabase
        .from("wall_reactions")
        .select("type")
        .eq("kind", kind)
        .eq("ref_id", refId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        if (existing.type === type) {
          const { error } = await supabase
            .from("wall_reactions")
            .delete()
            .eq("kind", kind)
            .eq("ref_id", refId)
            .eq("user_id", user.id)
            .eq("type", existing.type);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("wall_reactions")
            .update({ type })
            .eq("kind", kind)
            .eq("ref_id", refId)
            .eq("user_id", user.id)
            .eq("type", existing.type);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("wall_reactions")
          .insert({ kind, ref_id: refId, user_id: user.id, type });
        if (error) throw error;
      }
    },
    onMutate: async (type: WallReactionType) => {
      if (!user) return;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WallReaction[]>(key) ?? [];
      const mine = prev.find((r) => r.user_id === user.id);
      let next: WallReaction[];
      if (mine) {
        next =
          mine.type === type
            ? prev.filter((r) => r.user_id !== user.id)
            : prev.map((r) => (r.user_id === user.id ? { ...r, type } : r));
      } else {
        next = [
          ...prev,
          { kind, ref_id: refId, user_id: user.id, type, created_at: new Date().toISOString() },
        ];
      }
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useWallComments(kind: WallSocialKind, refId: string | undefined) {
  return useQuery({
    queryKey: ["wall-comments", kind, refId ?? null],
    enabled: !!refId,
    queryFn: async (): Promise<WallComment[]> => {
      const { data, error } = await supabase
        .from("wall_comments")
        .select("*")
        .eq("kind", kind)
        .eq("ref_id", refId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as WallComment[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
          )
          .in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        rows.forEach((r) => (r.author = (map.get(r.user_id) as WallComment["author"]) ?? null));
      }
      return rows;
    },
  });
}

export function useAddWallComment(kind: WallSocialKind, refId: string) {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error("Zaloguj się");
      const { error } = await supabase
        .from("wall_comments")
        .insert({ kind, ref_id: refId, user_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wall-comments", kind, refId] }),
  });
}

export function useUpdateWallComment(kind: WallSocialKind, refId: string) {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      if (!user) throw new Error("Zaloguj się");
      const { error } = await supabase
        .from("wall_comments")
        .update({ body })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wall-comments", kind, refId] }),
  });
}

export function useDeleteWallComment(kind: WallSocialKind, refId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wall_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wall-comments", kind, refId] }),
  });
}
