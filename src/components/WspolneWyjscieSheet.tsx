import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/UserAvatar";
import { PlaceLogo } from "@/components/PlaceLogo";
import { cuisineMeta } from "@/data/places";
import type { Place } from "@/lib/places-api";
import { MAX_LOKALI, MAX_ZNAJOMYCH, useUtworzWyjscie, useZapraszalniZnajomi } from "@/lib/outing-api";

/**
 * Arkusz "Wspólne wyjście" w Kartach: wybierasz do 5 znajomych, talia to pierwsze 8 lokali z Twoich filtrów Kart.
 * Zaproszenie dostają jako powiadomienie; wszyscy głosują tak/nie na te same lokale, wygrywa najwięcej "tak".
 */
export function WspolneWyjscieSheet({
  open,
  onOpenChange,
  lokale,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Aktualna talia Kart (po filtrach); bierzemy z niej do 8 pierwszych. */
  lokale: Place[];
}) {
  const navigate = useNavigate();
  const { data: znajomi, isLoading } = useZapraszalniZnajomi();
  const utworz = useUtworzWyjscie();
  const [wybrani, setWybrani] = useState<string[]>([]);
  const talia = lokale.slice(0, MAX_LOKALI);

  function przelacz(id: string) {
    setWybrani((w) => {
      if (w.includes(id)) return w.filter((x) => x !== id);
      if (w.length >= MAX_ZNAJOMYCH) {
        toast.message(`Maksymalnie ${MAX_ZNAJOMYCH} znajomych`);
        return w;
      }
      return [...w, id];
    });
  }

  function start() {
    utworz.mutate(
      { znajomi: wybrani, lokale: talia.map((p) => p.id) },
      {
        onSuccess: (id) => {
          onOpenChange(false);
          setWybrani([]);
          void navigate({ to: "/wyjscie/$id", params: { id } });
        },
        onError: (e) => toast.error((e as Error).message || "Nie udało się utworzyć wyjścia"),
      },
    );
  }

  const gotowe = wybrani.length >= 1 && talia.length >= 2 && !utworz.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl font-extrabold">Wspólne wyjście</SheetTitle>
          <SheetDescription>
            Wybierz znajomych. Wszyscy głosują „tak” albo „nie” na te same lokale, a Wy zobaczycie, na co się zgadzacie.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Z kim ({wybrani.length}/{MAX_ZNAJOMYCH})
          </p>
          {isLoading ? (
            <Loader2 className="mx-auto my-6 animate-spin" aria-label="Ładowanie" />
          ) : !znajomi || znajomi.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm">
              <p className="text-muted-foreground">Nie masz jeszcze znajomych, których można zaprosić.</p>
              <Link
                to="/friends"
                search={{ tab: "invite" }}
                className="mt-3 inline-flex min-h-11 items-center rounded-full bg-tomato px-5 text-xs font-semibold text-cream"
              >
                Zaproś znajomych
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {znajomi.map((z) => {
                const on = wybrani.includes(z.id);
                return (
                  <li key={z.id}>
                    <button
                      type="button"
                      onClick={() => przelacz(z.id)}
                      aria-pressed={on}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition ${
                        on ? "border-tomato bg-tomato/10" : "border-border bg-card hover:border-tomato/50"
                      }`}
                    >
                      <UserAvatar
                        avatarUrl={z.avatar_url}
                        avatarSource={z.avatar_source}
                        displayName={z.display_name}
                        username={z.username}
                        size={36}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{z.display_name || z.username}</span>
                        {z.username && z.display_name && (
                          <span className="block truncate text-xs text-muted-foreground">@{z.username}</span>
                        )}
                      </span>
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                          on ? "border-tomato bg-tomato text-cream" : "border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {on && <Check size={14} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Talia z Twoich filtrów ({talia.length})
          </p>
          {talia.length < 2 ? (
            <p className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              W Kartach zostało za mało lokali. Poszerz obszar albo zresetuj karty.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {talia.map((p) => {
                const meta = cuisineMeta(p.cuisine);
                return (
                  <li key={p.id} className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-xs font-semibold">
                    <PlaceLogo
                      tryb="lekki"
                      name=""
                      avatarUrl={p.avatar_url}
                      fallbackEmoji={meta.emoji}
                      fallbackColor={`${meta.color}33`}
                      className="h-6 w-6 text-[11px]"
                    />
                    <span className="max-w-[9rem] truncate">{p.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={start}
          disabled={!gotowe}
          className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tomato py-3.5 text-sm font-extrabold text-cream disabled:opacity-50"
        >
          {utworz.isPending ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} aria-hidden="true" />}
          Zaproś i zagłosuj
        </button>
      </SheetContent>
    </Sheet>
  );
}
