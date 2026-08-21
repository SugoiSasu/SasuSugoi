import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { HEART_PATH, SadFaceParticle } from "@/components/SwipeFaces";

const DURATION = 0.8;
const MAX_DELAY = 0.18;

interface Particle {
  angle: number;
  distance: number;
  delay: number;
  scale: number;
  spin: number;
  variant: "navy" | "blush" | "sad";
}

function makeParticles(type: "like" | "nope"): Particle[] {
  const count = type === "like" ? 9 : 6;
  const spread = Math.PI * 0.95;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const angle = -Math.PI / 2 + (t - 0.5) * spread + (Math.random() - 0.5) * 0.35;
    return {
      angle,
      distance: 65 + Math.random() * 65,
      delay: Math.random() * MAX_DELAY,
      scale: 0.55 + Math.random() * 0.55,
      spin: (Math.random() - 0.5) * 90,
      variant: type === "like" ? (i % 2 === 0 ? "navy" : "blush") : "sad",
    };
  });
}

/** Burst of brand-colored heart or sad-face particles, fired once when a card is swiped. */
export function SwipeBurst({ type, onDone }: { type: "like" | "nope"; onDone: () => void }) {
  const particles = useMemo(() => makeParticles(type), [type]);

  useEffect(() => {
    const t = setTimeout(onDone, (DURATION + MAX_DELAY) * 1000 + 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {particles.map((p, i) => {
        const dx = Math.cos(p.angle) * p.distance;
        const dy = Math.sin(p.angle) * p.distance;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 -ml-3 -mt-3"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.3, rotate: 0 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: p.scale, rotate: p.spin }}
            transition={{ duration: DURATION, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
          >
            {p.variant === "sad" ? (
              <SadFaceParticle size={24} />
            ) : (
              <svg viewBox="0 0 100 100" width={24} height={24} aria-hidden="true">
                <path d={HEART_PATH} fill={p.variant === "navy" ? "var(--navy)" : "var(--blush)"} />
              </svg>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
