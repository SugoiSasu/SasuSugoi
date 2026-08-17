import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlogComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function usePostComments(postId: string | undefined) {
  return useQuery({
    queryKey: ["blog-comments", postId],
    enabled: !!postId,
    queryFn: async (): Promise<BlogComment[]> => {
      const { data, error } = await supabase
        .from("blog_comments")
        .select("*")
        .eq("post_id", postId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const comments = (data ?? []) as BlogComment[];
      if (comments.length === 0) return comments;
      const ids = Array.from(new Set(comments.map((c) => c.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return comments.map((c) => ({
        ...c,
        author: byId.get(c.user_id) ?? null,
      }));
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Musisz być zalogowany, żeby komentować.");
      const { error } = await supabase
        .from("blog_comments")
        .insert({ post_id: postId, user_id: user.id, content: content.trim() });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["blog-comments", vars.postId] }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; postId: string }) => {
      const { error } = await supabase.from("blog_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["blog-comments", vars.postId] }),
  });
}
