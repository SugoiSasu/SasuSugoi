import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, PartyPopper, UserPlus2 } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { useInvitePreview, useAcceptInvite } from "@/lib/friends-api";
import { UserAvatar } from "@/components/UserAvatar";

export const Route = createFileRoute("/i/$token")({
  head: ({ params }) => ({
    meta: [
      { title: "Zaproszenie do poŻeramy" },
      { name: "description", content: "Ktoś zaprosił Cię do poŻeramy — dołącz i zostańcie znajomymi." },
      { property: "og:title", content: "Zaproszenie do znajomych — poŻeramy" },
      { property: "og:description", content: `Token: ${params.token.slice(0, 6)}…` },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading: userLoading } = useUser();
  const { data: preview, isLoading: previewLoading } = useInvitePreview(token);
  const accept = useAcceptInvite();
  const [accepted, setAccepted] = useState(false);

  const inviterName = preview?.inviter_display_name || (preview?.inviter_username ? `@${preview.inviter_username}` : "Ktoś");

  useEffect(() => {
    if (accept.isSuccess) setAccepted(true);
  }, [accept.isSuccess]);

  return (
    <main id="main-content" className="min-h-dvh bg-navy flex flex-col items-center justify-center p-4 text-cream">
      <div className="w-full max-w-md rounded-3xl bg-cream text-navy p-8 shadow-2xl text-center">
        {previewLoading || userLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-tomato" size={28} />
          </div>
        ) : !preview ? (
          <>
            <h1 className="font-display text-2xl mb-2">Nieprawidłowe zaproszenie</h1>
            <p className="text-sm text-muted-foreground mb-6">Ten link zaproszenia nie istnieje albo jest błędny.</p>
            <Link to="/" className="inline-flex rounded-full bg-tomato px-6 py-3 text-sm font-semibold text-cream">
              Wróć na stronę główną
            </Link>
          </>
        ) : accepted ? (
          <>
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-tomato/15 text-tomato">
              <PartyPopper size={26} />
            </div>
            <h1 className="font-display text-2xl mb-2">Jesteście znajomymi! 🎉</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Ty i {inviterName} możecie teraz widzieć swoje recenzje i miejscówki.
            </p>
            <Link to="/friends" className="inline-flex rounded-full bg-tomato px-6 py-3 text-sm font-semibold text-cream">
              Zobacz znajomych
            </Link>
          </>
        ) : (
          <>
            <UserAvatar
              avatarUrl={preview.inviter_avatar_url}
              displayName={preview.inviter_display_name}
              username={preview.inviter_username}
              size={64}
            />
            <h1 className="font-display text-2xl mt-4 mb-1">
              {inviterName} zaprasza Cię do poŻeramy!
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Dołącz, żeby zapisywać ulubione knajpy, zdobywać odznaki i widzieć co poleca Wasza ekipa.
            </p>

            {preview.expired ? (
              <p className="text-sm font-semibold text-destructive">To zaproszenie już wygasło.</p>
            ) : preview.status !== "pending" ? (
              <p className="text-sm font-semibold text-destructive">To zaproszenie zostało już wykorzystane.</p>
            ) : !user ? (
              <div className="flex flex-col gap-2">
                <Link
                  to="/auth"
                  search={{ redirect: `/i/${token}` }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-tomato px-6 py-3 text-sm font-semibold text-cream hover:bg-tomato/90"
                >
                  <UserPlus2 size={16} /> Załóż konto / Zaloguj się
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => accept.mutate(token)}
                disabled={accept.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-tomato px-6 py-3 text-sm font-semibold text-cream hover:bg-tomato/90 disabled:opacity-60"
              >
                {accept.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus2 size={16} />}
                Zostańcie znajomymi
              </button>
            )}

            {accept.isError && (
              <p className="mt-3 text-xs font-semibold text-destructive">{(accept.error as Error).message}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
