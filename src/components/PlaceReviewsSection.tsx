import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Star,
  Loader2,
  Image as ImageIcon,
  Trash2,
  X,
  MessageCircleReply,
  ShieldCheck,
} from "lucide-react";
import { useUser } from "@/lib/use-auth";
import {
  usePlaceReviews,
  useMyReviewForPlace,
  useSaveReview,
  useDeleteReview,
  uploadReviewPhoto,
  useReviewPhotoUrl,
  usePlaceReviewStats,
  type Review,
} from "@/lib/reviews-api";
import { usePlaceRatingBreakdown } from "@/lib/places-api";
import { UserAvatar } from "@/components/UserAvatar";
import { VipBadge, isVipActive, vipNameStyle } from "@/components/VipBadge";
import { useIsOwnerOf } from "@/lib/owners-api";
import {
  usePlaceReviewReplies,
  useUpsertReviewReply,
  useDeleteReviewReply,
  type ReviewReply,
} from "@/lib/review-replies-api";

export function PlaceReviewsSection({ placeId }: { placeId: string }) {
  const { user } = useUser();
  const { data: reviews, isLoading } = usePlaceReviews(placeId);
  const { data: myReview } = useMyReviewForPlace(placeId, user?.id);
  const { count, avg } = usePlaceReviewStats(placeId);
  const { data: breakdown } = usePlaceRatingBreakdown(placeId);
  const { data: replies } = usePlaceReviewReplies(placeId);
  const { data: isOwner } = useIsOwnerOf(placeId);
  const [openForm, setOpenForm] = useState(false);

  const breakdownTotal = (breakdown ?? []).reduce((s, r) => s + Number(r.count), 0);

  return (
    <section id="recenzje">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl">Recenzje</h2>
        <div className="text-sm text-muted-foreground">
          {count > 0 ? (
            <span className="flex items-center gap-1">
              <Star size={14} className="fill-tomato text-tomato" /> {avg} · {count}{" "}
              {count === 1 ? "recenzja" : "recenzji"}
            </span>
          ) : (
            "Bądź pierwszą osobą, która oceni to miejsce."
          )}
        </div>
      </div>

      {breakdownTotal > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-6 items-center">
            <div className="text-center sm:text-left sm:border-r sm:border-border sm:pr-6">
              <div className="font-display text-5xl leading-none text-navy">
                {avg?.toFixed(1) ?? "—"}
              </div>
              <div className="inline-flex items-center gap-0.5 mt-1.5" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      avg != null && i <= Math.round(avg)
                        ? "fill-tomato text-tomato"
                        : "text-muted-foreground/40"
                    }
                  />
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {breakdownTotal}{" "}
                {breakdownTotal === 1 ? "opinia" : breakdownTotal < 5 ? "opinie" : "opinii"}
              </div>
            </div>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const row = (breakdown ?? []).find((r) => Number(r.rating) === star);
                const cnt = row ? Number(row.count) : 0;
                const pct = breakdownTotal > 0 ? Math.round((cnt / breakdownTotal) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="w-8 inline-flex items-center gap-0.5 font-semibold tabular-nums">
                      {star}
                      <Star size={11} className="fill-tomato text-tomato" />
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-tomato transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                      {cnt} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {user ? (
        myReview && !openForm ? (
          <div className="mb-6">
            <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  Twoja recenzja
                </div>
                <RatingStars rating={myReview.rating} />
                {myReview.body && <p className="text-sm mt-2">{myReview.body}</p>}
              </div>
              <button onClick={() => setOpenForm(true)} className="chip bg-tomato text-cream">
                Edytuj
              </button>
            </div>
            {replies?.[myReview.id] && <OwnerReplyView reply={replies[myReview.id]} />}
          </div>
        ) : (
          <ReviewForm
            placeId={placeId}
            existing={myReview ?? null}
            onDone={() => setOpenForm(false)}
          />
        )
      ) : (
        <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center text-sm text-muted-foreground mb-6">
          <Link to="/auth" className="text-tomato font-semibold hover:underline">
            Zaloguj się
          </Link>
          , by dodać recenzję i zgarniać punkty PoŻarcia.
        </div>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        (() => {
          const others = (reviews ?? []).filter((r) => r.user_id !== user?.id);
          if (others.length > 0) {
            return (
              <ul className="space-y-3">
                {others.map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    placeId={placeId}
                    reply={replies?.[r.id] ?? null}
                    canReply={!!isOwner}
                  />
                ))}
              </ul>
            );
          }
          // count === 0 is already covered by the "Bądź pierwszą osobą…" header
          // subtitle and the login/write-review prompt above — a second empty
          // state here would just repeat the same message a third time.
          if (count === 0) return null;
          return (
            <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Jak na razie tylko Twoja recenzja — zaproś znajomych, niech też ocenią 🍽️
            </div>
          );
        })()
      )}
    </section>
  );
}

