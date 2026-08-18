import { Link } from "@tanstack/react-router";
import { LogIn, type LucideIcon } from "lucide-react";

/**
 * Shared "please log in" prompt for public routes that need a session for
 * their real content. Route-level `_authenticated` layouts redirect instead
 * of rendering this — use it only where the route itself stays public.
 */
export function AuthGate({
  icon: Icon,
  title,
  description,
  secondaryTo = "/",
  secondaryLabel = "Przeglądaj mapę",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  secondaryTo?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-3xl p-8 text-center">
      <Icon className="mx-auto text-tomato mb-3" size={36} />
      <h2 className="font-display text-2xl mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">{description}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-full bg-tomato text-cream px-5 py-2.5 font-bold hover:bg-tomato/90"
        >
          <LogIn size={16} /> Zaloguj się
        </Link>
        <Link
          to={secondaryTo}
          className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-5 py-2.5 font-semibold hover:border-tomato"
        >
          {secondaryLabel}
        </Link>
      </div>
    </div>
  );
}
