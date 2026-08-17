import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Lock, Save, Loader2 } from "lucide-react";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/alpha-gate")({
  head: () => ({ meta: [{ title: "Alpha gate — Panel admina" }] }),
  component: AdminAlphaGate,
});

function AdminAlphaGate() {
  const isSuper = useIsSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuper) { setLoading(false); return; }
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("alpha_gate_get");
      if (!error && data && data[0]) {
        setEnabled(!!data[0].enabled);
        setPassword(String(data[0].password ?? ""));
      }
      setLoading(false);
    })();
  }, [isSuper]);

  async function save() {
    if (!password.trim()) { toast.error("Hasło nie może być puste"); return; }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("alpha_gate_set", { _enabled: enabled, _password: password });
      if (error) throw error;
      toast.success("Zapisano ustawienia");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd");
    } finally {
      setSaving(false);
    }
  }

  if (!isSuper) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Crown className="mx-auto text-muted-foreground mb-3" size={32} />
        <h2 className="font-display text-2xl mb-2">Tylko Head Admin</h2>
        <p className="text-sm text-muted-foreground">Konfiguracja bramki alpha jest tylko dla Head Admina.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="grid place-items-center py-10"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl mb-1 inline-flex items-center gap-2"><Lock size={22} /> Alpha gate</h1>
        <p className="text-sm text-muted-foreground">
          Gdy włączone, każdy nowy gość musi wpisać hasło raz, aby wejść na stronę. Hasło jest zapisywane w przeglądarce.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 accent-tomato"
          />
          <span className="text-sm font-semibold">Wymagaj hasła dostępu (alpha)</span>
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-muted-foreground mb-1">Hasło dostępu</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-tomato outline-none"
            placeholder="np. pozeramy-alpha-2025"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Zmiana hasła wymaga ponownej weryfikacji u osób, które jeszcze go nie wpisały (już zalogowani goście nadal mają dostęp dopóki nie wyczyszczą danych przeglądarki).
          </p>
        </label>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-4 py-2 text-sm font-semibold hover:bg-tomato/90 disabled:opacity-50"
          >
            <Save size={14} /> Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
