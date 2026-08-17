import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Mail, Package, Sparkles, Video, Camera, Utensils, Handshake } from "lucide-react";
import { submitCollab } from "@/lib/collab.functions";
import { COLLAB_CONSENT_VERSION } from "@/lib/consent";
import { SmartText } from "@/components/SmartText";
import { trackEvent } from "@/lib/analytics";
import logoDark from "@/assets/brand/po_zeramy-logo-dark.png.asset.json";

export const Route = createFileRoute("/wspolpraca")({
  head: () => ({
    meta: [
      { title: "Współpraca i wysyłka produktów — poŻeramy" },
      {
        name: "description",
        content:
          "Chcesz podjąć współpracę z poŻeramy albo wysłać produkt do recenzji? Sprawdź, jak to zrobić i wyślij zgłoszenie — trafi ono bezpośrednio do naszego panelu.",
      },
      { property: "og:title", content: "Współpraca z poŻeramy" },
      {
        property: "og:description",
        content:
          "Rolki, recenzje, wysyłka produktów, eventy. Napisz do nas — odpowiadamy w 48h.",
      },
      { property: "og:image", content: logoDark.url },
    ],
  }),
  component: WspolpracaPage,
});

function WspolpracaPage() {
  return (
    <main id="main-content" className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <BackButton to="/" label="Wróć na stronę główną" />
      </div>

      <section className="pb-10 sm:pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <span className="chip bg-blush text-navy mb-4">Dla marek i lokali</span>
            <h1 className="text-4xl sm:text-5xl mb-5 text-balance font-display">
              <SmartText>
                Współpraca, która naprawdę<br /> trafia do <span className="text-tomato">głodnych</span>.
              </SmartText>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Tworzymy rolki, posty i recenzje oglądane przez lokalnych foodies w Poznaniu.
              Działamy długofalowo, a nie „raz i znikam". Możesz umówić się na wizytę
              albo wysłać nam produkt do recenzji — poniższy formularz trafia
              bezpośrednio do naszego panelu.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { n: "5k+", l: "Followersów IG" },
                { n: "200 tys.", l: "Zasięg / miesiąc" },
                { n: "85%", l: "Audience z Poznania" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-card border border-border p-4 text-center card-hover">
                  <div className="font-display text-3xl font-bold text-tomato">{s.n}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">{s.l}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-3">
              {[
                { icon: Video, t: "Reels & TikToki", d: "Dedykowane treści krótkie pod lokal lub markę." },
                { icon: Camera, t: "Foto-content", d: "Zdjęcia do wykorzystania w Waszej komunikacji." },
                { icon: Utensils, t: "Recenzje w stories", d: "Zapisane highlighty, których nie zjada algorytm." },
                { icon: Handshake, t: "Eventy i premiery", d: "Tasting nights, otwarcia, kolaboracje sezonowe." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="rounded-2xl border border-border bg-card p-4">
                  <Icon size={20} className="text-tomato mb-2" />
                  <div className="font-display text-base mb-1">{t}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Package size={18} className="text-tomato" />
                <h2 className="font-display text-lg">Wysyłka produktów do recenzji</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Chcesz podesłać nam próbkę, menu w pudełku albo nowy produkt? Napisz
                w formularzu obok — po ustaleniu szczegółów odeślemy adres do wysyłki.
                Wszystkie zgłoszenia trafiają do naszego panelu, więc żadne nie zginie.
              </p>
            </div>
          </div>

          <CollabForm />
        </div>
      </section>
    </main>
  );
}

function CollabForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);

  const mountedAt = useMemo(() => Date.now(), []);
  const submitCollabFn = useServerFn(submitCollab);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConsentError(false);
    const data = new FormData(e.currentTarget);
    const brand = String(data.get("brand") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const honey = String(data.get("company_website") ?? "").trim();
    const elapsed = Date.now() - mountedAt;

    if (!consent) {
      setConsentError(true);
      setError("Zgoda RODO jest wymagana, aby wysłać formularz.");
      document.getElementById("gdpr_consent")?.focus();
      return;
    }
    if (honey) { setError("Wykryto bota. Spróbuj ponownie."); return; }
    if (elapsed < 3000) {
      setError("Zwolnij na chwilę — wyślij formularz po krótkim odczekaniu.");
      return;
    }
    if (brand.length < 2 || brand.length > 100) {
      setError("Podaj nazwę marki lub lokalu (2–100 znaków)."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      setError("Podaj poprawny adres email."); return;
    }
    if (message.length < 10 || message.length > 2000) {
      setError("Wiadomość powinna mieć 10–2000 znaków."); return;
    }
    const linkCount = (message.match(/https?:\/\//gi) ?? []).length;
    if (linkCount > 4) { setError("Za dużo linków w wiadomości."); return; }

    setSubmitting(true);
    try {
      await submitCollabFn({
        data: {
          brand,
          email,
          message,
          consent: true,
          contact_consent: contactConsent,
          consent_version: COLLAB_CONSENT_VERSION,
          honeypot: honey,
          elapsed_ms: elapsed,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : undefined,
        },
      });

      setSent(true);
      trackEvent("collab_form_submit", {
        contact_consent: contactConsent,
        message_len: message.length,
        elapsed_ms: elapsed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Coś poszło nie tak. Spróbuj ponownie.";
      setError(msg);
      trackEvent("collab_form_error", { reason: msg.slice(0, 80) });
    } finally {
      setSubmitting(false);
    }
  }


  if (sent) {
    return (
      <div className="rounded-3xl bg-navy text-cream p-8 shadow-[0_24px_60px_-30px_rgba(34,30,80,0.6)] relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 blob bg-tomato opacity-30" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 blob bg-blush opacity-25" />
        <div className="relative text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-tomato grid place-items-center mb-4">
            <Sparkles size={26} />
          </div>
          <h3 className="font-display text-2xl mb-2">Dzięki za wiadomość!</h3>
          <p className="text-cream/80 text-sm mb-4">
            Zgłoszenie trafiło do naszego panelu. Odpowiadamy w ciągu 48h na adres
            e-mail, który podałeś.
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setConsent(false); setContactConsent(false); }}
            className="inline-flex items-center gap-2 rounded-full bg-cream/10 hover:bg-cream/20 border border-cream/30 text-cream px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato"
          >
            Wyślij kolejną wiadomość
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-3xl bg-navy text-cream p-6 sm:p-8 shadow-[0_24px_60px_-30px_rgba(34,30,80,0.6)] relative overflow-hidden md:sticky md:top-20"
    >
      <div className="absolute -top-16 -right-16 w-48 h-48 blob bg-tomato opacity-30" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 blob bg-blush opacity-25" />
      <div className="relative">
        <h2 className="font-display text-2xl mb-1">Powiedz cześć</h2>
        <p className="text-cream/70 text-sm mb-6">Wiadomość trafia prosto do naszego panelu. Odpowiadamy w 48h.</p>

        <div className="space-y-3">
          <Field name="brand" label="Marka / lokal" placeholder="np. Pizza Forte" required maxLength={100} />
          <Field name="email" type="email" label="Email" placeholder="ty@firma.pl" required maxLength={200} />
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 text-cream/80" htmlFor="collab_message">Wiadomość</label>
            <textarea
              id="collab_message"
              name="message" required rows={5} minLength={10} maxLength={2000}
              placeholder="Napisz o pomyśle na współpracę lub o produkcie, który chcesz wysłać."
              className="w-full rounded-xl bg-cream/10 border border-cream/20 px-4 py-3 text-cream placeholder:text-cream/40 outline-none focus:border-tomato focus:bg-cream/15 transition"
            />
          </div>

          <div className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${consentError ? "bg-tomato/15 border border-tomato/50" : "bg-cream/[0.04] border border-transparent"}`}>
            <input
              id="gdpr_consent"
              name="gdpr_consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setConsentError(false); }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded accent-tomato border border-cream/40 bg-cream/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
              aria-required="true"
              aria-invalid={consentError}
            />
            <div className="min-w-0">
              <label htmlFor="gdpr_consent" className="block text-sm text-cream/95 leading-relaxed cursor-pointer">
                Wyrażam zgodę na przetwarzanie moich danych osobowych podanych w formularzu w celu odpowiedzi na zapytanie.{" "}
                <a
                  href="/polityka-prywatnosci"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold text-blush hover:text-tomato rounded"
                >
                  Polityka prywatności
                </a>.
              </label>
              <p className="text-[11px] text-cream/55 mt-1">
                Wymagane. Zapisujemy wersję klauzuli ({COLLAB_CONSENT_VERSION}) i datę akceptacji.
              </p>
              {consentError && (
                <p className="text-xs text-tomato mt-1 font-semibold" role="alert">
                  Zaznacz zgodę RODO, aby kontynuować.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 bg-cream/[0.04] border border-transparent">
            <input
              id="contact_consent"
              name="contact_consent"
              type="checkbox"
              checked={contactConsent}
              onChange={(e) => setContactConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded accent-tomato border border-cream/40 bg-cream/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            />
            <label htmlFor="contact_consent" className="block text-sm text-cream/95 leading-relaxed cursor-pointer">
              Chcę otrzymać e-mailowe potwierdzenie zgłoszenia na podany adres.
              <span className="block text-[11px] text-cream/55 mt-1">
                Opcjonalne. Jeden e-mail z podsumowaniem — możesz się wypisać w każdej chwili linkiem w stopce wiadomości.
              </span>
            </label>
          </div>


          <div aria-hidden="true" className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden" tabIndex={-1}>
            <label>
              Strona firmowa (zostaw puste)
              <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        </div>

        {error && !consentError && (
          <div role="alert" className="mt-4 rounded-xl bg-tomato/15 border border-tomato/40 text-cream text-sm px-4 py-2.5">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold hover:scale-[1.02] transition disabled:opacity-60 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
        >
          <Mail size={18} /> {submitting ? "Wysyłam…" : "Wyślij zgłoszenie"}
        </button>
        <p className="text-xs text-cream/60 mt-3 text-center">
          albo napisz wprost: <a href="mailto:po_zeramy@gmail.com" onClick={() => trackEvent("contact_email_click", { location: "wspolpraca" })} className="underline">po_zeramy@gmail.com</a>
        </p>
      </div>
    </form>
  );
}

function Field({ name, label, type = "text", ...rest }: { name: string; label: string; type?: string; placeholder?: string; required?: boolean; maxLength?: number }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 text-cream/80">{label}</label>
      <input
        name={name} type={type}
        className="w-full rounded-xl bg-cream/10 border border-cream/20 px-4 py-3 text-cream placeholder:text-cream/40 outline-none focus:border-tomato focus:bg-cream/15 transition"
        {...rest}
      />
    </div>
  );
}