function RatingStars({ rating, onChange }: { rating: number; onChange?: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type={onChange ? "button" : undefined}
          onClick={() => onChange?.(i)}
          className={onChange ? "p-0.5 hover:scale-110 transition" : "pointer-events-none"}
          aria-label={`${i} gwiazdek`}
        >
          <Star
            size={onChange ? 24 : 16}
            className={i <= rating ? "fill-tomato text-tomato" : "text-muted-foreground"}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({
  placeId,
  existing,
  onDone,
}: {
  placeId: string;
  existing: Review | null;
  onDone: () => void;
}) {
  const { user } = useUser();
  const save = useSaveReview();
  const del = useDeleteReview();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [body, setBody] = useState(existing?.body ?? "");
  const [photoPath, setPhotoPath] = useState<string | null>(existing?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const { data: photoUrl } = useReviewPhotoUrl(photoPath);

  useEffect(() => {
    setRating(existing?.rating ?? 5);
    setBody(existing?.body ?? "");
    setPhotoPath(existing?.photo_url ?? null);
  }, [existing]);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Zdjęcie max 8 MB");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadReviewPhoto(user.id, f);
      setPhotoPath(path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd uploadu");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        id: existing?.id,
        values: { place_id: placeId, rating, body: body.trim() || null, photo_url: photoPath },
      });
      toast.success(existing ? "Zaktualizowano recenzję" : "Recenzja dodana! +punkty PoŻarcia");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function handleDelete() {
    if (!existing) return;
    if (!confirm("Usunąć recenzję? Punkty zostaną cofnięte.")) return;
    try {
      await del.mutateAsync(existing.id);
      toast.success("Usunięto");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
            {existing ? "Edytuj recenzję" : "Twoja recenzja"}
          </div>
          <RatingStars rating={rating} onChange={setRating} />
        </div>
        {existing && (
          <button
            type="button"
            onClick={onDone}
            className="pz-hit w-8 h-8 rounded-full bg-muted grid place-items-center"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Co Ci się podobało? (opcjonalnie)"
        className="w-full rounded-xl border-2 border-border px-4 py-2.5 outline-none focus:border-tomato resize-none"
      />
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handlePhoto}
          className="hidden"
        />
        {photoUrl ? (
          <div className="relative w-28 h-28">
            <img src={photoUrl} alt="" className="w-full h-full rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => setPhotoPath(null)}
              className="pz-hit absolute -top-2 -right-2 w-7 h-7 rounded-full bg-tomato text-cream grid place-items-center shadow"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-sm font-semibold hover:border-tomato disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
            {uploading ? "Wgrywam…" : "Dodaj zdjęcie (+5 pkt)"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2 font-semibold hover:bg-tomato/90 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          {existing ? "Zapisz zmiany" : "Opublikuj"}
        </button>
        {existing && (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-sm font-semibold hover:border-destructive hover:text-destructive"
          >
            <Trash2 size={13} /> Usuń
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewCard({
  review,
  placeId,
  reply,
  canReply,
}: {
  review: Review;
  placeId: string;
  reply: ReviewReply | null;
  canReply: boolean;
}) {
  const { data: photoUrl } = useReviewPhotoUrl(review.photo_url);
  return (
    <li className="bg-card border border-border rounded-2xl p-4">
      <div className="flex gap-3">
        <div className="shrink-0">
          {review.author?.username ? (
            <Link to="/u/$username" params={{ username: review.author.username }}>
              <UserAvatar
                avatarUrl={review.author.avatar_url}
                avatarSource={review.author.avatar_source}
                displayName={review.author.display_name}
                username={review.author.username}
                size={40}
              />
            </Link>
          ) : (
            <UserAvatar size={40} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {review.author?.username ? (
              <Link
                to="/u/$username"
                params={{ username: review.author.username }}
                className="font-semibold text-sm hover:text-tomato"
                style={vipNameStyle(review.author)}
              >
                {review.author.display_name || `@${review.author.username}`}
              </Link>
            ) : (
              <span className="font-semibold text-sm">Anonim</span>
            )}
            {review.author && isVipActive(review.author) && <VipBadge />}
            <RatingStars rating={review.rating} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString("pl-PL")}
            </span>
            {review.updated_at &&
              new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() >
                60_000 && (
                <span
                  className="text-[10px] uppercase tracking-wider text-muted-foreground italic"
                  title={`Edytowano ${new Date(review.updated_at).toLocaleString("pl-PL")}`}
                >
                  · edytowano
                </span>
              )}
          </div>
          {review.body && <p className="text-sm mt-1.5 leading-relaxed">{review.body}</p>}
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              className="mt-2 max-h-64 rounded-xl object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
      </div>
      {reply && <OwnerReplyView reply={reply} canManage={canReply} placeId={placeId} />}
      {canReply && !reply && <OwnerReplyForm placeId={placeId} reviewId={review.id} />}
    </li>
  );
}

function OwnerReplyView({
  reply,
  canManage,
  placeId,
}: {
  reply: ReviewReply;
  canManage?: boolean;
  placeId?: string;
}) {
  const [edit, setEdit] = useState(false);
  const del = useDeleteReviewReply(placeId ?? reply.place_id);
  if (edit && placeId) {
    return (
      <OwnerReplyForm
        placeId={placeId}
        reviewId={reply.review_id}
        existing={reply}
        onDone={() => setEdit(false)}
      />
    );
  }
  return (
    <div className="mt-3 ml-6 sm:ml-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-1">
        <ShieldCheck size={13} /> Odpowiedź właściciela
        <span className="text-muted-foreground font-normal">
          · {new Date(reply.created_at).toLocaleDateString("pl-PL")}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.content}</p>
      {canManage && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setEdit(true)}
            className="text-xs font-semibold text-navy/70 hover:text-tomato"
          >
            Edytuj
          </button>
          <button
            onClick={() => {
              if (!confirm("Usunąć odpowiedź?")) return;
              del.mutate(reply.id, {
                onSuccess: () => toast.success("Usunięto"),
                onError: (e) => toast.error((e as Error).message),
              });
            }}
            className="text-xs font-semibold text-navy/70 hover:text-destructive"
          >
            Usuń
          </button>
        </div>
      )}
    </div>
  );
}

function OwnerReplyForm({
  placeId,
  reviewId,
  existing,
  onDone,
}: {
  placeId: string;
  reviewId: string;
  existing?: ReviewReply;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(!!existing);
  const [content, setContent] = useState(existing?.content ?? "");
  const upsert = useUpsertReviewReply(placeId);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 ml-6 sm:ml-12 inline-flex items-center gap-1.5 text-xs font-semibold text-tomato hover:underline"
      >
        <MessageCircleReply size={13} /> Odpowiedz jako właściciel
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const text = content.trim();
        if (!text) return;
        try {
          await upsert.mutateAsync({ reviewId, content: text, existingId: existing?.id });
          toast.success(existing ? "Zapisano odpowiedź" : "Odpowiedź opublikowana");
          onDone?.();
          if (!existing) {
            setOpen(false);
            setContent("");
          }
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
      className="mt-3 ml-6 sm:ml-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2"
    >
      <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
        <ShieldCheck size={13} /> {existing ? "Edytuj odpowiedź" : "Odpowiedź właściciela"}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Napisz odpowiedź na tę recenzję…"
        className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={upsert.isPending || !content.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {upsert.isPending && <Loader2 size={13} className="animate-spin" />}
          {existing ? "Zapisz" : "Opublikuj"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (existing) onDone?.();
            else {
              setOpen(false);
              setContent("");
            }
          }}
          className="text-xs font-semibold text-navy/70 hover:text-tomato px-2"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
