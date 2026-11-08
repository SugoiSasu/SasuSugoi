import { useState } from "react";
import { useCutoutLogoReady, useKafelLogo } from "@/lib/chroma-cutout";

/**
 * Logo lokalu zawsze w kółku - jedno miejsce na to, co dotąd było powielone w kartach, Kartach i liście mapy.
 *
 * Zasady (z redesignu 2026-11):
 * - kółko wypełnia rodzica (rodzic ustala rozmiar), logo nigdy nie jest rozciągane;
 * - logo o małej rozdzielczości (< 160 px) pokazujemy w naturalnym rozmiarze, a nie powiększone i rozmazane;
 * - ciemny motyw: żadnego jasnego tła (razi po ciemku) - półprzezroczysta płytka i jasna poświata logo;
 * - brak logo: emoji kuchni na kolorze kuchni.
 *
 * `tryb="lekki"` omija wycinanie tła i analizę kafla (canvas) - do długich list, gdzie byłoby ich kilkadziesiąt.
 */
export type PlaceLogoProps = {
  name: string;
  avatarUrl?: string | null;
  /** Domyślnie włączone; wyłączane per lokal w panelu admina (avatar_cutout_enabled). */
  cutoutEnabled?: boolean;
  fallbackEmoji?: string;
  fallbackColor?: string;
  tryb?: "pelny" | "lekki";
  className?: string;
};

const POSWIATA_CIEMNA =
  "dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.95)] dark:drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]";
const KOLKO = "relative grid aspect-square place-items-center overflow-hidden rounded-full";

/** Obraz w kółku: pełne wypełnienie z marginesem, a dla małych plików naturalny rozmiar na środku. */
function Obraz({ src, alt, gotowe = true }: { src: string; alt: string; gotowe?: boolean }) {
  const [niska, setNiska] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onLoad={(e) => setNiska(e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth < 160)}
      className={`${
        niska ? "h-auto w-auto max-h-[62%] max-w-[62%]" : "h-full w-full p-[14%]"
      } object-contain transition-opacity duration-300 ${gotowe ? "opacity-100" : "opacity-0"} ${POSWIATA_CIEMNA}`}
    />
  );
}

function Zastepcze({ emoji, color, className }: { emoji?: string; color?: string; className: string }) {
  return (
    <span className={`${KOLKO} ${className}`} style={{ backgroundColor: color }} aria-hidden="true">
      <span className="text-[1.6em] leading-none">{emoji ?? "🍽️"}</span>
    </span>
  );
}

function Lekkie({ name, avatarUrl, fallbackEmoji, fallbackColor, className = "" }: PlaceLogoProps) {
  const k = useKafelLogo(avatarUrl);
  if (!avatarUrl) return <Zastepcze emoji={fallbackEmoji} color={fallbackColor} className={className} />;
  return (
    <span
      className={`${KOLKO} ${k.kafel ? "" : "bg-white dark:bg-white/[0.08]"} ${className}`}
      style={k.kafel ? { backgroundColor: k.kolor } : undefined}
    >
      <Obraz src={avatarUrl} alt={name} />
    </span>
  );
}

function Pelne({ name, avatarUrl, cutoutEnabled = true, fallbackEmoji, fallbackColor, className = "" }: PlaceLogoProps) {
  const cutout = useCutoutLogoReady(avatarUrl, cutoutEnabled);
  if (!avatarUrl) return <Zastepcze emoji={fallbackEmoji} color={fallbackColor} className={className} />;
  // Logo prostokątne/kwadratowe z własnym tłem: kółko w kolorze tego tła, bez poświaty (kółko ma własne tło).
  const kafel = cutout.kafel;
  return (
    <span
      className={`${KOLKO} ${kafel ? "" : "bg-white dark:bg-white/[0.08]"} ${className}`}
      style={kafel ? { backgroundColor: cutout.kolor } : undefined}
    >
      <Obraz src={cutout.src ?? avatarUrl} alt={name} gotowe={cutout.gotowe} />
    </span>
  );
}

export function PlaceLogo(props: PlaceLogoProps) {
  return props.tryb === "lekki" ? <Lekkie {...props} /> : <Pelne {...props} />;
}
