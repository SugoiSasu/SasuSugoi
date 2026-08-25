import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared list-controls for admin sections.
 *
 * Before this, every section hand-rolled its own search box and status pill.
 * The five search inputs had five different class strings (some with a clear
 * button, some without, three different paddings), and status was expressed
 * with raw Tailwind palette colours - emerald/amber/blue - which belong to
 * no part of the brand system. These primitives are the single place those
 * decisions live now.
 */

/* ---------------------------------------------------------------- search */

export function AdminSearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-tomato text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Wyczyść wyszukiwanie"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- filters */

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  /** Optional badge - omit rather than passing 0 if the count is meaningless. */
  count?: number;
}

export function AdminFilterChips<K extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: K;
  onChange: (k: K) => void;
  options: FilterOption<K>[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
              active
                ? "bg-tomato text-cream border-tomato"
                : "bg-card border-border hover:border-tomato"
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={`rounded-full px-1.5 tabular-nums ${
                  active ? "bg-cream/20" : "bg-muted text-muted-foreground"
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- status */

/**
 * Semantic status tones. These map onto brand tokens only - `ok` is the
 * --ok token added with the stat bar, `attention` reuses --tomato (the
 * accent), `danger` reuses --destructive. No raw palette colours.
 */
export type StatusTone = "ok" | "attention" | "info" | "danger" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  ok: "bg-ok/12 text-ok border border-ok/25",
  attention: "bg-tomato/12 text-tomato border border-tomato/25",
  // The brand already has its own blue (--cobalt, the focus ring), so an
  // "informational" state does not need Tailwind's blue-500.
  info: "bg-cobalt/12 text-cobalt border border-cobalt/25",
  danger: "bg-destructive/12 text-destructive border border-destructive/25",
  neutral: "bg-muted text-muted-foreground border border-border",
};

/** Raw class string for the same tones, for places that style their own pill. */
export const statusToneClass = TONE_CLASS;

export function AdminStatusTag({
  tone,
  label,
  icon,
  className = "",
}: {
  tone: StatusTone;
  label: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

/* --------------------------------------------------------------- toggle */

/**
 * Pill switch for on/off settings. A bare checkbox reads as "part of a form
 * you still have to submit"; a switch reads as a state you are flipping,
 * which is what these actually are.
 */
export function AdminToggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name - required, even when the visible label sits elsewhere. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50 ${
        checked ? "bg-tomato" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------ empty state */

export function AdminEmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-card border border-dashed border-border rounded-2xl px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground/80 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
