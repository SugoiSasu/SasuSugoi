import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trophy, Loader2, Check, Send, Lock } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { usePlaces, type Place } from "@/lib/places-api";
import {
  useCurrentAwardsEvent,
  useMyAwardVotes,
  useHasSubmittedBallot,
  useSubmitAwardBallot,
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
            ? "Wybierz najlepszy lokal w każdej kategorii i wyślij głosy jednym kliknięciem - to jednorazowe, bez możliwości zmiany później."
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
        description="Jeden komplet głosów na konto, żeby wynik był uczciwy."
      />
    );
  }

  return <VotingGate eventId={eventId} cuisineIds={cuisineIds} />;
}

function VotingGate({ eventId, cuisineIds }: { eventId: string; cuisineIds: string[] }) {
  const { data: hasSubmitted, isLoading } = useHasSubmittedBallot(eventId);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="animate-spin text-tomato" size={28} />
      </div>
    );
  }

  if (hasSubmitted) {
    return <SubmittedBallot eventId={eventId} cuisineIds={cuisineIds} />;
  }

  return <VotingCategories eventId={eventId} cuisineIds={cuisineIds} />;
}

function SubmittedBallot({ eventId, cuisineIds }: { eventId: string; cuisineIds: string[] }) {
  const { data: cuisines } = useCuisines();
  const { data: places } = usePlaces();
  const { data: myVotes } = useMyAwardVotes(eventId);
  const cuisineById = new Map((cuisines ?? []).map((c) => [c.id, c]));
  const placeById = new Map((places ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 rounded-2xl border-2 border-tomato/40 bg-tomato/10 px-4 py-3 text-sm font-semibold text-foreground">
        <Lock size={16} className="text-tomato shrink-0" /> Głosy wysłane - dzięki! Nie da się już ich zmienić.
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cuisineIds.map((cid) => {
          const cuisine = cuisineById.get(cid);
          const placeId = myVotes?.get(cid);
          const place = placeId ? placeById.get(placeId) : undefined;
          if (!cuisine) return null;
          return (
            <div key={cid} className="rounded-2xl border-2 border-border bg-card p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1">
                {cuisine.emoji} {cuisine.name}
              </p>
              <p className="text-sm font-semibold">{place?.name ?? "-"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VotingCategories({ eventId, cuisineIds }: { eventId: string; cuisineIds: string[] }) {
  const { data: cuisines } = useCuisines();
  const { data: places } = usePlaces();
  const submitBallot = useSubmitAwardBallot(eventId);
  const [picks, setPicks] = useState<Record<string, string>>({});

  // Picking any single candidate re-renders this component, and none of the
  // derivation below depends on `picks` - without memoizing it, every click
  // through a ~12-category ballot re-scanned the full city-wide places list
  // twice per category for no reason.
  const { cuisineById, placesByCuisineName, validCuisineIds } = useMemo(() => {
    const cuisineById = new Map((cuisines ?? []).map((c) => [c.id, c]));
    const placesByCuisineName = new Map<string, Place[]>();
    for (const p of places ?? []) {
      if (p.is_published === false) continue;
      const list = placesByCuisineName.get(p.cuisine);
      if (list) list.push(p);
      else placesByCuisineName.set(p.cuisine, [p]);
    }
    const validCuisineIds = cuisineIds.filter((cid) => {
      const cuisine = cuisineById.get(cid);
      return !!cuisine && (placesByCuisineName.get(cuisine.name)?.length ?? 0) > 0;
    });
    return { cuisineById, placesByCuisineName, validCuisineIds };
  }, [cuisines, cuisineIds, places]);
  const pickedCount = validCuisineIds.filter((cid) => picks[cid]).length;
  const allPicked = validCuisineIds.length > 0 && pickedCount === validCuisineIds.length;

  async function submit() {
    try {
      await submitBallot.mutateAsync(
        Object.entries(picks).map(([cuisineId, placeId]) => ({ cuisineId, placeId })),
      );
      toast.success("Głosy wysłane! Dzięki za udział.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wysłać głosów.");
    }
  }

  return (
    <div className="space-y-8 pb-24">
      {cuisineIds.map((cid) => {
        const cuisine = cuisineById.get(cid);
        if (!cuisine) return null;
        const candidates = placesByCuisineName.get(cuisine.name) ?? [];
        const myPick = picks[cid];
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
                      onClick={() => setPicks((prev) => ({ ...prev, [cid]: p.id }))}
                      className={`text-left rounded-2xl border-2 p-3 transition ${
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <span className="text-sm font-semibold text-muted-foreground">
            Wybrano {pickedCount}/{validCuisineIds.length}
          </span>
          <button
            onClick={submit}
            disabled={!allPicked || submitBallot.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-6 py-2.5 font-semibold disabled:opacity-50"
          >
            {submitBallot.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Wyślij głosy
          </button>
        </div>
      </div>
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
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1">
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
