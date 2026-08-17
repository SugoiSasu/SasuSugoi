import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertTriangle, CheckCircle2, Info, RefreshCw, WifiOff } from "lucide-react";
import {
  useNotificationsLog,
  useRealtimeStatus,
  useNotifications,
  type RealtimeStatus,
} from "@/lib/notifications-api";

export const Route = createFileRoute("/_authenticated/admin/notifications-monitor")({
  head: () => ({ meta: [{ title: "Monitor powiadomień — admin" }] }),
  component: MonitorPage,
});

const STATUS_META: Record<RealtimeStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  idle:       { label: "Idle",         cls: "text-muted-foreground bg-muted/40 border-border",        icon: <Info size={14} /> },
  connecting: { label: "Łączenie…",    cls: "text-blue-600 bg-blue-500/10 border-blue-500/30",        icon: <RefreshCw size={14} className="animate-spin" /> },
  connected:  { label: "Realtime OK",  cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", icon: <CheckCircle2 size={14} /> },
  error:      { label: "Offline (polling 15s)", cls: "text-amber-600 bg-amber-500/10 border-amber-500/30", icon: <WifiOff size={14} /> },
};

function MonitorPage() {
  // Mounting useNotifications keeps the realtime channel alive while monitoring.
  const { dataUpdatedAt, isFetching } = useNotifications();
  const status = useRealtimeStatus();
  const log = useNotificationsLog();
  const meta = STATUS_META[status];

  const errors = log.filter((l) => l.level === "error").length;
  const warns = log.filter((l) => l.level === "warn").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Monitor powiadomień</h1>
        <p className="text-sm text-muted-foreground">
          Lokalny podgląd kanału realtime i ostatnich zdarzeń modułu powiadomień (sesja przeglądarki).
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card label="Status realtime" value={meta.label} icon={meta.icon} cls={meta.cls} />
        <Card
          label="Ostatnie pobranie"
          value={dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pl-PL") : "—"}
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
        a klient odpytuje bazę co 15 s. Po wznowieniu połączenia status wraca do „Realtime OK”
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
    info:  "bg-blue-500/10 text-blue-600 border-blue-500/30",
    warn:  "bg-amber-500/10 text-amber-600 border-amber-500/30",
    error: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  } as const;
  return (
    <span className={`shrink-0 text-[10px] uppercase font-bold border rounded-full px-2 py-0.5 ${map[level]}`}>
      {level}
    </span>
  );
}
