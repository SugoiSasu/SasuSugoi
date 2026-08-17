import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PostStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  cover_image_url: string | null;
  tags: string[];
  status: PostStatus;
  place_id: string | null;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PostInput = {
  slug: string;
  title: string;
  excerpt?: string | null;
  content_md: string;
  cover_image_url?: string | null;
  tags: string[];
  status: PostStatus;
  place_id?: string | null;
  published_at?: string | null;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function usePublishedPosts(limit?: number) {
  return useQuery({
    queryKey: ["posts", "published", limit ?? null],
    queryFn: async (): Promise<BlogPost[]> => {
      let q = supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BlogPost[];
    },
  });
}

export function usePostBySlug(slug: string) {
  return useQuery({
    queryKey: ["post", "slug", slug],
    queryFn: async (): Promise<BlogPost | null> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as BlogPost | null;
    },
  });
}

export function useAllPostsAdmin() {
  return useQuery({
    queryKey: ["posts", "admin"],
    queryFn: async (): Promise<BlogPost[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlogPost[];
    },
  });
}

export function usePostById(id: string | undefined) {
  return useQuery({
    queryKey: ["post", "id", id],
    enabled: !!id,
    queryFn: async (): Promise<BlogPost | null> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as BlogPost | null;
    },
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: PostInput }) => {
      const cleanCover = values.cover_image_url?.trim() ? values.cover_image_url.trim() : null;
      const cleanExcerpt = values.excerpt?.trim() ? values.excerpt.trim() : null;
      const payload = {
        ...values,
        cover_image_url: cleanCover,
        excerpt: cleanExcerpt,
        published_at:
          values.status === "published"
            ? values.published_at ?? new Date().toISOString()
            : null,
      };
      if (id) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", id);
        if (error) throw new Error(error.message);
        return id;
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Musisz być zalogowany, żeby dodać wpis.");
        const { data, error } = await supabase
          .from("blog_posts")
          .insert({ ...payload, author_id: user.id })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return data.id as string;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["post"] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
