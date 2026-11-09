import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMyReviewForPlace, useSaveReview } from "@/lib/reviews-api";
import { useUser } from "@/lib/use-auth";

/**
 * Szybki check-in: po "Byłem tutaj" jedno dotknięcie ocenia lokal w trzech stopniach, bez pisania.
 * Wpada do zwykłych opinii (5 / 3 / 2 gwiazdki, bez treści), więc działają punkty, feed i średnie ocen.
 * Nie pokazuje się, gdy użytkownik ocenił już ten lokal (żeby nie nadpisać jego opinii).
 * Zasada z badania rynku: ocena ma kosztować maksymalnie 3 dotknięcia, nigdy obowiązkowe porównania.
 */
export const OCENY_SZYBKIE = [
  { klucz: "super", emoji: "😍", etykieta: "Super", gwiazdki: 5 },
  { klucz: "ok", emoji: "🙂", etykieta: "Ok", gwiazdki: 3 },
  { klucz: "nie", emoji: "😕", etykieta: "Nie", gwiazdki: 2 },
] as const;

export function JakByloSheet({
  placeId,
  open,
  onOpenChange,
}: {
  placeId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useUser();
  const { data: moja, isLoading } = useMyReviewForPlace(placeId, user?.id);
  const zapisz = useSaveReview();

  // Użytkownik już ocenił ten lokal - nie nadpisujemy jego opinii.
  if (!isLoading && moja) return null;

  function ocen(gwiazdki: number, etykieta: string) {
    zapisz.mutate(
      { values: { place_id: placeId, rating: gwiazdki, body: null, photo_url: null } },
      {
        onSuccess: () => {
          toast.success(`Dzięki! Oceniono: ${etykieta}`, { description: "Możesz dopisać opinię na stronie lokalu." });
          onOpenChange(false);
        },
        onError: (e) => toast.error((e as Error).message || "Nie udało się zapisać oceny"),
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl font-extrabold">Jak było?</SheetTitle>
          <SheetDescription>Jedno dotknięcie wystarczy. Opis możesz dodać później.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {OCENY_SZYBKIE.map((o) => (
            <button
              key={o.klucz}
              type="button"
              onClick={() => ocen(o.gwiazdki, o.etykieta)}
              disabled={zapisz.isPending}
              className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border bg-card text-sm font-extrabold transition hover:border-tomato active:scale-[0.97] disabled:opacity-60"
            >
              {zapisz.isPending ? <Loader2 className="animate-spin" size={22} aria-hidden="true" /> : <span className="text-3xl leading-none" aria-hidden="true">{o.emoji}</span>}
              {o.etykieta}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-3 min-h-11 w-full rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Pomiń
        </button>
      </SheetContent>
    </Sheet>
  );
}
