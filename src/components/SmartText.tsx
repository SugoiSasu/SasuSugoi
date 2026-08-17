import type { ReactNode, ElementType, ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const POLISH_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

export function hasPolishChars(text: string): boolean {
  return POLISH_RE.test(text);
}

/** Bricolage Grotesque supports Polish natively — no-op kept for API compat. */
export function stripPolish(text: string): string {
  return text;
}

/** Display font everywhere — Bricolage Grotesque. */
export function fontForText(_text: string): string {
  return "font-display";
}

type SmartTextProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

/** Renders children in the display font (Bricolage Grotesque). */
export function SmartText<T extends ElementType = "span">({
  as,
  children,
  className,
  ...rest
}: SmartTextProps<T>) {
  const Tag = (as ?? "span") as ElementType;
  return (
    <Tag className={cn("font-display", className)} {...rest}>
      {children}
    </Tag>
  );
}
