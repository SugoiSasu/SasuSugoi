import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Loader2,
  Star,
  Heart,
  Trophy,
  Megaphone,
  UserPlus,
  LogIn,
  MessageCircle,
  Send,
} from "lucide-react";
import { useWallFeed, type WallItem } from "@/lib/wall-api";
import { UserAvatar } from "@/components/UserAvatar";
import { SmartText } from "@/components/SmartText";
import { ReviewSocial } from "@/components/ReviewSocial";
import { useUser } from "@/lib/use-auth";
import {
  REACTION_TYPES,
  REACTION_EMOJI,
  type ReactionType,
  usePostReactions,
  useToggleReaction,
  usePostComments,
  useAddPostComment,
} from "@/lib/post-social-api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { vipNameStyle } from "@/components/VipBadge";

export const Route = createFileRoute("/wall")({
  head: () => ({
    meta: [
      { title: "Pożeralnia — poŻeramy" },
      {
        name: "description",
        content:
          "Aktywność znajomych, nowinki z Twoich ulubionych miejscówek i komunikaty od lokali.",
      },
    ],
  }),
  component: WallPage,
});

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "przed chwilą";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h temu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} dni temu`;
  return new Date(iso).toLocaleDateString("pl-PL");
}

function WallPage() {
  const { user, loading: authLoading } = useUser();
  return (
    <main id="main-content" className="min-h-dvh bg-background py-6 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl mb-1">Pożeralnia</h1>
          <p className="text-sm text-muted-foreground">
            Aktywność znajomych, nowinki z Twoich ulubionych miejscówek i komunikaty od lokali.
          </p>
        </header>
        {authLoading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="animate-spin" />
          </div>
        ) : !user ? (
          <SignedOutTeaser />
        ) : (
          <SignedInFeed />
        )}
      </div>
    </main>
  );
}

function SignedOutTeaser() {
  return (
    <div className="bg-card border border-border rounded-3xl p-8 text-center">
      <Megaphone className="mx-auto text-tomato mb-3" size={36} />
      <h2 className="font-display text-2xl mb-2">Zaloguj się, żeby zobaczyć feed</h2>
      <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
        Pożeralnia pokazuje recenzje znajomych, ich nowe ulubione miejscówki, zdobyte odznaki i
        aktualności z lokali, które obserwujesz.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-bold hover:bg-tomato/90"
        >
          <LogIn size={16} /> Zaloguj się
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-5 py-2.5 font-semibold hover:border-tomato"
        >
          Przeglądaj mapę
        </Link>
      </div>
    </div>
  );
}

function SignedInFeed() {
  const { data, isLoading } = useWallFeed();
  if (isLoading) {
    return (
      <ul className="space-y-3" aria-busy="true" aria-live="polite">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="bg-card border border-border rounded-3xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2 w-1/5" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (!data || data.length === 0) return <EmptyWall />;
  return (
    <ul className="space-y-3">
      {data.map((it) => (
        <FeedCard key={it.id} item={it} />
      ))}
    </ul>
  );
}

function EmptyWall() {
  return (
    <div className="bg-card border border-dashed border-border rounded-3xl p-8 text-center">
      <Megaphone className="mx-auto text-muted-foreground mb-3" size={32} />
      <h2 className="font-display text-xl mb-2">Cisza jak makiem zasiał</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Dodaj znajomych albo polub kilka lokali, a tutaj zacznie się dziać.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Link to="/friends" className="chip bg-tomato text-cream hover:bg-tomato/90">
          <UserPlus size={12} /> Szukaj znajomych
        </Link>
        <Link to="/" hash="mapa" className="chip bg-card border border-border hover:border-tomato">
          Mapa lokali
        </Link>
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: WallItem }) {
  const author = item.author;
  return (
    <li className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-2">
        {item.kind === "place_post" ? (
          <div className="grid place-items-center w-9 h-9 rounded-full bg-tomato/10 text-tomato">
            <Megaphone size={16} />
          </div>
        ) : (
          <UserAvatar
            avatarUrl={author?.avatar_url}
            avatarSource={author?.avatar_source}
            displayName={author?.display_name}
            username={author?.username}
            size={36}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">
            <HeaderLine item={item} />
          </div>
          <div className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</div>
        </div>
        <KindBadge kind={item.kind} />
      </div>
      {item.kind === "review" && (
        <div className="text-sm">
          {typeof item.rating === "number" && (
            <div className="flex items-center gap-1 text-tomato mb-1">
              <Star size={14} className="fill-current" />{" "}
              <span className="font-semibold">{item.rating}/5</span>
            </div>
          )}
          {item.text && <SmartText>{item.text}</SmartText>}
        </div>
      )}
      {item.kind === "place_post" && (
        <div className="text-sm">
          {item.meta && <div className="font-semibold mb-1">{item.meta}</div>}
          {item.text && <SmartText>{item.text}</SmartText>}
        </div>
      )}
      {item.image_url && (
        <img
          src={item.image_url}
          alt=""
          className="mt-3 w-full max-h-72 object-cover rounded-xl"
          loading="lazy"
        />
      )}
      {item.kind === "review" && <ReviewSocial reviewId={item.id.replace(/^review-/, "")} />}
      {item.kind === "place_post" && <PostSocial postId={item.id.replace(/^pp-/, "")} />}
    </li>
  );
}

function PostSocial({ postId }: { postId: string }) {
  const { user } = useUser();
  const { data: reactions } = usePostReactions(postId);
  const toggle = useToggleReaction(postId);
  const { data: comments } = usePostComments(postId);
  const add = useAddPostComment(postId);
  const [text, setText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const myReaction = user
    ? (reactions ?? []).find((r) => r.user_id === user.id)?.reaction_type
    : undefined;

  const counts: Record<string, number> = {};
  (reactions ?? []).forEach((r) => (counts[r.reaction_type] = (counts[r.reaction_type] ?? 0) + 1));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v || !user) return;
    try {
      await add.mutateAsync(v);
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się dodać komentarza");
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {REACTION_TYPES.map((t) => {
          const active = myReaction === t;
          return (
            <button
              key={t}
              onClick={() => {
                if (!user) {
                  toast.error("Zaloguj się, żeby reagować");
                  return;
                }
                toggle.mutate(t as ReactionType);
              }}
              className={`pz-reaction-pop chip text-sm ${active ? "bg-tomato text-cream" : "bg-card border border-border hover:border-tomato"}`}
              aria-pressed={active}
              aria-label={`Reakcja ${t}`}
            >
              <span>{REACTION_EMOJI[t as ReactionType]}</span>
              {counts[t] ? <span className="text-xs font-semibold">{counts[t]}</span> : null}
            </button>
          );
        })}
        <button
          onClick={() => setShowComments((s) => !s)}
          className="chip bg-card border border-border hover:border-tomato text-sm"
          aria-expanded={showComments}
        >
          <MessageCircle size={12} /> {comments?.length ?? 0}
        </button>
      </div>
      {showComments && (
        <div className="space-y-2">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-sm">
              <UserAvatar
                avatarUrl={c.author?.avatar_url}
                avatarSource={
                  (c.author?.avatar_source ?? "initials") as "google" | "upload" | "initials"
                }
                displayName={c.author?.display_name}
                username={c.author?.username}
                size={24}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={vipNameStyle(c.author)}>
                  {c.author?.display_name ||
                    (c.author?.username ? `@${c.author.username}` : "Anonim")}
                </div>
                <SmartText>{c.body}</SmartText>
              </div>
            </div>
          ))}
          {user ? (
            <form onSubmit={submit} className="flex items-center gap-2 pt-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Napisz komentarz…"
                maxLength={500}
                className="flex-1 rounded-full bg-background border border-border px-3 py-1.5 text-sm outline-none focus:border-tomato"
              />
              <button
                type="submit"
                disabled={!text.trim() || add.isPending}
                className="rounded-full bg-tomato text-cream w-11 h-11 grid place-items-center disabled:opacity-50"
                aria-label="Wyślij komentarz"
              >
                <Send size={14} />
              </button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">Zaloguj się, żeby komentować.</p>
          )}
        </div>
      )}
    </div>
  );
}

function HeaderLine({ item }: { item: WallItem }) {
  const a = item.author;
  const authorName = a?.display_name || (a?.username ? `@${a.username}` : "Znajomy");
  const authorLink = a?.username ? (
    <Link
      to="/u/$username"
      params={{ username: a.username }}
      className="hover:text-tomato"
      style={vipNameStyle(a)}
    >
      {authorName}
    </Link>
  ) : (
    <span style={vipNameStyle(a)}>{authorName}</span>
  );
  const placeLink = item.place ? (
    <Link
      to="/k/$id"
      params={{ id: item.place.slug ?? item.place.id }}
      className="hover:text-tomato"
    >
      {item.place.name}
    </Link>
  ) : null;
  if (item.kind === "review")
    return (
      <>
        {authorLink} ocenił(a) <strong>{placeLink}</strong>
      </>
    );
  if (item.kind === "favorite")
    return (
      <>
        {authorLink} dodał(a) <strong>{placeLink}</strong> do ulubionych
      </>
    );
  if (item.kind === "achievement")
    return (
      <>
        {authorLink} zdobył(a) odznakę <strong>{item.meta}</strong>
      </>
    );
  if (item.kind === "place_post")
    return (
      <>
        <strong>{placeLink}</strong> ma nowy wpis
      </>
    );
  return null;
}

function KindBadge({ kind }: { kind: WallItem["kind"] }) {
  const map = {
    review: {
      icon: <Star size={11} />,
      label: "Recenzja",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    favorite: { icon: <Heart size={11} />, label: "Ulubione", cls: "bg-pink-500/10 text-pink-500" },
    achievement: {
      icon: <Trophy size={11} />,
      label: "Odznaka",
      cls: "bg-purple-500/10 text-purple-500",
    },
    place_post: {
      icon: <Megaphone size={11} />,
      label: "Wpis lokalu",
      cls: "bg-tomato/10 text-tomato",
    },
  } as const;
  const m = map[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m.cls}`}
    >
      {m.icon} {m.label}
    </span>
  );
}
