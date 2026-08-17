import { BackButton } from "@/components/BackButton";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft, Apple, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Zaloguj się — poŻeramy" },
      { name: "description", content: "Zaloguj się do poŻeramy lub załóż konto, by zapisywać miejscówki i tworzyć swój wall." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/profile" });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/profile" },
        });
        if (error) throw error;
        toast.success("Konto utworzone! Sprawdź email aby potwierdzić.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/profile" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Coś poszło nie tak";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/profile",
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/profile" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Błąd logowania ${provider}`;
      toast.error(msg);
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="min-h-dvh bg-terrazzo-navy text-cream flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 left-6"><BackButton to="/" label="Strona główna" /></div>
      <div className="w-full max-w-md bg-cream text-navy rounded-3xl p-8 shadow-2xl">
        <h1 className="font-display text-3xl mb-1">
          {mode === "signin" ? "Witaj poŻeraczu!" : "Dołącz do poŻeramy"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signin"
            ? "Zaloguj się i wracaj do swojej listy miejscówek."
            : "Załóż konto, twórz swój wall i zapisuj ulubione miejsca."}
        </p>

        <div className="space-y-2 mb-4">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={loading}
            aria-label="Kontynuuj z Google"
            className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-navy/20 py-3 font-semibold hover:bg-navy/5 transition disabled:opacity-50 min-h-11"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.3c-2 1.5-4.5 2.5-7.3 2.5-5.3 0-9.7-3.4-11.3-8L6.2 33C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.3c4.4-4 7.2-9.9 7.2-16.5 0-1.3-.1-2.3-.4-3.5z"/></svg>
            Kontynuuj z Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("apple")}
            disabled={loading}
            aria-label="Kontynuuj z Apple"
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-navy text-cream py-3 font-semibold hover:bg-navy/90 transition disabled:opacity-50 min-h-11"
          >
            <Apple size={18} fill="currentColor" aria-hidden />
            Kontynuuj z Apple
          </button>
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-border flex-1" />
          <span className="text-xs text-muted-foreground">lub email</span>
          <div className="h-px bg-border flex-1" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3" noValidate>
          <div>
            <label htmlFor="auth-email" className="sr-only">Email</label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
              onBlur={() => setEmailError(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Niepoprawny adres email" : null)}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "auth-email-err" : undefined}
              placeholder="Email"
              className={`w-full rounded-xl border-2 px-4 py-3 outline-none focus:border-tomato ${emailError ? "border-destructive" : "border-border"}`}
            />
            {emailError && (
              <p id="auth-email-err" className="text-xs text-destructive mt-1">{emailError}</p>
            )}
          </div>
          <div>
            <label htmlFor="auth-password" className="sr-only">Hasło</label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }}
                onBlur={() => setPasswordError(password && password.length < 6 ? "Hasło musi mieć min. 6 znaków" : null)}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "auth-password-err" : undefined}
                placeholder="Hasło (min. 6 znaków)"
                className={`w-full rounded-xl border-2 px-4 py-3 pr-12 outline-none focus:border-tomato ${passwordError ? "border-destructive" : "border-border"}`}
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
            {passwordError && (
              <p id="auth-password-err" className="text-xs text-destructive mt-1">{passwordError}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-tomato text-cream py-3 font-semibold hover:bg-tomato/90 transition disabled:opacity-50 min-h-11"
          >
            {loading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Mail size={18} aria-hidden />}
            {loading
              ? (mode === "signin" ? "Loguję…" : "Tworzę konto…")
              : (mode === "signin" ? "Zaloguj się" : "Zarejestruj")}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-tomato min-h-11"
        >
          {mode === "signin" ? "Nie masz konta? Zarejestruj się" : "Masz już konto? Zaloguj się"}
        </button>
      </div>
    </main>
  );
}
