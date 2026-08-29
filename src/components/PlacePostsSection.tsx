import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Megaphone,
  Loader2,
  Send,
  MessageSquare,
  Trash2,
  Pencil,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { useIsOwnerOf } from "@/lib/owners-api";
import {
  usePlacePosts,
  useUpsertPlacePost,
  useDeletePlacePost,
  type PlacePost,
  type PlacePostType,
} from "@/lib/place-posts-api";
import {
  usePostReactions,
  useToggleReaction,
  usePostComments,
  useAddPostComment,
  useDeletePostComment,
  REACTION_TYPES,
  REACTION_EMOJI,
  type ReactionType,
} from "@/lib/post-social-api";
import { UserAvatar } from "@/components/UserAvatar";
import { SmartText } from "@/components/SmartText";

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  announcement: { label: "Ogłoszenie", cls: "bg-tomato/10 text-tomato" },
  menu: { label: "Menu", cls: "bg-amber-500/10 text-amber-600" },
  event: { label: "Wydarzenie", cls: "bg-purple-500/10 text-purple-600" },
  promo: { label: "Promocja", cls: "bg-emerald-500/10 text-emerald-600" },
  news: { label: "Nowinka", cls: "bg-sky-500/10 text-sky-600" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "teraz";
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h temu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} dni temu`;
  return new Date(iso).toLocaleDateString("pl-PL");
}

export function PlacePostsSection({ placeId, placeName }: { placeId: string; placeName: string }) {
  const { user } = useUser();
  const { data: isOwner } = useIsOwnerOf(placeId);
  const { data: posts, isLoading } = usePlacePosts(placeId);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<PlacePost | null>(null);

  return (
    <section className="surface mb-6 rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-3 border-b border-border/60">
        <div className="grid place-items-center w-9 h-9 rounded-full bg-tomato/10 text-tomato">
          <Megaphone size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg text-foreground leading-tight">Aktualności lokalu</h2>
          <p className="text-xs text-foreground/60">Ogłoszenia, promocje i nowinki od właściciela</p>
        </div>
        {isOwner && !composerOpen && !editing && (
          <button
            onClick={() => setComposerOpen(true)}
            className="rounded-full bg-tomato text-cream px-3 py-1.5 text-xs font-bold hover:bg-tomato/90"
          >
            + Nowy wpis
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {(composerOpen || editing) && isOwner && (
          <PostComposer
            placeId={placeId}
            initial={editing}
            onClose={() => {
              setComposerOpen(false);
              setEditing(null);
            }}
          />
        )}

        {isLoading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="animate-spin text-tomato" size={22} />
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="text-sm text-foreground/60 text-center py-6">
            {isOwner
              ? "Brak wpisów - dodaj pierwszy, żeby dać znać obserwującym."
              : `${placeName} nie opublikował(a) jeszcze żadnych wpisów.`}
          </div>
        ) : (
          <div className="relative">
            <div className="max-h-[clamp(480px,60vh,720px)] overflow-y-auto pr-1 space-y-4 pb-6">
              <ul className="space-y-4">
                {posts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    canManage={!!isOwner || (!!user && p.created_by === user.id)}
                    onEdit={() => setEditing(p)}
                  />
                ))}
              </ul>
            </div>
            {posts.length > 2 && (
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent"
                aria-hidden="true"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PostComposer({
  placeId,
  initial,
  onClose,
}: {
  placeId: string;
  initial: PlacePost | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [postType, setPostType] = useState<PlacePostType>(
    (initial?.post_type as PlacePostType) ?? "announcement",
  );
  const upsert = useUpsertPlacePost();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Podaj tytuł");
    try {
      await upsert.mutateAsync({
        id: initial?.id,
        place_id: placeId,
        title: title.trim(),
        body: body.trim() || null,
        image_url: imageUrl.trim() || null,
        post_type: postType,
      });
      toast.success(initial ? "Zapisano zmiany" : "Wpis opublikowany");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-tomato/30 bg-tomato/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-foreground">
          {initial ? "Edytuj wpis" : "Nowy wpis lokalu"}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-foreground/60 hover:text-tomato"
          aria-label="Zamknij"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABELS) as PlacePostType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPostType(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
              postType === t
                ? "bg-foreground text-background border-foreground"
                : "bg-card border-border text-foreground hover:border-tomato"
            }`}
          >
            {TYPE_LABELS[t].label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tytuł (np. Nowe menu jesienne)"
        maxLength={140}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-tomato"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Treść wpisu…"
        rows={4}
        maxLength={2000}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-tomato resize-y"
      />
      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="URL obrazka (opcjonalnie)"
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-tomato"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/5"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={upsert.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-bold hover:bg-tomato/90 disabled:opacity-60"
        >
          {upsert.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {initial ? "Zapisz" : "Opublikuj"}
        </button>
      </div>
    </form>
  );
}

function PostCard({
  post,
  canManage,
  onEdit,
}: {
  post: PlacePost;
  canManage: boolean;
  onEdit: () => void;
}) {
  const del = useDeletePlacePost(post.place_id);
  const typeMeta = TYPE_LABELS[post.post_type] ?? TYPE_LABELS.announcement;
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-2 mb-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeMeta.cls}`}
        >
          {typeMeta.label}
        </span>
        <div className="flex-1" />
        <span className="text-xs text-foreground/50">{timeAgo(post.created_at)}</span>
        {canManage && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="pz-hit p-1 rounded hover:bg-foreground/5 text-foreground/60 hover:text-foreground"
              aria-label="Edytuj"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => {
                if (confirm("Usunąć wpis?")) del.mutate(post.id);
              }}
              className="pz-hit p-1 rounded hover:bg-tomato/10 text-foreground/60 hover:text-tomato"
              aria-label="Usuń"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      <div className="font-display text-lg text-foreground mb-1">{post.title}</div>
      {post.body && (
        <div className="text-sm text-foreground/80 leading-relaxed">
          <SmartText>{post.body}</SmartText>
        </div>
      )}
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="mt-3 w-full max-h-80 object-cover rounded-xl"
        />
      )}
      <PostSocial postId={post.id} />
    </li>
  );
}

function PostSocial({ postId }: { postId: string }) {
  const { user } = useUser();
  const { data: reactions } = usePostReactions(postId);
  const { data: comments } = usePostComments(postId);
  const toggle = useToggleReaction(postId);
  const addComment = useAddPostComment(postId);
  const delComment = useDeletePostComment(postId);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [text, setText] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (reactions ?? []).forEach((r) => (c[r.reaction_type] = (c[r.reaction_type] ?? 0) + 1));
    return c;
  }, [reactions]);
  const myReaction = user ? reactions?.find((r) => r.user_id === user.id)?.reaction_type : null;

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await addComment.mutateAsync(text.trim());
      setText("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center gap-2 flex-wrap">
        {REACTION_TYPES.map((t: ReactionType) => (
          <button
            key={t}
            onClick={() => {
              if (!user) return toast.error("Zaloguj się, by reagować");
              toggle.mutate(t);
            }}
            aria-pressed={myReaction === t}
            className={`pz-hit pz-reaction inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${
              myReaction === t
                ? "pz-reaction--mine bg-tomato/10 border-tomato text-tomato"
                : "bg-card border-border text-foreground/70 hover:border-tomato"
            }`}
          >
            <span className="pz-reaction-emoji text-base leading-none">{REACTION_EMOJI[t]}</span>
            {counts[t] ? <span>{counts[t]}</span> : null}
          </button>
        ))}
        <button
          onClick={() => setCommentsOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/70 hover:text-tomato"
        >
          <MessageSquare size={13} /> {comments?.length ?? 0} komentarzy
          {commentsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {commentsOpen && (
        <div className="mt-3 space-y-3">
          {(comments ?? []).length === 0 && (
            <div className="text-xs text-foreground/50">Brak komentarzy - bądź pierwszy.</div>
          )}
          <ul className="space-y-2">
            {(comments ?? []).map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <UserAvatar
                  avatarUrl={c.author?.avatar_url ?? null}
                  avatarSource={
                    (c.author?.avatar_source as "google" | "upload" | "initials") ?? "initials"
                  }
                  displayName={c.author?.display_name ?? null}
                  username={c.author?.username ?? null}
                  size={28}
                />
                <div className="flex-1 min-w-0 rounded-xl bg-foreground/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    {c.author?.username ? (
                      <Link
                        to="/u/$username"
                        params={{ username: c.author.username }}
                        className="font-bold text-foreground hover:text-tomato"
                      >
                        {c.author.display_name || `@${c.author.username}`}
                      </Link>
                    ) : (
                      <span className="font-bold text-foreground">
                        {c.author?.display_name || "Ktoś"}
                      </span>
                    )}
                    <span className="text-foreground/40">{timeAgo(c.created_at)}</span>
                    {user?.id === c.user_id && (
                      <button
                        onClick={() => delComment.mutate(c.id)}
                        className="ml-auto text-foreground/40 hover:text-tomato"
                        aria-label="Usuń komentarz"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-foreground/85 whitespace-pre-wrap break-words">
                    {c.body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {user ? (
            <form onSubmit={submitComment} className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Napisz komentarz…"
                maxLength={800}
                className="flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-tomato"
              />
              <button
                type="submit"
                disabled={addComment.isPending || !text.trim()}
                className="inline-flex items-center justify-center rounded-full bg-tomato text-cream w-11 h-11 hover:bg-tomato/90 disabled:opacity-50"
                aria-label="Wyślij"
              >
                {addComment.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </form>
          ) : (
            <div className="text-xs text-foreground/60">
              <Link to="/auth" className="font-bold text-tomato hover:underline">
                Zaloguj się
              </Link>
              , żeby komentować.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
