import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Loader2, Check } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { usePlaces } from "@/lib/places-api";
import {
  useCurrentAwardsEvent,
  useMyAwardVotes,
  useCastAwardVote,
  useAwardWinners,
} from "@/lib/awards-api";
import { useCuisines } from "@/lib/cuisines-api";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/warte-pozarcia")({
  head: () => ({
    meta: [
      { title: "Warte poŻarcia - poŻeramy" },
      {
        name: "description",
        content: "Głosuj na najlepszy lokal w każdej kategorii kuchni w Poznaniu.",
      },
    ],
  }),
  component: WartePozarciaPage,
});

function WartePozarciaPage() {
  const { data: event, isLoading } = useCurrentAwardsEvent();

  if (isLoading) {
    return (
      <main id="main-content" className="grid min-h-[50vh] place-items-center">
        <Loader2 className="animate-spin text-tomato" size={28} />
      </main>
    );
  }

  if (!event) {
    return (
      <main id="main-content" className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Trophy size={36} className="mx-auto text-tomato mb-3" />
        <h1 className="font-display text-2xl mb-2">Brak aktywnego wydarzenia</h1>
        <p className="text-sm text-muted-foreground">
          „Warte poŻarcia" to doroczne głosowanie na najlepsze knajpy w Poznaniu. Wróć, kiedy
          ruszy kolejna edycja.
        </p>
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="text-center mb-8">
        <Trophy size={40} className="mx-auto text-mustard mb-2" />
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold">{event.name}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {event.status === "active"
            ? "Głosuj na najlepszy lokal w każdej kategorii - jeden głos na kategorię, możesz zmienić zdanie do zamknięcia głosowania."
            : "Głosowanie zamknięte. Oto zwycięzcy."}
        </p>
      </header>

      {event.status === "active" ? <VotingSection eventId={event.id} cuisineIds={event.cuisine_ids} /> : <ResultsSection eventId={event.id} />}
    </main>
  );
}

function VotingSection({ eventId, cuisineIds }: { eventId: string; cuisineIds: string[] }) {
  const { user } = useUser();

  if (!user) {
    return (
      <AuthGate
        icon={Trophy}
        title="Zaloguj się, żeby zagłosować"
        description="Jeden głos na kategorię, żeby wynik był uczciwy."
      />
    );
  }

  return <VotingCategories eventId={eventId} cuisineIds={cuisineIds} />;
}

function VotingCategories({ eventId, cuisineIds }: { eventId: string; cuisineIds: string[] }) {
  const { data: cuisines } = useCuisines();
  const { data: places } = usePlaces();
  const { data: myVotes } = useMyAwardVotes(eventId);
  const castVote = useCastAwardVote(eventId);

  const cuisineById = new Map((cuisines ?? []).map((c) => [c.id, c]));

  async function vote(cuisineId: string, placeId: string) {
    try {
      await castVote.mutateAsync({ cuisineId, placeId });
    } catch {
      // toast not needed - button state reflects the result
    }
  }

  return (
    <div className="space-y-8">
      {cuisineIds.map((cid) => {
        const cuisine = cuisineById.get(cid);
        if (!cuisine) return null;
        const candidates = (places ?? []).filter(
          (p) => p.cuisine === cuisine.name && p.is_published !== false,
        );
        const myPick = myVotes?.get(cid);
        return (
          <section key={cid}>
            <h2 className="font-display text-xl mb-3">
              {cuisine.emoji} {cuisine.name}
            </h2>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak lokali w tej kategorii.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {candidates.map((p) => {
                  const picked = myPick === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => vote(cid, p.id)}
                      disabled={castVote.isPending}
                      className={`text-left rounded-2xl border-2 p-3 transition disabled:opacity-60 ${
                        picked
                          ? "border-tomato bg-tomato/10"
                          : "border-border bg-card hover:border-tomato/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{p.name}</span>
                        {picked && <Check size={16} className="text-tomato shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ResultsSection({ eventId }: { eventId: string }) {
  const { data: winners, isLoading } = useAwardWinners(eventId);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="animate-spin text-tomato" size={28} />
      </div>
    );
  }

  if (!winners || winners.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">Brak wyników.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {winners.map((w) => (
        <Link
          key={w.id}
          to="/k/$id"
          params={{ id: w.place?.slug ?? w.place?.id ?? "" }}
          className="rounded-2xl border-2 border-mustard bg-mustard/10 p-4 hover:bg-mustard/15 transition"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-navy/70 mb-1">
            {w.cuisine?.emoji} {w.cuisine?.name}
          </p>
          <p className="font-display text-lg font-bold flex items-center gap-1.5">
            <Trophy size={18} className="text-mustard" /> {w.place?.name ?? "Knajpa usunięta"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{w.vote_count} głosów</p>
        </Link>
      ))}
    </div>
  );
}
