/**
 * Rysunek animacji "pożerania" logo (SVG + CSS) i jej scenariusz czasowy.
 *
 * Do aplikacji NIE trafia jako żywy SVG: animowana maska rysowana przez wątek główny laguje, gdy ten sam
 * wątek równocześnie ładuje i uruchamia całą aplikację. Z tego pliku `scripts/build-boot-splash.mjs`
 * renderuje klatki do animowanego WebP (public/brand/boot-chomp.webp), który przeglądarka dekoduje poza
 * wątkiem głównym. W aplikacji używamy stąd tylko czasów (dźwięk musi trafiać w gryzy).
 */

/** Momenty gryzów (s od startu animacji). Muszą zgadzać się z opóźnieniami w CSS i keyframes pzsq. */
export const BITE_TIMES = [0.55, 0.95, 1.35, 1.75, 2.15] as const;
/** Moment "gulp" po ostatnim gryzie. */
export const GULP_AT = 2.32;
/** Długość całej sekwencji w obrazie (s). */
export const SEQUENCE_S = 2.75;

/**
 * Kółka wycinane z logo (viewBox 104). Każdy gryz = kółko główne + boczne, które tworzą ślad zębów na
 * krawędzi. Razem pokrywają cały kafelek (sprawdza to test: 0 niepokrytych punktów).
 */
export const BITES: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[94, 16, 34], [104, 46, 17], [62, 0, 22]],
  [[10, 14, 34], [0, 46, 17], [34, 0, 16]],
  [[14, 92, 34], [0, 60, 17], [38, 104, 16]],
  [[92, 92, 34], [104, 60, 17], [56, 104, 22]],
  [[52, 52, 36], [24, 52, 16], [80, 52, 16], [52, 24, 16], [52, 80, 16]],
];

/** Okruszki: miejsce skąd lecą, przesunięcie w bok (px) podczas spadania i kolor. */
export const CRUMBS: ReadonlyArray<readonly [number, number, number, string]> = [
  [98, 30, 8, "#f4a7a0"],
  [10, 22, -10, "#fff8ef"],
  [22, 94, -8, "#f4a7a0"],
  [88, 96, 10, "#fff8ef"],
  [52, 54, 4, "#f4a7a0"],
];

const T_SQ = 2.6;
const sqPct = (t: number) => ((t / T_SQ) * 100).toFixed(1);

const squishKeyframes = (() => {
  const steps: string[] = ["0%{transform:scale(1)}"];
  for (const t of BITE_TIMES) {
    steps.push(`${sqPct(t)}%{transform:scale(1)}`);
    steps.push(`${sqPct(t + 0.05)}%{transform:scale(.92)}`);
    steps.push(`${sqPct(t + 0.13)}%{transform:scale(1.03)}`);
    steps.push(`${sqPct(t + 0.2)}%{transform:scale(1)}`);
  }
  steps.push("100%{transform:scale(1)}");
  return steps.join("");
})();

/** CSS rysunku (do renderowania klatek; selektory pod #pz-boot). */
export const ART_CSS =
  `#pz-boot svg{width:112px;height:112px;overflow:visible;animation:pzin .25s cubic-bezier(.2,.8,.2,1) both}` +
  `#pz-boot .sq{transform-box:fill-box;transform-origin:center;animation:pzsq ${T_SQ}s ease-in-out both}` +
  `#pz-boot .b{transform-box:fill-box;transform-origin:center;transform:scale(0);animation:pzb .16s ease-out both}` +
  BITE_TIMES.map((t, i) => `#pz-boot .b${i + 1}{animation-delay:${t}s}`).join("") +
  `#pz-boot .c{opacity:0;animation:pzc .9s ease-in both}` +
  BITE_TIMES.map((t, i) => `#pz-boot .c${i + 1}{animation-delay:${(t + 0.02).toFixed(2)}s}`).join("") +
  `@keyframes pzin{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}` +
  `@keyframes pzsq{${squishKeyframes}}` +
  `@keyframes pzb{from{transform:scale(0)}to{transform:scale(1)}}` +
  `@keyframes pzc{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),32px)}}`;

/** SVG rysunku: logo z maską-gryzami i okruszkami. */
export const ART_SVG =
  `<svg viewBox="0 0 104 104" aria-hidden="true"><defs><mask id="pzm"><rect width="104" height="104" rx="26" fill="#fff"/><g fill="#000">` +
  BITES.map(
    (g, i) => `<g class="b b${i + 1}">${g.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>`,
  ).join("") +
  `</g></mask></defs><g class="sq"><image href="/brand/po_zeramy-logo-dark-nav.webp" width="104" height="104" mask="url(#pzm)"/></g>` +
  CRUMBS.map(
    ([x, y, dx, fill], i) => `<circle class="c c${i + 1}" cx="${x}" cy="${y}" r="2.6" fill="${fill}" style="--dx:${dx}px"/>`,
  ).join("") +
  `</svg>`;
