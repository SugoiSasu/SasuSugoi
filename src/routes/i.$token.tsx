import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Pizza } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { useAcceptInvite } from "@/lib/friends-api";

export const Route = createFileRoute("/i/$token")({
  head: ({ params }) => ({
    meta: [
      { title: "Zaproszenie do znajomych — poŻeramy" },
      { name: "description", content: "Dołącz do poŻeramy i zostań znajomym osoby, która Cię zaprosiła." },
      { property: "og:title", content: "Zaproszenie do znajomych — poŻeramy" },
      { property: "og:description", content: `Token: ${params.token.slice(0, 6)}…` },
    ],
  }),
  component: InviteLanding,
});

function InviteLanding() {
  const { token } = Route.useParams();
  const { user, loading } = useUser();
  const navigate = useNavigate();
  const accept = useAcceptInvite();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user || done || accept.isPending) return;
    accept.mutateAsync(token)
      .then(() => { setDone(true); toast.success("Macie nową znajomość 🎉"); })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Nie udało się zaakceptować zaproszenia.";
        toast.error(humanize(msg));
        setDone(true);
      });
  }, [user, done, accept, token]);

  return (
    <main id="main-content" className="min-h-dvh bg-navy text-cream grid place-items-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-3xl p-6 sm:p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-tomato/20 grid place-items-center">
          <Pizza className="text-tomato" size={28} />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl mb-2">Zaproszenie do znajomych</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Ktoś z poŻeramy chce dodać Cię do grona znajomych.
        </p>

        {loading ? (
          <Loader2 className="animate-spin mx-auto" />
        ) : !user ? (
          <>
            <p className="text-sm mb-4">Zaloguj się lub załóż konto, by zaakceptować zaproszenie.</p>
            <button
              type="button"
              onClick={() => { try { sessionStorage.setItem("pending_invite", token); } catch { /* noop */ } navigate({ to: "/auth" }); }}
              className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90"
            >
              <UserPlus size={16} /> Zaloguj się i dodaj
            </button>
          </>
        ) : accept.isPending ? (
          <div className="flex items-center justify-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Akceptuję zaproszenie…</div>
        ) : (
          <Link to="/friends" className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90">
            Przejdź do znajomych
          </Link>
        )}
      </div>
    </main>
  );
}

function humanize(msg: string) {
  if (msg.includes("invite_not_found")) return "Zaproszenie nie istnieje.";
  if (msg.includes("invite_used")) return "To zaproszenie zostało już użyte.";
  if (msg.includes("invite_expired")) return "Zaproszenie wygasło.";
  if (msg.includes("cannot_invite_self")) return "Nie możesz zaakceptować własnego zaproszenia.";
  if (msg.includes("blocked")) return "Nie można dodać — relacja zablokowana.";
  return msg;
}
