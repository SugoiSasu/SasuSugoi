import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Discreet scroll-to-top pill, anchored above the mobile tab bar.
 * Remembers where you were: after jumping up it offers a "back down" jump,
 * and it resets whenever the route (section) changes.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [restorePoint, setRestorePoint] = useState<number | null>(null);
  const [atTop, setAtTop] = useState(true);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const programmatic = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setVisible(y > 600);
      setAtTop(y < 120);
      // Manual scrolling invalidates the stored restore point.
      if (!programmatic.current && y > 120) setRestorePoint(null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // New section → forget previous scroll history.
  useEffect(() => {
    setRestorePoint(null);
    programmatic.current = false;
  }, [pathname]);

  const smoothTo = (top: number) => {
    programmatic.current = true;
    window.scrollTo({ top, behavior: "smooth" });
    window.setTimeout(() => {
      programmatic.current = false;
    }, 900);
  };

  const goUp = () => {
    setRestorePoint(window.scrollY);
    smoothTo(0);
  };

  const goBack = () => {
    const target = restorePoint ?? 0;
    setRestorePoint(null);
    smoothTo(target);
  };

  const showBack = restorePoint !== null && atTop;
  const shown = showBack || visible;

  return (
    <button
      type="button"
      aria-label={showBack ? "Wróć tam, gdzie byłeś" : "Wróć na górę"}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      onClick={showBack ? goBack : goUp}
      className={`fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 grid h-11 w-11 place-items-center rounded-full border border-border bg-card/90 text-navy shadow-md backdrop-blur transition-all duration-300 hover:border-tomato hover:text-tomato lg:bottom-6 lg:right-6 lg:h-11 lg:w-11 ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      {showBack ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
    </button>
  );
}
