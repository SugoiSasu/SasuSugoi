import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { usePostBySlug } from "@/lib/posts-api";
import { usePostComments, useAddComment, useDeleteComment } from "@/lib/blog-comments-api";
import { useUser, useIsAdmin } from "@/lib/use-auth";
import { ArrowLeft, Clock, Loader2, MessageCircle, Trash2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { SmartText } from "@/components/SmartText";
import { supabase } from "@/integrations/supabase/client";
import { readingTimeLabel } from "@/lib/reading-time";
import { Skeleton } from "@/components/ui/skeleton";

function clamp(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("title,excerpt,cover_image_url,published_at,updated_at")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();
    return { post: data };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post ?? null;
    const baseTitle = post?.title ?? params.slug;
    const title = clamp(`${baseTitle} — Blog poŻeramy`, 60);
    const fallbackDesc = `Wpis na blogu poŻeramy — recenzje restauracji i miejscówek z Poznania, łyżka po łyżce.`;
    const description = clamp(post?.excerpt?.trim() || fallbackDesc, 160);
    const url = `https://pozeramy.live/blog/${params.slug}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
    ];
    if (post?.cover_image_url) {
      meta.push({ property: "og:image", content: post.cover_image_url });
      meta.push({ name: "twitter:image", content: post.cover_image_url });
    }
    const scripts = post
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: post.title,
              description: post.excerpt ?? undefined,
              image: post.cover_image_url ? [post.cover_image_url] : undefined,
              datePublished: post.published_at ?? undefined,
              dateModified: post.updated_at ?? undefined,
              mainEntityOfPage: url,
              author: { "@type": "Organization", name: "poŻeramy" },
              publisher: { "@type": "Organization", name: "poŻeramy" },
            }),
          },
        ]
      : undefined;
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  component: BlogPostPage,
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-4">
      <div className="text-center">
        <h1 className="font-display text-4xl mb-2">Wpis nie znaleziony</h1>
        <Link to="/blog" className="text-tomato underline">← Wszystkie wpisy</Link>
      </div>
    </div>
  ),
  errorComponent: () => <div className="min-h-dvh grid place-items-center">Coś poszło nie tak.</div>,
});

function BlogPostSkeleton() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="bg-terrazzo-navy text-cream py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Skeleton className="h-9 w-40 rounded-full mb-4" />
          <div className="flex flex-wrap gap-2 mb-3">
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-11 sm:h-14 w-11/12 mb-3" />
          <Skeleton className="h-11 sm:h-14 w-2/3 mb-4" />
          <Skeleton className="h-5 w-full max-w-lg mb-4" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 -mt-8">
        <Skeleton className="w-full aspect-[16/9] rounded-3xl" />
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </main>
  );
}

function BlogPostPage() {
  const { slug } = Route.useParams();
  const { data: post, isLoading, isError } = usePostBySlug(slug);

  if (isLoading) return <BlogPostSkeleton />;
  if (isError || !post) throw notFound();

  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <div className="bg-terrazzo-navy text-cream py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-4"><BackButton to="/blog" label="Wszystkie wpisy" /></div>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {post.tags.map((t) => (
                <span key={t} className="chip bg-tomato text-cream">{t}</span>
              ))}
            </div>
          )}
          <SmartText as="h1" className="text-4xl sm:text-5xl leading-tight">{post.title}</SmartText>
          {post.excerpt && <p className="text-cream/80 text-lg mt-4">{post.excerpt}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wider font-bold text-blush">
            {post.published_at && (
              <span>
                {new Date(post.published_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-cream/70 normal-case tracking-normal font-medium">
              <Clock size={12} /> {readingTimeLabel(post.content_md)}
            </span>
          </div>
        </div>
      </div>

      {post.cover_image_url && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 -mt-8">
          <img src={post.cover_image_url} alt={post.title} className="w-full rounded-3xl shadow-2xl" />
        </div>
      )}

      <article
        className="mx-auto max-w-3xl px-4 sm:px-6 py-12 prose prose-neutral prose-headings:font-display prose-a:text-tomato prose-img:rounded-2xl prose-img:shadow-lg prose-blockquote:border-tomato prose-blockquote:text-foreground/80 max-w-none"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content_md}</ReactMarkdown>
      </article>

      <Comments postId={post.id} />
    </main>
  );
}

function Comments({ postId }: { postId: string }) {
  const { user } = useUser();
  const { data: isAdmin } = useIsAdmin();
  const { data: comments, isLoading } = usePostComments(postId);
  const add = useAddComment();
  const del = useDeleteComment();
  const [text, setText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await add.mutateAsync({ postId, content: text });
      setText("");
      toast.success("Komentarz dodany");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć komentarz?")) return;
    try {
      await del.mutateAsync({ id, postId });
      toast.success("Usunięto");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd");
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-20">
      <div className="border-t border-border pt-10">
        <h2 className="font-display text-2xl flex items-center gap-2 mb-6">
          <MessageCircle size={20} className="text-tomato" />
          Komentarze {comments && comments.length > 0 && <span className="text-base text-muted-foreground">({comments.length})</span>}
        </h2>

        {user ? (
          <form onSubmit={handleSubmit} className="mb-8">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Co o tym myślisz?"
              rows={3}
              maxLength={2000}
              className="w-full input"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">{text.length}/2000</span>
              <button
                type="submit"
                disabled={add.isPending || !text.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2 font-semibold hover:bg-tomato/90 transition disabled:opacity-50"
              >
                {add.isPending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Dodaj komentarz
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 text-center mb-8">
            <p className="text-muted-foreground mb-3">Zaloguj się, żeby komentować i zdobywać punkty poŻarcia.</p>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2 font-semibold">
              Zaloguj się
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="animate-spin" size={24} /></div>
        ) : comments && comments.length > 0 ? (
          <ul className="space-y-4">
            {comments.map((c) => {
              const name = c.author?.display_name || c.author?.username || "Anonim";
              const canDelete = user?.id === c.user_id || isAdmin;
              const username = c.author?.username ?? null;
              const avatar = c.author?.avatar_url ? (
                <img src={c.author.avatar_url} alt={name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-tomato/20 grid place-items-center text-tomato font-bold">
                  {name[0]?.toUpperCase() ?? "?"}
                </div>
              );
              return (
                <li key={c.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    {username ? (
                      <Link to="/u/$username" params={{ username }} className="shrink-0 hover:opacity-80 transition">{avatar}</Link>
                    ) : avatar}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {username ? (
                          <Link to="/u/$username" params={{ username }} className="font-semibold hover:text-tomato transition">{name}</Link>
                        ) : (
                          <div className="font-semibold">{name}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("pl-PL", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{c.content}</p>
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Usuń"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-center text-muted-foreground py-8">Brak komentarzy. Bądź pierwszy!</p>
        )}
      </div>
    </section>
  );
}
