import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { passwordStrengthError } from "@/lib/password";

export const Route = createFileRoute("/auth/confirm")({
  head: () => ({
    meta: [{ title: "Potwierdzanie - poŻeramy" }],
  }),
  component: AuthConfirmPage,
});

type VerifyOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

function AuthConfirmPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "set-password" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as VerifyOtpType | null;
    const redirectTo = params.get("redirect_to");

    if (!tokenHash || !type) {
      setStatus("error");
      setErrorMessage("Link jest niekompletny lub uszkodzony.");
      return;
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }
      if (type === "recovery") {
        // Session is now live from the recovery token, but the password itself
        // hasn't changed yet - ask for a new one before sending them onward.
        setStatus("set-password");
        return;
      }
      setStatus("success");
      const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/profile";
      setTimeout(() => navigate({ to: target }), 1200);
    }).catch((err) => {
      // A rejected promise (network hiccup, a GoTrue internal lock conflict, etc.)
      // must still surface as a clear error - never leave the user stuck on
      // "Potwierdzam..." indefinitely with a silently unhandled rejection.
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Coś poszło nie tak przy weryfikacji linku.");
    });
  }, [navigate]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    const err = passwordStrengthError(newPassword);
    if (err) {
      setPwError(err);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Hasło zmienione ✓");
      setStatus("success");
      setTimeout(() => navigate({ to: "/profile" }), 1000);
    } catch (err2) {
      toast.error(err2 instanceof Error ? err2.message : "Nie udało się zapisać hasła");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main id="main-content" className="min-h-dvh bg-terrazzo-navy text-cream flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-cream text-navy rounded-3xl p-8 shadow-2xl text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="animate-spin mx-auto mb-4" size={32} aria-hidden />
            <h1 className="font-display text-2xl mb-1">Potwierdzam...</h1>
            <p className="text-sm text-muted-foreground">Chwilę cierpliwości, weryfikujemy link.</p>
          </>
        )}
        {status === "set-password" && (
          <>
            <KeyRound className="mx-auto mb-4 text-tomato" size={32} aria-hidden />
            <h1 className="font-display text-2xl mb-1">Ustaw nowe hasło</h1>
            <p className="text-sm text-muted-foreground mb-5">
              Link zweryfikowany. Wpisz nowe hasło do swojego konta.
            </p>
            <form onSubmit={handleSetPassword} className="space-y-3 text-left" noValidate>
              <div className="relative">
                <label htmlFor="new-password" className="sr-only">Nowe hasło</label>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); if (pwError) setPwError(null); }}
                  aria-invalid={!!pwError}
                  aria-describedby={pwError ? "new-password-err" : undefined}
                  placeholder="Nowe hasło (min. 8 znaków, litera i cyfra)"
                  className={`w-full rounded-xl border-2 px-4 py-3 pr-12 outline-none focus:border-tomato ${pwError ? "border-destructive" : "border-border"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-navy hover:bg-navy/5"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwError && (
                <p id="new-password-err" className="text-xs text-destructive">{pwError}</p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold hover:bg-tomato/90 transition disabled:opacity-50 min-h-11"
              >
                {saving ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <KeyRound size={18} aria-hidden />}
                {saving ? "Zapisuję…" : "Zapisz nowe hasło"}
              </button>
            </form>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-4 text-green-600" size={32} aria-hidden />
            <h1 className="font-display text-2xl mb-1">Gotowe!</h1>
            <p className="text-sm text-muted-foreground">Przenosimy Cię dalej...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 text-destructive" size={32} aria-hidden />
            <h1 className="font-display text-2xl mb-1">Link nie zadziałał</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {errorMessage ?? "Link mógł wygasnąć albo już go użyto."}
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full bg-tomato text-cream px-6 py-3 font-semibold hover:bg-tomato/90 transition min-h-11"
            >
              Wróć do logowania
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
