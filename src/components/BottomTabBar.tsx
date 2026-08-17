import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Map, Bookmark, User as UserIcon, Plus, Star, Store, Camera, X } from "lucide-react";
import { useMyProfile } from "@/lib/profile-api";
import { toast } from "sonner";

// Only these two go left of the center FAB — "Moje miejsca" and "Profil"
// are rendered explicitly on the right since "Profil" needs conditional auth logic.
const leftTabs = [
  { to: "/", label: "Odkrywaj", icon: Compass, exact: true },
  { to: "/mapa", label: "Mapa", icon: Map, exact: false },
] as const;

/** Mobile bottom tab bar with a central coral FAB. */
export function BottomTabBar() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: profile } = useMyProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact: boolean) => (exact ? pathname === to : pathname.startsWith(to));

  const itemCls = (active: boolean) =>
    `flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
      active ? "text-tomato" : "text-muted-foreground"
    }`;

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Zamknij"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Co robimy?</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Zamknij"
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-2">
              <Link
                to="/mapa"
                onClick={() => {
                  setSheetOpen(false);
                  toast.success("Otwieram mapę", {
                    description: "Wybierz lokal z mapy, a potem dodaj ocenę na jego profilu.",
                  });
                }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold active:scale-[0.99]"
              >
                <Star size={18} className="text-tomato" />
                <span className="min-w-0">
                  Znajdź knajpę i oceń
                  <span className="block text-xs font-normal text-muted-foreground">Wybierz lokal na mapie i dodaj recenzję</span>
                </span>
              </Link>
              <Link
                to="/wall"
                onClick={() => {
                  setSheetOpen(false);
                  toast.success("Przechodzę na Pożeralnię", {
                    description: profile?.username
                      ? "Dodaj wpis ze zdjęciem w formularzu na górze."
                      : "Zaloguj się, żeby wrzucić zdjęcie.",
                  });
                }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold active:scale-[0.99]"
              >
                <Camera size={18} className="text-tomato" />
                <span className="min-w-0">
                  Wrzuć zdjęcie na Pożeralnię
                  <span className="block text-xs font-normal text-muted-foreground">Pokaż, co dziś poŻerasz</span>
                </span>
              </Link>
              <Link
                to="/"
                hash="zglos-lokal"
                onClick={() => {
                  setSheetOpen(false);
                  toast.success("Formularz zgłoszenia lokalu", {
                    description: "Przewijam do sekcji zgłoszeń na stronie głównej.",
                  });
                }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold active:scale-[0.99]"
              >
                <Store size={18} className="text-tomato" />
                <span className="min-w-0">
                  Zgłoś nowy lokal
                  <span className="block text-xs font-normal text-muted-foreground">Brakuje knajpy? Dopisz ją</span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Nawigacja główna"
        className="pz-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {leftTabs.map(({ to, label, icon: Icon, exact }) => (
            <Link key={to} to={to} className={itemCls(isActive(to, exact))}>
              <Icon size={20} />
              <span className="truncate">{label}</span>
            </Link>
          ))}

          <div className="flex w-16 shrink-0 items-start justify-center">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Dodaj"
              className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-tomato text-cream shadow-lg shadow-tomato/30 transition active:scale-95"
            >
              <Plus size={26} />
            </button>
          </div>

          <Link to="/moje-miejsca" className={itemCls(isActive("/moje-miejsca", false))}>
            <Bookmark size={20} />
            <span className="truncate">Moje miejsca</span>
          </Link>

          {profile?.username ? (
            <Link
              to="/u/$username"
              params={{ username: profile.username }}
              className={itemCls(pathname.startsWith("/u/"))}
            >
              <UserIcon size={20} />
              <span className="truncate">Profil</span>
            </Link>
          ) : (
            <Link to="/auth" className={itemCls(pathname.startsWith("/auth"))}>
              <UserIcon size={20} />
              <span className="truncate">Profil</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
