import { useCallback, useEffect, useState } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/start-server-core";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** What the visitor picked. */
export const THEME_COOKIE = "pz-theme";
/** What that resolved to. Kept separately because "system" is only knowable in the
 *  browser, and the server has to render the same class the client will apply or
 *  React reports a hydration mismatch on <html> and refuses to reconcile it. */
export const THEME_RESOLVED_COOKIE = "pz-theme-resolved";

/** Fired on the same tab when the choice changes. The native `storage` event only
 *  reaches OTHER tabs, so without this the toggle would not update its own icon. */
const THEME_EVENT = "pz:theme";

const YEAR = 60 * 60 * 24 * 365;

export function readCookie(source: string, name: string): string | null {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(source);
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string) {
  // Lax rather than Strict: the theme should survive arriving from an external
  // link, and it is a display preference, not anything sensitive.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function readThemeChoice(): ThemeChoice {
  if (typeof document === "undefined") return "system";
  const v = readCookie(document.cookie, THEME_COOKIE);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") return systemPrefersDark() ? "dark" : "light";
  return choice;
}

/** The single place that touches the DOM, so the boot script and React agree. */
export function applyTheme(resolved: ResolvedTheme) {
  // color-scheme lives in CSS (:root / .dark) rather than an inline style: React
  // does not render that style, so setting it here would show up as a hydration
  // mismatch on <html> forever.
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Reads both cookies on whichever side is running. Everything that renders
 * differently per theme has to agree across SSR and hydration - not just the
 * class on <html> but the toggle's own pressed state - and the server can only
 * learn the preference from the request.
 *
 * createIsomorphicFn keeps the server-only header import out of the client
 * bundle.
 */
export const readThemeCookies = createIsomorphicFn()
  .server(() => parseThemeCookies(getRequestHeader("cookie") ?? ""))
  .client(() => parseThemeCookies(document.cookie));

function parseThemeCookies(source: string): { choice: ThemeChoice; resolved: ResolvedTheme } {
  const raw = readCookie(source, THEME_COOKIE);
  const choice: ThemeChoice = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
  const resolved: ResolvedTheme = readCookie(source, THEME_RESOLVED_COOKIE) === "dark" ? "dark" : "light";
  return { choice, resolved };
}

export function useTheme() {
  // Seeded from the same source the server rendered from, so the first client
  // render is byte-identical to the SSR output.
  const initial = readThemeCookies();
  const [choice, setChoice] = useState<ThemeChoice>(initial.choice);
  const [resolved, setResolved] = useState<ResolvedTheme>(initial.resolved);

  useEffect(() => {
    const sync = () => {
      const c = readThemeChoice();
      setChoice(c);
      setResolved(resolveTheme(c));
    };
    sync();
    window.addEventListener(THEME_EVENT, sync);

    // Following the system means following it as it changes, not just at load.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readThemeChoice() !== "system") return;
      const next = systemPrefersDark() ? "dark" : "light";
      setResolved(next);
      applyTheme(next);
      writeCookie(THEME_RESOLVED_COOKIE, next);
    };
    mq.addEventListener("change", onSystem);

    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      mq.removeEventListener("change", onSystem);
    };
  }, []);

  const setTheme = useCallback((next: ThemeChoice) => {
    const r = resolveTheme(next);
    writeCookie(THEME_COOKIE, next);
    writeCookie(THEME_RESOLVED_COOKIE, r);
    setChoice(next);
    setResolved(r);
    applyTheme(r);
    window.dispatchEvent(new CustomEvent(THEME_EVENT));
  }, []);

  return { choice, resolved, setTheme };
}
