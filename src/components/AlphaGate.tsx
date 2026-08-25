import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "pozeramy:alpha-passed";

export function AlphaGate({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  // Starts false on both server and the client's first paint (no window on
  // the server, and matching that on the client avoids a second hydration
  // mismatch) - a returning visitor who already entered the password gets
  // a brief flash of the locked screen until this effect catches up, only
  // while the gate is actually on.
  const [passed, setPassed] = useState(false);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPassed(window.localStorage.getItem(STORAGE_KEY) === "1");
    setCheckedStorage(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase as any).rpc("alpha_gate_verify", {
        _password: password,
      });
      if (err) throw err;
      if (data === true) {
        window.localStorage.setItem(STORAGE_KEY, "1");
        setPassed(true);
      } else {
        setError("Nieprawidłowe hasło.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd weryfikacji");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <>{children}</>;

  // Gate is on: don't commit to "locked" until localStorage has actually
  // been checked client-side, or a returning visitor would see a pointless
  // flash of the password form before flipping to content.
  if (!checkedStorage) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="animate-spin text-tomato" size={32} />
      </div>
    );
  }

  if (passed) return <>{children}</>;

  return (
    <div className="min-h-dvh grid place-items-center bg-background p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-card border border-border rounded-3xl p-8 shadow-lg text-center"
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-tomato/10 grid place-items-center text-tomato mb-3">
          <Lock size={20} />
        </div>
        <h1 className="font-display text-2xl mb-1">poŻeramy - wersja alpha</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Strona jest w fazie alpha. Wpisz hasło dostępu, aby kontynuować.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Hasło dostępu"
          className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:border-tomato outline-none mb-2"
        />
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-tomato text-cream px-4 py-2.5 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-50"
        >
          {busy ? "Sprawdzam…" : "Wejdź"}
        </button>
      </form>
    </div>
  );
}
