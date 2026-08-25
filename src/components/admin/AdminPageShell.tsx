import type { ReactNode } from "react";

/**
 * Shared chrome for every admin section: a title block with an optional
 * primary action, plus a four-up bar of at-a-glance metrics above the
 * content. Before this, each section dropped you straight into its list -
 * you had to read the whole table to notice that 18 places were waiting for
 * review. The stat bar answers "what needs me today?" before you scroll.
 *
 * Every stat here must be derived from real data. A hardcoded number in an
 * admin panel is worse than no number, because it gets trusted.
 */

export type StatTone = "ok" | "attention" | "neutral";

export interface AdminStat {
  label: string;
  value: string | number;
  /** Short qualifier under the value - "+34 w tym mies.", "do weryfikacji". */
  delta?: string;
  tone?: StatTone;
}

const TONE: Record<StatTone, { dot: string; delta: string }> = {
  ok: { dot: "bg-ok", delta: "text-ok" },
  attention: { dot: "bg-tomato", delta: "text-tomato" },
  neutral: { dot: "bg-muted-foreground/50", delta: "text-muted-foreground" },
};

export function AdminPageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl leading-tight inline-flex items-center gap-2">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function AdminStatBar({
  stats,
  loading = false,
}: {
  stats: AdminStat[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl px-4 py-3.5 animate-pulse"
            aria-hidden="true"
          >
            <div className="h-3 w-24 rounded bg-muted mb-3" />
            <div className="h-6 w-14 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => {
        const tone = TONE[s.tone ?? "neutral"];
        return (
          <div key={s.label} className="bg-card border border-border rounded-2xl px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${tone.dot}`} aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                {s.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display text-2xl leading-none tabular-nums">{s.value}</span>
              {s.delta && (
                <span className={`text-[11px] font-bold ${tone.delta}`}>{s.delta}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Shared style for a section's primary action button (the orange pill). */
export const adminCtaClass =
  "inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-semibold hover:bg-tomato/90 transition shadow-sm";

/** Count rows created in the current calendar month, for "+N w tym mies." */
export function countThisMonth(rows: { created_at?: string | null }[] | undefined): number {
  if (!rows) return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return rows.filter((r) => (r.created_at ?? "") >= start).length;
}
