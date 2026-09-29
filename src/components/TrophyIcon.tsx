import type { RodzajTrofeum, Trofeum } from "@/lib/trophies";
import { nazwaTrofeum, podpisTrofeum } from "@/lib/trophies";

/**
 * Wlasny zestaw ikon trofeow (rysowany pod marke, nie kopia znakow towarowych
 * Michelin - podobna idea, inna forma). Kolor z `currentColor`, wiec dziala w
 * jasnym i ciemnym motywie.
 */
const KOLOR: Record<RodzajTrofeum, string> = {
  michelin_star: "text-tomato",
  michelin_bib: "text-mustard",
  michelin_recommended: "text-foreground/75",
  warte_pozarcia: "text-tomato",
  inna_nagroda: "text-mustard",
};

export function TrophyGlyph({ kind, size = 20, className = "" }: { kind: RodzajTrofeum; size?: number; className?: string }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, className: `${KOLOR[kind]} ${className}` };
  if (kind === "michelin_star") {
    // Czterolistna "gwiazda" z zaokraglonymi platkami i jasnym srodkiem.
    return (
      <svg {...p} fill="currentColor">
        <circle cx="12" cy="6.3" r="4.3" />
        <circle cx="17.7" cy="12" r="4.3" />
        <circle cx="12" cy="17.7" r="4.3" />
        <circle cx="6.3" cy="12" r="4.3" />
        <circle cx="12" cy="12" r="3.1" fill="var(--background, #fff)" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    );
  }
  if (kind === "michelin_bib") {
    // Pyzata buzia w kolku (Bib = "dobre jedzenie w dobrej cenie").
    return (
      <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="9.2" />
        <circle cx="8.8" cy="10" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15.2" cy="10" r="1.1" fill="currentColor" stroke="none" />
        <path d="M7.8 13.6c1.1 2.5 2.6 3.5 4.2 3.5s3.1-1 4.2-3.5" />
      </svg>
    );
  }
  if (kind === "michelin_recommended") {
    // Talerz ze sztuccami: wyroznienie / rekomendacja.
    return (
      <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5.2" />
        <circle cx="12" cy="12" r="2.4" />
        <path d="M3.3 4v5.2c0 1 .8 1.6 1.7 1.6M5 4v16M6.7 4v5.2c0 1-.8 1.6-1.7 1.6" />
        <path d="M20.7 4c-1.7 1.4-2.4 3.3-2.4 5.4v1.4h2.4M20.7 4v16" />
      </svg>
    );
  }
  if (kind === "inna_nagroda") {
    // Medal na wstazce.
    return (
      <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2.8l3 6M16 2.8l-3 6" />
        <circle cx="12" cy="15" r="6" />
        <path d="M12 12v6M9.5 13.5l5 3M14.5 13.5l-5 3" />
      </svg>
    );
  }
  // warte_pozarcia: wieniec laurowy wokol widelca.
  return (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.2c-4.6 0-8-3.4-8-8.2 0-2.6 1-4.6 2.6-6" />
      <path d="M12 21.2c4.6 0 8-3.4 8-8.2 0-2.6-1-4.6-2.6-6" />
      <path d="M4.4 10.2c1.4.1 2.4-.5 2.9-1.6M5 14c1.4.2 2.6-.3 3.3-1.5M6.6 17.3c1.3.3 2.6 0 3.5-1M19.6 10.2c-1.4.1-2.4-.5-2.9-1.6M19 14c-1.4.2-2.6-.3-3.3-1.5M17.4 17.3c-1.3.3-2.6 0-3.5-1" />
      <path d="M9.6 6.2v3.2c0 .9.9 1.5 2.4 1.5s2.4-.6 2.4-1.5V6.2M12 6.2V16" />
    </svg>
  );
}

/** Ikona trofeum; gwiazdki Michelin powielone zgodnie z liczba (1-3), male. */
export function TrophyIcon({ trofeum, size = 20 }: { trofeum: Pick<Trofeum, "kind" | "tier">; size?: number }) {
  if (trofeum.kind === "michelin_star" && (trofeum.tier ?? 1) > 1) {
    const n = Math.min(3, trofeum.tier ?? 1);
    const s = Math.round(size * (n === 2 ? 0.82 : 0.7));
    return (
      <span className="inline-flex items-center" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <TrophyGlyph key={i} kind="michelin_star" size={s} className={i ? "-ml-0.5" : ""} />
        ))}
      </span>
    );
  }
  return <TrophyGlyph kind={trofeum.kind} size={size} />;
}

/** Pigulka z ikona i podpisem; z linkiem do zrodla, gdy jest. */
export function TrophyPill({ trofeum }: { trofeum: Trofeum }) {
  const podpis = podpisTrofeum(trofeum);
  const tresc = (
    <>
      <TrophyIcon trofeum={trofeum} size={24} />
      <span className="truncate">{podpis}</span>
    </>
  );
  const klasy =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold";
  return trofeum.source_url ? (
    <a
      href={trofeum.source_url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={`${nazwaTrofeum(trofeum)} - zobacz źródło`}
      className={`${klasy} transition hover:border-tomato`}
    >
      {tresc}
    </a>
  ) : (
    <span title={nazwaTrofeum(trofeum)} className={klasy}>
      {tresc}
    </span>
  );
}
