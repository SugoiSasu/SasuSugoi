import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { key: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Jasny", Icon: Sun },
  { key: "dark", label: "Ciemny", Icon: Moon },
  { key: "system", label: "Jak system", Icon: Laptop },
];

/**
 * Three states, not two. A plain on/off switch cannot express "follow my phone",
 * which is what most people actually want - and once you tap a two-state toggle
 * you are pinned to that choice forever, including after the system flips at dusk.
 *
 * `variant="compact"` is a single button that cycles, for tight spots like a
 * mobile header. `variant="sidebar"` is for the navy rail, which is dark in both
 * themes - the card-coloured pill would vanish into it once the rest goes dark.
 * The default is the full segmented control.
 */
export function ThemeToggle({
  variant = "segmented",
  className = "",
}: {
  variant?: "segmented" | "compact" | "sidebar";
  className?: string;
}) {
  const { choice, resolved, setTheme } = useTheme();

  if (variant === "sidebar") {
    return (
      <div
        role="radiogroup"
        aria-label="Motyw"
        className={`flex items-center gap-1 rounded-xl bg-cream/5 p-1 ${className}`}
      >
        {OPTIONS.map(({ key, label, Icon }) => {
          const active = choice === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={label}
              onClick={() => setTheme(key)}
              className={`grid h-7 flex-1 place-items-center rounded-lg transition ${
                active
                  ? "bg-cream/15 text-cream"
                  : "text-cream/45 hover:bg-cream/10 hover:text-cream/80"
              }`}
            >
              <Icon size={14} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "compact") {
    const next: ThemeChoice = resolved === "dark" ? "light" : "dark";
    const Icon = resolved === "dark" ? Sun : Moon;
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={resolved === "dark" ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
        className={`grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground transition hover:border-accent active:scale-95 ${className}`}
      >
        <Icon size={16} />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Motyw"
      className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 ${className}`}
    >
      {OPTIONS.map(({ key, label, Icon }) => {
        const active = choice === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={13} aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
