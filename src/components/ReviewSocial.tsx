import { useEffect, useState } from "react";
import { Heart, MessageCircle, Trash2, Send, Loader2, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { UserAvatar } from "@/components/UserAvatar";
import {
  useReviewReactions, useToggleReaction,
  useReviewComments, useAddComment, useDeleteComment,
} from "@/lib/friends-api";


/** Subscribe to realtime changes for one review's reactions + comments. */
function useReviewRealtime(reviewId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!reviewId) return;
    const channel = supabase
      .channel(`review-social:${reviewId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "review_reactions", filter: `review_id=eq.${reviewId}` },
        () => qc.invalidateQueries({ queryKey: ["review-reactions", reviewId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "review_comments", filter: `review_id=eq.${reviewId}` },
        () => qc.invalidateQueries({ queryKey: ["review-comments", reviewId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reviewId, qc]);
}

export function ReviewSocial({ reviewId }: { reviewId: string }) {
  const { user } = useUser();
  const reactionsQ = useReviewReactions(reviewId);
  const toggle = useToggleReaction();
  const [showComments, setShowComments] = useState(false);

  useReviewRealtime(reviewId);

  const reactions = reactionsQ.data ?? [];
  const likes = reactions.filter((r) => r.type === "like");
  const iLike = !!user && likes.some((r) => r.user_id === user.id);

  const onToggle = () => {
    toggle.mutate(
      { reviewId, type: "like", on: !iLike },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Nie udało się zapisać reakcji") },
    );
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!user || toggle.isPending || reactionsQ.isLoading}
          onClick={onToggle}
          className={`pz-hit inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition disabled:opacity-50 ${
            iLike ? "bg-tomato/10 border-tomato text-tomato" : "bg-card border-border hover:border-tomato"
          }`}
          title={!user ? "Zaloguj się, aby zareagować" : iLike ? "Cofnij reakcję" : "Polub"}
        >
          {toggle.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Heart size={13} fill={iLike ? "currentColor" : "none"} />
          )}
          {reactionsQ.isLoading ? "…" : likes.length}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="pz-hit inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border bg-card border-border hover:border-tomato"
        >
          <MessageCircle size={13} /> Komentarze
        </button>
        {reactionsQ.isError && (
          <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle size={11} /> błąd ładowania
          </span>
        )}
      </div>
      {showComments && <CommentsBlock reviewId={reviewId} />}
    </div>
  );
}

function CommentsBlock({ reviewId }: { reviewId: string }) {
  const { user } = useUser();
  const { data: comments, isLoading, isError, error, refetch } = useReviewComments(reviewId);
  const add = useAddComment();
  const del = useDeleteComment();
  const [body, setBody] = useState("");

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    add.mutateAsync({ reviewId, body: trimmed })
      .then(() => setBody(""))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Nie udało się dodać komentarza"));
  };

  return (
    <div className="mt-3 space-y-2">
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Ładowanie komentarzy…
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span className="inline-flex items-center gap-1">
            <AlertCircle size={12} /> {error instanceof Error ? error.message : "Nie udało się pobrać komentarzy"}
          </span>
          <button type="button" onClick={() => refetch()} className="font-semibold underline">
            Spróbuj ponownie
          </button>
        </div>
      ) : (comments ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Brak komentarzy. Bądź pierwszy.</p>
      ) : (
        <ul className="space-y-2">
          {(comments ?? []).map((c) => {
            const a = c.author;
            const name = a?.display_name || (a?.username ? `@${a.username}` : "Użytkownik");
            return (
              <li key={c.id} className="bg-background border border-border rounded-xl p-2 text-sm flex items-start gap-2">
                {a?.username ? (
                  <Link to="/u/$username" params={{ username: a.username }} className="shrink-0">
                    <UserAvatar avatarUrl={a.avatar_url} avatarSource={a.avatar_source} displayName={a.display_name} username={a.username} size={28} className="hover:ring-2 hover:ring-tomato/50 transition" />
                  </Link>
                ) : (
                  <UserAvatar avatarUrl={a?.avatar_url ?? null} avatarSource={a?.avatar_source ?? "initials"} displayName={a?.display_name ?? null} username={a?.username ?? null} size={28} />
                )}
                <div className="flex-1 min-w-0">
                  {a?.username ? (
                    <Link to="/u/$username" params={{ username: a.username }} className="text-xs font-semibold hover:text-tomato truncate inline-block max-w-full">
                      {name}
                    </Link>
                  ) : (
                    <div className="text-xs font-semibold truncate">{name}</div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{c.body}</div>
                </div>
                {user?.id === c.user_id && (
                  <button
                    type="button"
                    title="Usuń"
                    disabled={del.isPending}
                    onClick={() =>
                      del.mutate(
                        { id: c.id, reviewId },
                        { onError: (err) => toast.error(err instanceof Error ? err.message : "Nie udało się usunąć") },
                      )
                    }
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            );
          })}

        </ul>
      )}
      {user && (
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Napisz komentarz…"
            disabled={add.isPending}
            className="flex-1 rounded-full bg-background border border-border focus:border-tomato outline-none px-3 py-2 text-sm disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            disabled={!body.trim() || add.isPending}
            onClick={submit}
            className="pz-hit inline-flex items-center gap-1 rounded-full bg-tomato text-cream px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {add.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
      )}
    </div>
  );
}
