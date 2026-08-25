import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Lock, Save, Loader2, Eye, EyeOff, Activity, AlertTriangle, CheckCircle2, Info, RefreshCw, WifiOff, Settings2 } from "lucide-react";
import { useIsSuperAdmin } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  useNotificationsLog,
  useRealtimeStatus,
  useNotifications,
  type RealtimeStatus,
} from "@/lib/notifications-api";

export const Route = createFileRoute("/_authenticated/admin/ustawienia")({
  head: () => ({ meta: [{ title: "Ustawienia - Panel admina" }] }),
  component: AdminUstawienia,
});

const TABS = [
  { key: "alpha-gate", label: "Alpha gate", icon: <Lock size={13} /> },
  { key: "diagnostyka", label: "Diagnostyka", icon: <Activity size={13} /> },
] as const;

function AdminUstawienia() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("alpha-gate");

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl mb-1 inline-flex items-center gap-2"><Settings2 size={26} /> Ustawienia</h1>
        <p className="text-sm text-muted-foreground">Globalne przełączniki i podgląd stanu systemu.</p>
      </div>
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`chip ${tab === t.key ? "bg-tomato text-cream" : "bg-card border border-border"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === "alpha-gate" ? <AlphaGateTab /> : <DiagnostykaTab />}
    </div>
  );
}

function AlphaGateTab() {
  const isSuper = useIsSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      <p className="text-sm text-muted-foreground mb-4">
        Gdy włączone, każdy nowy gość musi wpisać hasło raz, aby wejść na stronę. Hasło jest zapisywane w przeglądarce.
      </p>

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
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm font-mono focus:border-tomato outline-none"
              placeholder="np. pozeramy-alpha-2025"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-navy hover:bg-navy/5"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
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

const STATUS_META: Record<RealtimeStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  idle:       { label: "Idle",         cls: "text-muted-foreground bg-muted/40 border-border",        icon: <Info size={14} /> },
  connecting: { label: "Łączenie…",    cls: "text-cobalt bg-cobalt/10 border-cobalt/30",        icon: <RefreshCw size={14} className="animate-spin" /> },
  connected:  { label: "Realtime OK",  cls: "text-ok bg-ok/10 border-ok/30", icon: <CheckCircle2 size={14} /> },
  error:      { label: "Offline (polling 15s)", cls: "text-tomato bg-tomato/10 border-tomato/30", icon: <WifiOff size={14} /> },
};

function DiagnostykaTab() {
  // Mounting useNotifications keeps the realtime channel alive while monitoring.
  const { dataUpdatedAt, isFetching } = useNotifications();
  const status = useRealtimeStatus();
  const log = useNotificationsLog();
  const meta = STATUS_META[status];

  const errors = log.filter((l) => l.level === "error").length;
  const warns = log.filter((l) => l.level === "warn").length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground -mt-2">
        Lokalny podgląd kanału realtime i ostatnich zdarzeń modułu powiadomień (sesja przeglądarki).
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card label="Status realtime" value={meta.label} icon={meta.icon} cls={meta.cls} />
        <Card
          label="Ostatnie pobranie"
          value={dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pl-PL") : " - "}
          icon={<Activity size={14} />}
          cls="text-foreground bg-card border-border"
          sub={isFetching ? "odświeżanie…" : undefined}
        />
        <Card
          label="Błędy / ostrzeżenia"
          value={`${errors} / ${warns}`}
          icon={<AlertTriangle size={14} />}
          cls={errors > 0 ? "text-rose-600 bg-rose-500/10 border-rose-500/30" : "text-foreground bg-card border-border"}
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold">Ostatnie zdarzenia ({log.length})</div>
          <div className="text-[11px] text-muted-foreground">Bufor lokalny • max 100</div>
        </div>
        {log.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Brak zdarzeń. Otwórz dzwoneczek lub poczekaj na rozłączenie realtime.
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto text-sm">
            {log.map((e, i) => (
              <li key={`${e.at}-${i}`} className="px-4 py-2.5 flex items-start gap-3">
                <LevelBadge level={e.level} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.message}</div>
                  {Object.keys(e.ctx).length > 0 && (
                    <pre className="text-[11px] text-muted-foreground mt-0.5 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(e.ctx)}
                    </pre>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                  {new Date(e.at).toLocaleTimeString("pl-PL")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Wskazówka: gdy realtime jest <strong>offline</strong>, dzwoneczek pokazuje bursztynową kropkę,
        a klient odpytuje bazę co 15 s. Po wznowieniu połączenia status wraca do „Realtime OK"
        i polling zwalnia do 60 s.
      </p>
    </div>
  );
}

function Card({
  label, value, icon, cls, sub,
}: { label: string; value: string; icon: React.ReactNode; cls: string; sub?: string }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${cls}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {sub && <div className="text-[11px] opacity-70">{sub}</div>}
    </div>
  );
}

function LevelBadge({ level }: { level: "info" | "warn" | "error" }) {
  const map = {
    info:  "bg-cobalt/10 text-cobalt border-cobalt/30",
    warn:  "bg-tomato/10 text-tomato border-tomato/30",
    error: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  } as const;
  return (
    <span className={`shrink-0 text-[10px] uppercase font-bold border rounded-full px-2 py-0.5 ${map[level]}`}>
      {level}
    </span>
  );
}
