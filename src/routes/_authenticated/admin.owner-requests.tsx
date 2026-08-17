import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Mail, Instagram, Globe, MessageSquare } from "lucide-react";
import {
  useAdminOwnerRequests,
  useApproveOwnerRequest,
  useRejectOwnerRequest,
} from "@/lib/owners-api";

export const Route = createFileRoute("/_authenticated/admin/owner-requests")({
  head: () => ({ meta: [{ title: "Zgłoszenia właścicieli — poŻeramy" }] }),
  component: OwnerRequestsPage,
});

function OwnerRequestsPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const { data, isLoading } = useAdminOwnerRequests(tab);
  const approve = useApproveOwnerRequest();
  const reject = useRejectOwnerRequest();

  return (
    <div>
      <h1 className="font-display text-3xl mb-4">Zgłoszenia właścicieli</h1>
      <div className="flex gap-2 mb-5">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`chip ${tab === t ? "bg-tomato text-cream" : "bg-card border border-border"}`}
          >
            {t === "pending" ? "Oczekujące" : t === "approved" ? "Zatwierdzone" : "Odrzucone"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="animate-spin text-tomato" size={28} />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zgłoszeń w tej kategorii.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-4 sm:items-start"
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg">{r.name}</span>
                  {r.place ? (
                    <Link
                      to="/k/$id"
                      params={{ id: r.place.slug || r.place.id }}
                      className="chip bg-navy text-cream text-xs"
                    >
                      {r.place.name}
                    </Link>
                  ) : (
                    <span className="chip bg-muted text-xs">Knajpa usunięta</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pl-PL")}
                  {!r.user_id && " · zgłoszenie bez konta użytkownika"}
                </div>
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-sm text-tomato hover:underline">
                  <Mail size={13} /> {r.email}
                </a>
                {r.instagram_url && (
                  <a href={r.instagram_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-navy/70 hover:text-tomato ml-3">
                    <Instagram size={13} /> Instagram
                  </a>
                )}
                {r.website_url && (
                  <a href={r.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-navy/70 hover:text-tomato ml-3">
                    <Globe size={13} /> www
                  </a>
                )}
                {r.message && (
                  <div className="mt-2 flex gap-2 text-sm text-navy/80">
                    <MessageSquare size={14} className="flex-shrink-0 mt-0.5 text-navy/50" />
                    <p className="whitespace-pre-wrap">{r.message}</p>
                  </div>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex sm:flex-col gap-2 sm:w-40">
                  <button
                    disabled={!r.user_id || approve.isPending}
                    onClick={async () => {
                      try {
                        await approve.mutateAsync(r.id);
                        toast.success("Zatwierdzono");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2 font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Zatwierdź
                  </button>
                  <button
                    disabled={reject.isPending}
                    onClick={async () => {
                      try {
                        await reject.mutateAsync(r.id);
                        toast.success("Odrzucono");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border-2 border-border px-4 py-2 font-semibold hover:border-tomato hover:text-tomato disabled:opacity-50"
                  >
                    <XCircle size={16} /> Odrzuć
                  </button>
                </div>
              )}
              {r.status !== "pending" && (
                <span
                  className={`chip ${r.status === "approved" ? "bg-emerald-600 text-white" : "bg-muted"}`}
                >
                  {r.status === "approved" ? "Zatwierdzone" : "Odrzucone"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
