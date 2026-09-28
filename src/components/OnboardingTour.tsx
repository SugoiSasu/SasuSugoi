import { useEffect, useState } from "react";
import { MapPin, Star, Trophy, Users, Sparkles, X, ChevronLeft } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { hasSeenOnboarding, markOnboardingSeen, onOnboardingOpenRequest } from "@/lib/onboarding";
import { useMyProfile, useUpdateProfile } from "@/lib/profile-api";

interface Step {
  icon: React.ElementType;
  title: string;
  body: string;
  accent: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    // Podmieniane na forme zenska w komponencie, gdy znamy plec.
    title: "Cześć, poŻeraczu! 👋",
    body: "Krótko pokażemy Ci, co można robić w poŻeramy - zajmie to góra 30 sekund.",
    accent: "bg-tomato",
  },
  {
    icon: MapPin,
    title: "Znajdź knajpę w Poznaniu",
    body: "Przeglądaj mapę, filtruj po kuchni i ocenie, sprawdzaj co jest otwarte teraz.",
    accent: "bg-navy",
  },
  {
    icon: Star,
    title: "Oceniaj i zbieraj punkty PoŻarcia",
    body: "Za recenzję, zdjęcie w recenzji i pierwszą wizytę w nowym miejscu dostajesz punkty.",
    accent: "bg-tomato",
  },
  {
    icon: Trophy,
    title: "Zdobywaj odznaki i awansuj",
    body: "Ponad 70 odznak do zdobycia - od pierwszej recenzji po tytuł Legendy poŻeramy.",
    accent: "bg-navy",
  },
  {
    icon: Users,
    title: "Rywalizuj ze znajomymi",
    body: "Zapraszaj znajomych, sprawdzaj ranking i śledź ich ulubione miejscówki na Pożeralni.",
    accent: "bg-tomato",
  },
];

