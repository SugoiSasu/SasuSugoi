import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Loader2, ShieldCheck, Search, Trash2, ExternalLink, Copy, Archive, Reply, Eye, Inbox, MessageSquare, Send, Phone, StickyNote, MoreHorizontal } from "lucide-react";
import { useIsSuperAdmin, useUser } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDeleteModal } from "@/components/admin/ConfirmDeleteModal";

export const Route = createFileRoute("/_authenticated/admin/collab")({
  head: () => ({ meta: [{ title: "Współpraca - Panel admina" }] }),
  component: AdminCollab,
});

type CollabStatus = "new" | "read" | "replied" | "archived";

type Submission = {
  id: string;
  brand: string;
  email: string;
  message: string;
  consent_version: string;
  consent_accepted_at: string;
  user_agent: string | null;
  created_at: string;
  status: CollabStatus;
  status_updated_at: string | null;
  status_updated_by: string | null;
  admin_notes: string | null;
};

const STATUS_META: Record<CollabStatus, { label: string; cls: string }> = {
  new: { label: "Nowa", cls: "bg-tomato/15 text-tomato border-tomato/30" },
  read: { label: "Odczytana", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  replied: { label: "Odpowiedziana", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  archived: { label: "Zarchiwizowana", cls: "bg-muted text-muted-foreground border-border" },
};

function AdminCollab() {
  const isSuper = useIsSuperAdmin();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | CollabStatus>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "collab_submissions"],
    enabled: isSuper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collab_submissions" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Submission[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CollabStatus }) => {
      const { error } = await supabase
        .from("collab_submissions" as never)
        .update({ status, status_updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "collab_submissions"] });
      toast.success("Status zaktualizowany");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("collab_submissions" as never)
        .update({ admin_notes: notes } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "collab_submissions"] });
      toast.success("Notatka zapisana");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collab_submissions" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "collab_submissions"] });
      toast.success("Zgłoszenie usunięte");
      setOpenId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const c = { all: 0, new: 0, read: 0, replied: 0, archived: 0 };
    (data ?? []).forEach((s) => { c.all++; c[s.status]++; });
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (!q) return true;
      return (
        s.brand.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.message.toLowerCase().includes(q)
      );
    });
  }, [data, filter, search]);

  if (!isSuper) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Crown className="mx-auto text-tomato mb-3" size={32} />
        <h2 className="font-display text-xl mb-1">Tylko dla super admina</h2>
        <p className="text-sm text-muted-foreground">Wiadomości zawierają dane osobowe - dostęp ograniczony.</p>
      </div>
    );
  }

  const open = openId ? (data ?? []).find((s) => s.id === openId) : null;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <Inbox className="text-tomato" size={28} /> Wiadomości - Współpraca
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zgłoszenia z formularza wraz z dowodem zgody RODO (wersja klauzuli + dokładny czas akceptacji).
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} className="text-emerald-600" /> Tylko super admin
        </div>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {(["all", "new", "read", "replied", "archived"] as const).map((k) => {
          const active = filter === k;
          const label = k === "all" ? "Wszystkie" : STATUS_META[k].label;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                active ? "bg-tomato text-cream border-tomato" : "bg-card border-border hover:border-tomato"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 ${active ? "bg-cream/20" : "bg-muted text-muted-foreground"}`}>
                {counts[k]}
              </span>
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po marce, mailu, treści…"
            className="pl-9 pr-3 py-2 rounded-full bg-card border border-border text-sm focus:border-tomato outline-none w-64"
          />
        </div>
      </div>

      {/* Table / list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 grid place-items-center">
            <Loader2 className="animate-spin text-tomato" size={28} />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-tomato">Błąd: {(error as Error).message}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Brak zgłoszeń pasujących do filtra.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((s) => (
              <li key={s.id} className="p-4 sm:p-5 hover:bg-muted/30 transition">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{s.brand}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5 border ${STATUS_META[s.status].cls}`}>
                        {STATUS_META[s.status].label}
                      </span>
                      {s.status === "new" && (
                        <span className="text-[10px] text-tomato font-bold animate-pulse">●</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <a href={`mailto:${s.email}`} className="hover:text-tomato underline">{s.email}</a>
                      <span>·</span>
                      <span>{new Date(s.created_at).toLocaleString("pl-PL")}</span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-2 line-clamp-2">{s.message}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setOpenId(s.id);
                        if (s.status === "new") updateStatus.mutate({ id: s.id, status: "read" });
                      }}
                      className="chip bg-card border border-border hover:border-tomato"
                    >
                      <Eye size={14} /> Podgląd
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {open && (
        <DetailModal
          submission={open}
          onClose={() => setOpenId(null)}
          onStatus={(status) => updateStatus.mutate({ id: open.id, status })}
          onSaveNotes={(notes) => saveNotes.mutate({ id: open.id, notes })}
          onDelete={() => setDeleteConfirmId(open.id)}
        />
      )}
      <ConfirmDeleteModal
        open={!!deleteConfirmId}
        title="Usunąć zgłoszenie?"
        description="Bezpowrotnie, razem z dowodem zgody RODO."
        pending={removeOne.isPending}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) removeOne.mutate(deleteConfirmId, { onSuccess: () => setDeleteConfirmId(null) });
        }}
      />
    </div>
  );
}

