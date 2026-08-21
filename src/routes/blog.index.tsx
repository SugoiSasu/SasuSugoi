import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { usePublishedPosts } from "@/lib/posts-api";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { SmartText } from "@/components/SmartText";
import { readingTimeLabel } from "@/lib/reading-time";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog - poŻeramy" },
      { name: "description", content: "Recenzje, gastro-tripy i kulisy z Poznania - blog poŻeramy." },
      { property: "og:title", content: "Blog - poŻeramy" },
      { property: "og:description", content: "Recenzje, gastro-tripy i kulisy z Poznania." },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const { data: posts, isLoading } = usePublishedPosts();

  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <div className="bg-terrazzo-navy text-cream py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-4"><BackButton to="/" label="Strona główna" /></div>
          <span className="chip bg-tomato text-cream mb-3">Blog</span>
          <h1 className="font-display text-5xl sm:text-6xl">Recenzje, gastro-tripy, kulisy</h1>
          <p className="text-cream/80 mt-3 max-w-2xl">Wszystko, co nie zmieściło się w rolce na Instagramie.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-live="polite">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl overflow-hidden bg-card border border-border">
                <Skeleton className="aspect-[5/3] rounded-none" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-11/12" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p) => (
              <Link
                key={p.id}
                to="/blog/$slug" params={{ slug: p.slug }}
                className="group block rounded-3xl overflow-hidden bg-card border border-border card-hover"
              >
                {p.cover_image_url ? (
                  <div className="aspect-[5/3] overflow-hidden bg-muted">
                    <img src={p.cover_image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  </div>
                ) : (
                  <div className="aspect-[5/3] bg-terrazzo-navy" />
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {p.tags.length > 0 ? (
                      <div className="text-xs uppercase tracking-wider font-bold text-tomato">{p.tags[0]}</div>
                    ) : <span />}
                    <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock size={12} /> {readingTimeLabel(p.excerpt ?? p.title)}
                    </div>
                  </div>
                  <SmartText as="h2" className="text-xl mb-2 leading-tight">{p.title}</SmartText>
                  {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>}
                  <div className="mt-4 text-sm font-semibold text-tomato inline-flex items-center gap-1">
                    Czytaj <ArrowRight size={14} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            Jeszcze nie ma wpisów. Wróć za chwilę 🍕
          </div>
        )}
      </div>
    </main>
  );
}