export function OnboardingTour() {
  const { user, loading } = useUser();
  // Server-side flag is the source of truth (survives cache clears / new
  // devices); localStorage only avoids a flash of the tour while this
  // query is still loading right after sign-in.
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !user || profileLoading) return;
    if (profile?.onboarding_seen_at) {
      markOnboardingSeen(user.id);
      return;
    }
    if (!hasSeenOnboarding(user.id)) {
      setStep(0);
      setOpen(true);
    }
  }, [user, loading, profile, profileLoading]);

  useEffect(() => {
    return onOnboardingOpenRequest(() => {
      setStep(0);
      setOpen(true);
    });
  }, []);

  function close() {
    setOpen(false);
    if (user) {
      markOnboardingSeen(user.id);
      if (!profile?.onboarding_seen_at) {
        updateProfile.mutate({ onboarding_seen_at: new Date().toISOString() });
      }
    }
  }

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const s =
    step === 0 && profile?.gender === "K" ? { ...STEPS[0], title: "Cześć, poŻeraczko! 👋" } : STEPS[step];
  const Icon = s.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jak działa poŻeramy"
      className="fixed inset-0 z-[100] grid place-items-center bg-navy/70 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-card shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-300"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Zamknij"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X size={16} />
        </button>

        <div
          key={step}
          className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl text-cream animate-in fade-in zoom-in-95 duration-300 ${s.accent}`}
        >
          <Icon size={28} />
        </div>

        <h2 className="mt-5 text-center font-display text-xl font-extrabold">{s.title}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">{s.body}</p>

        {/* Nick nadaje baza automatycznie przy zakladaniu konta (z imienia
            albo "pozeracz"+cyfry). Tu - raz, na starcie - zacheta do wlasnego.
            Edycja na miejscu, a nie odeslanie do Ustawien: przejscie tam
            zamknelo by powitanie i reszta krokow by przepadla. */}
        {step === 0 && profile?.username && <NickNudge obecny={profile.username} plec={profile.gender} />}

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-tomato" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:border-tomato hover:text-tomato"
            >
              <ChevronLeft size={15} /> Wstecz
            </button>
          ) : (
            <button
              type="button"
              onClick={close}
              className="text-sm text-muted-foreground hover:text-foreground px-2"
            >
              Pomiń
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="ml-auto flex-1 rounded-full bg-tomato text-cream py-2.5 text-sm font-semibold hover:bg-tomato/90 transition"
          >
            {isLast ? "Zaczynamy! 🍽️" : "Dalej"}
          </button>
        </div>
      </div>
    </div>
  );
}

const WZOR_NICKU = /^[a-z0-9_]{3,20}$/;

/** Nick zastepczy nadany przez baze - tylko jego forme zmienia wybor plci. */
const NICK_ZASTEPCZY = /^pozeracz(ka)?\d{4}$/;

function NickNudge({ obecny, plec }: { obecny: string; plec: "M" | "K" | null }) {
  const update = useUpdateProfile();
  const [edycja, setEdycja] = useState(false);
  const [wartosc, setWartosc] = useState(obecny);
  const [blad, setBlad] = useState<string | null>(null);

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    const nick = wartosc.trim().toLowerCase();
    if (nick === obecny) {
      setEdycja(false);
      return;
    }
    // Te same reguly i te same komunikaty co w Ustawieniach - inaczej jedno
    // miejsce przepuszczaloby nick, ktory drugie odrzuca.
    if (!WZOR_NICKU.test(nick)) {
      setBlad("3-20 znaków: małe litery a-z, cyfry 0-9 i podkreślnik _.");
      return;
    }
    try {
      await update.mutateAsync({ username: nick });
      setBlad(null);
      setEdycja(false);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      setBlad(
        msg.includes("unique") || msg.includes("duplicate")
          ? `@${nick} jest już zajęty - wybierz inny.`
          : "Nie udało się zapisać nicku.",
      );
    }
  }

  if (!edycja) {
    return (
      <div className="mt-4 space-y-2">
      {/* Google nie podaje plci, wiec konto z Google dostaje meska forme
          "pozeracz####". Jeden klik ustawia plec, a baza sama zamienia nick
          zastepczy na "pozeraczka####" (trigger profiles_gendered_auto_username). */}
      {!plec && NICK_ZASTEPCZY.test(obecny) && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-muted-foreground">Jestem:</span>
          {(
            [
              ["M", "poŻeracz"],
              ["K", "poŻeraczka"],
            ] as const
          ).map(([v, etykieta]) => (
            <button
              key={v}
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ gender: v })}
              className="rounded-full border border-border px-3 py-1 font-semibold hover:border-tomato hover:text-tomato disabled:opacity-50"
            >
              {etykieta}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-muted/60 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Twój nick:</span>
        <span className="font-bold">@{obecny}</span>
        <button
          type="button"
          onClick={() => {
            setWartosc(obecny);
            setEdycja(true);
          }}
          className="ml-1 text-xs font-bold text-tomato hover:underline"
        >
          Zmień
        </button>
      </div>
      </div>
    );
  }

  return (
    <form onSubmit={zapisz} className="mt-4 space-y-1.5">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-1.5 focus-within:border-tomato">
        <span className="text-sm font-bold text-muted-foreground">@</span>
        <input
          autoFocus
          value={wartosc}
          onChange={(e) => {
            setWartosc(e.target.value.toLowerCase());
            setBlad(null);
          }}
          maxLength={20}
          aria-label="Nowy nick"
          aria-invalid={!!blad}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm font-bold outline-none"
        />
        <button
          type="submit"
          disabled={update.isPending}
          className="rounded-full bg-tomato px-3 py-1.5 text-xs font-bold text-cream disabled:opacity-50"
        >
          {update.isPending ? "…" : "Zapisz"}
        </button>
      </div>
      {blad && <p className="text-center text-xs font-semibold text-destructive">{blad}</p>}
    </form>
  );
}
