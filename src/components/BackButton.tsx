import { Link } from "@tanstack/react-router";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type BackButtonProps = {
  to: ComponentProps<typeof Link>["to"];
  hash?: string;
  label?: string;
  className?: string;
  ariaLabel?: string;
  icon?: LucideIcon;
  children?: ReactNode;
};

/**
 * Zunifikowany przycisk „Wróć" używany globalnie w całej aplikacji.
 * Granatowa pigułka z animowaną strzałką (klasy .pz-back / .pz-back-arrow).
 */
export function BackButton({
  to,
  hash,
  label = "Wróć",
  className = "",
  ariaLabel,
  icon: Icon = ArrowLeft,
  children,
}: BackButtonProps) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      hash={hash}
      className={`pz-back group inline-flex min-h-11 items-center gap-2 rounded-full bg-navy text-cream px-4 py-2 text-sm font-semibold shadow-md hover:bg-tomato transition ${className}`}
      aria-label={ariaLabel ?? (typeof children === "string" ? children : label)}
    >
      <Icon size={16} className="pz-back-arrow" aria-hidden="true" />
      <span>{children ?? label}</span>
    </Link>
  );
}

export default BackButton;