function DetailModal({
  submission,
  onClose,
  onStatus,
  onSaveNotes,
  onDelete,
}: {
  submission: Submission;
  onClose: () => void;
  onStatus: (s: CollabStatus) => void;
  onSaveNotes: (n: string) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(submission.admin_notes ?? "");
  const mailto = `mailto:${submission.email}?subject=${encodeURIComponent(
    `Re: Współpraca - ${submission.brand}`,
  )}&body=${encodeURIComponent(`Cześć!\n\nDzięki za wiadomość.\n\n - poŻeramy`)}`;

  function copyProof() {
    const text = `Dowód zgody RODO\nMarka: ${submission.brand}\nEmail: ${submission.email}\nWersja klauzuli: ${submission.consent_version}\nData akceptacji: ${new Date(submission.consent_accepted_at).toISOString()}\nUser agent: ${submission.user_agent ?? " - "}\nWysłano: ${new Date(submission.created_at).toISOString()}\nID zgłoszenia: ${submission.id}`;
    navigator.clipboard.writeText(text);
    toast.success("Dowód zgody skopiowany do schowka");
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl truncate">{submission.brand}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(submission.created_at).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
        </header>

        <div className="p-5 space-y-5">
          {/* Status changer */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold mb-2 text-muted-foreground">Status</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_META) as CollabStatus[]).map((k) => (
                <button
                  key={k}
                  onClick={() => onStatus(k)}
                  className={`text-xs font-bold rounded-full px-3 py-1.5 border transition ${
                    submission.status === k ? STATUS_META[k].cls : "bg-card border-border hover:border-tomato text-muted-foreground"
                  }`}
                >
                  {STATUS_META[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* Kontakt */}
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Detail label="Email">
              <a href={`mailto:${submission.email}`} className="text-tomato underline break-all">{submission.email}</a>
            </Detail>
            <Detail label="ID zgłoszenia">
              <code className="text-xs">{submission.id}</code>
            </Detail>
          </div>

          {/* Wiadomość */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 text-muted-foreground">Treść wiadomości</label>
            <div className="rounded-xl bg-muted/40 border border-border p-4 text-sm whitespace-pre-wrap break-words">
              {submission.message}
            </div>
          </div>

          {/* Dowód zgody RODO */}
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/30 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" /> Dowód zgody RODO
              </h3>
              <button onClick={copyProof} className="chip bg-card border border-border hover:border-emerald-500 text-xs">
                <Copy size={12} /> Kopiuj
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <Detail label="Wersja klauzuli"><strong>{submission.consent_version}</strong></Detail>
              <Detail label="Data akceptacji">
                {new Date(submission.consent_accepted_at).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "medium" })}
              </Detail>
              <Detail label="ISO timestamp">
                <code className="text-[10px]">{new Date(submission.consent_accepted_at).toISOString()}</code>
              </Detail>
              <Detail label="User agent">
                <span className="text-[10px] break-all">{submission.user_agent ?? " - "}</span>
              </Detail>
            </div>
          </div>

          {/* Historia korespondencji */}
          <RepliesSection submissionId={submission.id} brand={submission.brand} email={submission.email} />

          {/* Notatka */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 text-muted-foreground">
              Notatka wewnętrzna (widoczna tylko dla adminów)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm focus:border-tomato outline-none"
              placeholder="np. ustaliliśmy reels za 800 zł, wraca 12.04"
            />
            <button
              onClick={() => onSaveNotes(notes)}
              className="mt-2 chip bg-card border border-border hover:border-tomato text-xs"
            >
              Zapisz notatkę
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <a
              href={mailto}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onStatus("replied");
                // auto-log do historii: użytkownik kliknął "Odpowiedz mailem"
                supabase.auth.getUser().then(({ data }) => {
                  const uid = data.user?.id;
                  if (!uid) return;
                  supabase.from("collab_replies" as never).insert({
                    submission_id: submission.id,
                    author_id: uid,
                    channel: "email",
                    body: "Otworzono klienta poczty z odpowiedzią (auto-log).",
                    sent_at: new Date().toISOString(),
                  } as never).then(() => {
                    // refresh
                    window.dispatchEvent(new CustomEvent("collab-replies-refresh", { detail: submission.id }));
                  });
                });
              }}
              className="chip bg-tomato text-cream hover:bg-tomato/90"
            >
              <Reply size={14} /> Odpowiedz mailem
            </a>
            <button
              onClick={() => onStatus("archived")}
              className="chip bg-card border border-border hover:border-tomato"
            >
              <Archive size={14} /> Archiwizuj
            </button>
            <button
              onClick={onDelete}
              className="chip bg-card border border-tomato/40 text-tomato hover:bg-tomato/10 ml-auto"
            >
              <Trash2 size={14} /> Usuń
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

type Reply = {
  id: string;
  submission_id: string;
  author_id: string | null;
  channel: "email" | "phone" | "note" | "other";
  body: string;
  sent_at: string;
  created_at: string;
};

const CHANNEL_META: Record<Reply["channel"], { label: string; icon: React.ReactNode; cls: string }> = {
  email: { label: "Email", icon: <Send size={12} />, cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  phone: { label: "Telefon", icon: <Phone size={12} />, cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  note: { label: "Notatka", icon: <StickyNote size={12} />, cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  other: { label: "Inne", icon: <MoreHorizontal size={12} />, cls: "bg-muted text-muted-foreground border-border" },
};

function RepliesSection({ submissionId, brand, email }: { submissionId: string; brand: string; email: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<Reply["channel"]>("email");
  const [sentAt, setSentAt] = useState<string>(() => toLocalInput(new Date()));

  const { data: replies, isLoading } = useQuery({
    queryKey: ["admin", "collab_replies", submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collab_replies" as never)
        .select("*")
        .eq("submission_id", submissionId)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Reply[];
    },
  });

  // Profile names for authors
  const authorIds = Array.from(new Set((replies ?? []).map((r) => r.author_id).filter(Boolean) as string[]));
  const { data: authors } = useQuery({
    queryKey: ["admin", "collab_reply_authors", authorIds.sort().join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", authorIds);
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).map((p) => [p.id, p.display_name || p.username || "Admin"]),
      ) as Record<string, string>;
    },
  });

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ["admin", "collab_replies", submissionId] });
    window.addEventListener("collab-replies-refresh", handler);
    return () => window.removeEventListener("collab-replies-refresh", handler);
  }, [qc, submissionId]);


  const addReply = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Brak zalogowanego użytkownika.");
      const trimmed = body.trim();
      if (trimmed.length < 1) throw new Error("Treść nie może być pusta.");
      const { error } = await supabase.from("collab_replies" as never).insert({
        submission_id: submissionId,
        author_id: user.id,
        channel,
        body: trimmed,
        sent_at: new Date(sentAt).toISOString(),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "collab_replies", submissionId] });
      setBody("");
      setSentAt(toLocalInput(new Date()));
      toast.success("Wpis dodany do historii");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeReply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collab_replies" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "collab_replies", submissionId] });
      toast.success("Wpis usunięty");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [deleteReplyId, setDeleteReplyId] = useState<string | null>(null);

  const mailto = `mailto:${email}?subject=${encodeURIComponent(`Re: Współpraca - ${brand}`)}`;

  return (
    <div className="rounded-xl bg-muted/30 border border-border p-4">
      <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
        <MessageSquare size={16} className="text-tomato" />
        Historia korespondencji
        <span className="text-xs font-normal text-muted-foreground">
          ({replies?.length ?? 0})
        </span>
      </h3>

      {/* Lista */}
      {isLoading ? (
        <div className="py-4 grid place-items-center"><Loader2 className="animate-spin text-muted-foreground" size={18} /></div>
      ) : !replies || replies.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Brak wpisów. Po wysłaniu odpowiedzi zapisz tu jej kopię, żeby mieć ślad kontaktu.
        </p>
      ) : (
        <ol className="space-y-2.5 mb-4">
          {replies.map((r) => {
            const meta = CHANNEL_META[r.channel];
            const author = r.author_id ? (authors?.[r.author_id] ?? "Admin") : " - ";
            return (
              <li key={r.id} className="rounded-lg bg-card border border-border p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5 border ${meta.cls}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.sent_at).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-semibold">{author}</span>
                  </div>
                  <button
                    onClick={() => setDeleteReplyId(r.id)}
                    className="text-muted-foreground hover:text-tomato"
                    aria-label="Usuń wpis"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{r.body}</p>
              </li>
            );
          })}
        </ol>
      )}

      {/* Formularz dodawania */}
      <div className="border-t border-border pt-3 mt-2">
        <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5 text-muted-foreground">
          Dodaj wpis do historii
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={10000}
          placeholder="Treść odpowiedzi / notatki…"
          className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:border-tomato outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Reply["channel"])}
            className="rounded-lg bg-background border border-border px-2.5 py-1.5 text-xs focus:border-tomato outline-none"
          >
            <option value="email">Email</option>
            <option value="phone">Telefon</option>
            <option value="note">Notatka</option>
            <option value="other">Inne</option>
          </select>
          <input
            type="datetime-local"
            value={sentAt}
            onChange={(e) => setSentAt(e.target.value)}
            className="rounded-lg bg-background border border-border px-2.5 py-1.5 text-xs focus:border-tomato outline-none"
          />
          <button
            onClick={() => addReply.mutate()}
            disabled={addReply.isPending || body.trim().length === 0}
            className="chip bg-tomato text-cream hover:bg-tomato/90 disabled:opacity-50 ml-auto text-xs"
          >
            <Send size={12} /> Zapisz wpis
          </button>
          <a
            href={mailto}
            target="_blank"
            rel="noopener noreferrer"
            className="chip bg-card border border-border hover:border-tomato text-xs"
          >
            <ExternalLink size={12} /> Otwórz email
          </a>
        </div>
      </div>
      <ConfirmDeleteModal
        open={!!deleteReplyId}
        title="Usunąć wpis?"
        description="Ten wpis zniknie z historii korespondencji."
        pending={removeReply.isPending}
        onCancel={() => setDeleteReplyId(null)}
        onConfirm={() => {
          if (deleteReplyId) removeReply.mutate(deleteReplyId, { onSuccess: () => setDeleteReplyId(null) });
        }}
      />
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
