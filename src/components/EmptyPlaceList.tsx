import { Link } from "@tanstack/react-router";

export interface EmptyPlaceListStateProps {
  icon: React.ReactNode;
  title: string;
  tip: string;
  cta?: { to: string; label: string };
}

export function EmptyPlaceListState({ icon, title, tip, cta }: EmptyPlaceListStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      <h3 className="font-display text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-3 max-w-xs mx-auto">{tip}</p>
      {cta && (
        <Link to={cta.to} className="chip bg-tomato text-cream hover:bg-tomato/90">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
