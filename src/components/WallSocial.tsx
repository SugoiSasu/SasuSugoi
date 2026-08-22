import { useState, type FormEvent } from "react";
import { MessageCircle, Send, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/use-auth";
import { UserAvatar } from "@/components/UserAvatar";
import { SmartText } from "@/components/SmartText";
import { vipNameStyle } from "@/components/VipBadge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  WALL_REACTION_TYPES,
  WALL_REACTION_EMOJI,
  WALL_REACTION_LABEL,
  type WallSocialKind,
  type WallComment,
  useWallReactions,
  useToggleWallReaction,
  useWallComments,
  useAddWallComment,
  useUpdateWallComment,
  useDeleteWallComment,
} from "@/lib/wall-social-api";

/** Reactions + comments for the generic wall social layer (favorite,
 * achievement_group, post, list, challenge_complete kinds). Shared between
 * the /wall feed and standalone item pages (e.g. /l/$id). */
export function WallSocial({ kind, refId }: { kind: WallSocialKind; refId: string }) {
  const { user } = useUser();
  const { data: reactions } = useWallReactions(kind, refId);
  const toggle = useToggleWallReaction(kind, refId);
  const { data: comments } = useWallComments(kind, refId);
  const add = useAddWallComment(kind, refId);
  const [text, setText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const myReaction = user ? (reactions ?? []).find((r) => r.user_id === user.id)?.type : undefined;

  const counts: Record<string, number> = {};
  (reactions ?? []).forEach((r) => (counts[r.type] = (counts[r.type] ?? 0) + 1));

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
        {WALL_REACTION_TYPES.map((t) => {
          const active = myReaction === t;
          return (
            <button
              key={t}
              disabled={toggle.isPending}
              onClick={() => {
                if (!user) {
                  toast.error("Zaloguj się, żeby reagować");
                  return;
                }
                toggle.mutate(t, {
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Nie udało się dodać reakcji"),
                });
              }}
              className={`pz-reaction-pop chip text-sm disabled:opacity-60 disabled:pointer-events-none ${active ? "bg-tomato text-cream" : "bg-card border border-border hover:border-tomato"}`}
              aria-pressed={active}
              aria-label={WALL_REACTION_LABEL[t]}
              title={WALL_REACTION_LABEL[t]}
            >
              <span>{WALL_REACTION_EMOJI[t]}</span>
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
            <CommentItem key={c.id} comment={c} kind={kind} refId={refId} />
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

function CommentItem({
  comment,
  kind,
  refId,
}: {
  comment: WallComment;
  kind: WallSocialKind;
  refId: string;
}) {
  const { user } = useUser();
  const update = useUpdateWallComment(kind, refId);
  const del = useDeleteWallComment(kind, refId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const isMine = user?.id === comment.user_id;
  const wasEdited = comment.updated_at !== comment.created_at;

  async function saveEdit() {
    const v = draft.trim();
    if (!v) return;
    try {
      await update.mutateAsync({ id: comment.id, body: v });
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać zmian");
    }
  }

  async function handleDelete() {
    if (!confirm("Usunąć komentarz?")) return;
    try {
      await del.mutateAsync(comment.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się usunąć komentarza");
    }
  }

  return (
    <div className="group flex items-start gap-2 text-sm">
      <UserAvatar
        avatarUrl={comment.author?.avatar_url}
        avatarSource={
          (comment.author?.avatar_source ?? "initials") as "google" | "upload" | "initials"
        }
        displayName={comment.author?.display_name}
        username={comment.author?.username}
        size={24}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold" style={vipNameStyle(comment.author)}>
            {comment.author?.display_name ||
              (comment.author?.username ? `@${comment.author.username}` : "Anonim")}
          </span>
          {wasEdited && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default text-[10px] text-muted-foreground">
                    (edytowano)
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Edytowano{" "}
                  {new Date(comment.updated_at).toLocaleString("pl-PL", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {editing ? (
          <div className="mt-1 flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              autoFocus
              className="flex-1 rounded-full bg-background border border-border px-3 py-1 text-sm outline-none focus:border-tomato"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(comment.body);
                }
              }}
            />
            <button
              type="button"
              onClick={saveEdit}
              disabled={!draft.trim() || update.isPending}
              aria-label="Zapisz"
              className="grid h-7 w-7 place-items-center rounded-full text-tomato hover:bg-tomato/10 disabled:opacity-50"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(comment.body);
              }}
              aria-label="Anuluj"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <SmartText>{comment.body}</SmartText>
        )}
      </div>
      {isMine && !editing && (
        <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edytuj komentarz"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-tomato/10 hover:text-tomato"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={del.isPending}
            aria-label="Usuń komentarz"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
