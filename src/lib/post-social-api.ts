import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export const REACTION_TYPES = ["like", "love", "yum", "wow"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  yum: "😋",
  wow: "🤩",
};

export interface PostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
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

export function usePostReactions(postId: string | undefined) {
  return useQuery({
    queryKey: ["post-reactions", postId ?? null],
    enabled: !!postId,
    queryFn: async (): Promise<PostReaction[]> => {
      const { data, error } = await supabase
        .from("place_post_reactions")
        .select("*")
        .eq("post_id", postId!);
      if (error) throw error;
      return (data ?? []) as PostReaction[];
    },
  });
}

export function useToggleReaction(postId: string) {
  const qc = useQueryClient();
  const { user } = useUser();
  const key = ["post-reactions", postId];
  return useMutation({
    mutationFn: async (type: ReactionType) => {
      if (!user) throw new Error("Zaloguj się");
      const { data: existing } = await supabase
        .from("place_post_reactions")
        .select("id, reaction_type")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        if (existing.reaction_type === type) {
          const { error } = await supabase
            .from("place_post_reactions")
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("place_post_reactions")
            .update({ reaction_type: type })
            .eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("place_post_reactions")
          .insert({ post_id: postId, user_id: user.id, reaction_type: type });
        if (error) throw error;
      }
    },
    onMutate: async (type: ReactionType) => {
      if (!user) return;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PostReaction[]>(key) ?? [];
      const mine = prev.find((r) => r.user_id === user.id);
      let next: PostReaction[];
      if (mine) {
        if (mine.reaction_type === type) {
          next = prev.filter((r) => r.id !== mine.id);
        } else {
          next = prev.map((r) => (r.id === mine.id ? { ...r, reaction_type: type } : r));
        }
      } else {
        next = [
          ...prev,
          {
            id: `optimistic-${Date.now()}`,
            post_id: postId,
            user_id: user.id,
            reaction_type: type,
            created_at: new Date().toISOString(),
          },
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

export function usePostComments(postId: string | undefined) {
  return useQuery({
    queryKey: ["post-comments", postId ?? null],
    enabled: !!postId,
    queryFn: async (): Promise<PostComment[]> => {
      const { data, error } = await supabase
        .from("place_post_comments")
        .select("*")
        .eq("post_id", postId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as PostComment[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, avatar_source, is_vip, vip_until, vip_nick_color",
          )
          .in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        rows.forEach((r) => (r.author = (map.get(r.user_id) as PostComment["author"]) ?? null));
      }
      return rows;
    },
  });
}

export function useAddPostComment(postId: string) {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error("Zaloguj się");
      const { error } = await supabase
        .from("place_post_comments")
        .insert({ post_id: postId, user_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-comments", postId] }),
  });
}

export function useDeletePostComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("place_post_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-comments", postId] }),
  });
}
