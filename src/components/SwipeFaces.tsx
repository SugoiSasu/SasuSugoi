/** Canonical, well-tested heart path (0..100 box) - reused at small scale for eyes
 * and by the swipe-burst heart particles. */
export const HEART_PATH =
  "M50,88 C20,65 5,45 5,28 C5,12 18,2 32,2 C40,2 47,6 50,14 C53,6 60,2 68,2 C82,2 95,12 95,28 C95,45 80,65 50,88 Z";

/** "Yummy" reaction face - heart eyes, big open smile - used on the swipe-right side. */
export function YummyFace({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" fill="#FF6B47" />
      <ellipse cx="24" cy="62" rx="8" ry="5" fill="#fff" opacity="0.3" />
      <ellipse cx="76" cy="62" rx="8" ry="5" fill="#fff" opacity="0.3" />
      <g fill="#FFF7EE">
        <path d={HEART_PATH} transform="translate(11,20) scale(0.24)" />
        <path d={HEART_PATH} transform="translate(51,20) scale(0.24)" />
      </g>
      <path d="M27 62 Q50 92 73 62 Q73 82 50 82 Q27 82 27 62 Z" fill="#3A1B12" />
      <path d="M37 68 Q50 80 63 68 Q63 76 50 76 Q37 76 37 68 Z" fill="#FF8FA3" />
    </svg>
  );
}

/** "Nope" reaction - flat unimpressed face, arms crossed - used on the swipe-left side. */
export function NopeFace({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect x="16" y="58" width="30" height="14" rx="7" fill="#221E50" transform="rotate(28 31 65)" />
      <rect x="54" y="58" width="30" height="14" rx="7" fill="#221E50" transform="rotate(-28 69 65)" />
      <circle cx="50" cy="44" r="38" fill="#3B4CC7" />
      <rect x="24" y="36" width="14" height="6" rx="3" fill="#EDEAFE" transform="rotate(-8 31 39)" />
      <rect x="62" y="36" width="14" height="6" rx="3" fill="#EDEAFE" transform="rotate(8 69 39)" />
      <rect x="26" y="26" width="16" height="4" rx="2" fill="#EDEAFE" transform="rotate(-14 34 28)" />
      <rect x="58" y="26" width="16" height="4" rx="2" fill="#EDEAFE" transform="rotate(14 66 28)" />
      <path d="M36 58 Q50 50 64 58" stroke="#EDEAFE" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Tiny sad face - used only in the swipe-left particle burst (distinct from the
 * arms-crossed NopeFace stamp: this one reads as "aww, missed it" rather than "no"). */
export function SadFaceParticle({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="var(--navy, #221E50)" />
      <circle cx="34" cy="44" r="5" fill="#EDEAFE" />
      <circle cx="66" cy="44" r="5" fill="#EDEAFE" />
      <path d="M32 74 Q50 58 68 74" stroke="#EDEAFE" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path
        d="M66 50 C66 50 70 58 66 64 C64 67 60 66 60 62 C60 58 63 54 66 50 Z"
        fill="var(--blush, #E8B7C4)"
      />
    </svg>
  );
}
