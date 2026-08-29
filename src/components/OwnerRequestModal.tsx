import { useState } from "react";
import { toast } from "sonner";
import { Loader2, X, Send, CheckCircle2 } from "lucide-react";
import { useUser } from "@/lib/use-auth";
import { Link } from "@tanstack/react-router";
import { useSubmitOwnerRequest, useMyOwnerRequestFor } from "@/lib/owners-api";

export function OwnerRequestModal({
  placeId,
  placeName,
  open,
  onClose,
}: {
  placeId: string;
  placeName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const { data: existing } = useMyOwnerRequestFor(placeId);
  const submit = useSubmitOwnerRequest();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");

  if (!open) return null;

  const alreadyPending = existing?.status === "pending";
  const alreadyApproved = existing?.status === "approved";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await submit.mutateAsync({
        placeId,
        name: name.trim(),
        email: email.trim(),
        instagram_url: instagram.trim() || undefined,
        website_url: website.trim() || undefined,
        message: message.trim() || undefined,
      });
      toast.success("Wysłano zgłoszenie. Zweryfikujemy je i odezwiemy się.");
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Coś poszło nie tak");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-foreground/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-req-title"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute top-3 right-3 w-9 h-9 rounded-full grid place-items-center bg-card/80 hover:bg-card text-foreground shadow"
        >
          <X size={18} />
        </button>
        <div className="p-6 sm:p-7">
          <h2 id="owner-req-title" className="font-display text-2xl mb-1 text-foreground">
            Zgłoś się jako właściciel
          </h2>
          <p className="text-sm text-foreground/70 mb-5">
            <strong>{placeName}</strong> - zweryfikujemy zgłoszenie i skontaktujemy się
            mailowo.
          </p>

          {!user ? (
            <div className="rounded-2xl border-2 border-tomato/40 bg-tomato/10 p-4 text-sm">
              Aby wysłać zgłoszenie,{" "}
              <Link to="/auth" className="font-bold text-tomato hover:underline">
                zaloguj się
              </Link>{" "} - powiążemy zgłoszenie z Twoim kontem.
            </div>
          ) : alreadyApproved ? (
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-foreground inline-flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" /> Jesteś już
              zweryfikowanym właścicielem tej knajpy.
            </div>
          ) : alreadyPending ? (
            <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
              Twoje zgłoszenie oczekuje na weryfikację. Odezwiemy się mailowo.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <Field label="Imię i nazwisko" required>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCx}
                  placeholder="Jan Kowalski"
                />
              </Field>
              <Field label="Email kontaktowy" required>
                <input
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCx}
                  placeholder="ty@example.com"
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Instagram (opcj.)">
                  <input
                    type="url"
                    maxLength={300}
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className={inputCx}
                    placeholder="https://instagram.com/…"
                  />
                </Field>
                <Field label="Strona www (opcj.)">
                  <input
                    type="url"
                    maxLength={300}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className={inputCx}
                    placeholder="https://…"
                  />
                </Field>
              </div>
              <Field label="Wiadomość (opcj.)">
                <textarea
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={inputCx + " min-h-[90px] resize-y"}
                  placeholder="Krótko o sobie i swojej roli w knajpie…"
                />
              </Field>
              <button
                type="submit"
                disabled={submit.isPending}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream px-5 py-3 font-bold shadow hover:bg-tomato/90 transition disabled:opacity-60"
              >
                {submit.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Wyślij zgłoszenie
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCx =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-tomato focus:ring-2 focus:ring-tomato/20 transition";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1">
        {label} {required && <span className="text-tomato">*</span>}
      </span>
      {children}
    </label>
  );
}
