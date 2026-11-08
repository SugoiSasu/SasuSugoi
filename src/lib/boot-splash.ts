/**
 * Animowany ekran startowy aplikacji natywnej (powłoka Capacitor ładująca tę stronę).
 *
 * Natywny splash jest statyczny i znika po ułamku sekundy, a wtedy strona jeszcze się ładuje - przez
 * chwilę widać by było pusty ekran. Ten skrypt chodzi w <head> (przed pierwszym malowaniem), więc animacja
 * zaczyna się od razu. Logo poŻeramy jest "pożerane": trzy razy ktoś je gryzie (wycinki ze śladami zębów
 * i okruszki), po czym sekwencja się zapętla, dopóki strona się nie załaduje. Znika dopiero gdy React się
 * zamontuje (window.__pzBootDone) i minie minimum 2 s (żeby zdążyły się pokazać wszystkie trzy gryzy).
 * Włącza się tylko w aplikacji: powłoka dopisuje "PozeramyApp" do User-Agent (appendUserAgent w
 * capacitor.config.ts). Tło musi zgadzać się z splashem natywnym (#221e50).
 */

const CYKL = "3s";
const MIN_MS = 2000;

/** Jeden gryz = trzy zachodzące na siebie kółka na krawędzi (ślad zębów). Kółka rosną od zera do pełnego rozmiaru. */
const CSS = `
#pz-boot{position:fixed;inset:0;z-index:2147483647;background:#221e50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;transition:opacity .45s ease}
#pz-boot.pz-out{opacity:0;pointer-events:none}
#pz-boot svg{width:112px;height:112px;overflow:visible;animation:pzcy ${CYKL} ease-in-out infinite}
#pz-boot .b{transform-box:fill-box;transform-origin:center;transform:scale(0)}
#pz-boot .b1{animation:pzb1 ${CYKL} ease-out infinite}
#pz-boot .b2{animation:pzb2 ${CYKL} ease-out infinite}
#pz-boot .b3{animation:pzb3 ${CYKL} ease-out infinite}
#pz-boot .c{opacity:0}
#pz-boot .c1{animation:pzc1 ${CYKL} ease-out infinite}
#pz-boot .c2{animation:pzc2 ${CYKL} ease-out infinite}
#pz-boot .c3{animation:pzc3 ${CYKL} ease-out infinite}
#pz-boot p{margin:0;color:#fff8ef;font:700 22px/1 system-ui,sans-serif;letter-spacing:-.01em;animation:pzup .6s ease-out .25s both}
@keyframes pzcy{0%{opacity:0;transform:scale(.8)}7%{opacity:1;transform:scale(1)}22%{transform:scale(1)}25%{transform:scale(.92)}29%{transform:scale(1.04)}32%{transform:scale(1)}38%{transform:scale(1)}41%{transform:scale(.92)}45%{transform:scale(1.04)}48%{transform:scale(1)}54%{transform:scale(1)}57%{transform:scale(.92)}61%{transform:scale(1.04)}64%{transform:scale(1)}86%{opacity:1;transform:scale(1)}94%,100%{opacity:0;transform:scale(.94)}}
@keyframes pzb1{0%,22%{transform:scale(0)}27%,100%{transform:scale(1)}}
@keyframes pzb2{0%,38%{transform:scale(0)}43%,100%{transform:scale(1)}}
@keyframes pzb3{0%,54%{transform:scale(0)}59%,100%{transform:scale(1)}}
@keyframes pzc1{0%,24%{opacity:0;transform:translate(0,0)}27%{opacity:1}42%,100%{opacity:0;transform:translate(10px,34px)}}
@keyframes pzc2{0%,40%{opacity:0;transform:translate(0,0)}43%{opacity:1}58%,100%{opacity:0;transform:translate(-12px,34px)}}
@keyframes pzc3{0%,56%{opacity:0;transform:translate(0,0)}59%{opacity:1}74%,100%{opacity:0;transform:translate(6px,36px)}}
@keyframes pzup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#pz-boot svg,#pz-boot p{animation:none;opacity:1}#pz-boot .b,#pz-boot .c{display:none}}
`.replace(/\n/g, "");

const HTML = `<svg viewBox="0 0 104 104" aria-hidden="true">
<defs><mask id="pzm">
<rect width="104" height="104" rx="26" fill="#fff"/>
<g fill="#000">
<g class="b b1"><circle cx="106" cy="20" r="11"/><circle cx="103" cy="33" r="12"/><circle cx="106" cy="46" r="11"/></g>
<g class="b b2"><circle cx="4" cy="4" r="17"/><circle cx="1" cy="23" r="10"/><circle cx="23" cy="1" r="10"/></g>
<g class="b b3"><circle cx="46" cy="106" r="11"/><circle cx="60" cy="103" r="13"/><circle cx="74" cy="106" r="11"/></g>
</g></mask></defs>
<image href="/brand/po_zeramy-logo-dark-nav.webp" width="104" height="104" mask="url(#pzm)"/>
<circle class="c c1" cx="98" cy="30" r="2.6" fill="#f4a7a0"/>
<circle class="c c2" cx="12" cy="14" r="2.4" fill="#fff8ef"/>
<circle class="c c3" cx="60" cy="96" r="2.6" fill="#f4a7a0"/>
</svg><p>poŻeramy</p>`.replace(/\n/g, "");

export const BOOT_SPLASH_SCRIPT = `(function(){try{
if(!/PozeramyApp/.test(navigator.userAgent))return;
var t0=Date.now();
var s=document.createElement('style');s.textContent=${JSON.stringify(CSS)};document.head.appendChild(s);
var d=document.createElement('div');d.id='pz-boot';d.setAttribute('aria-hidden','true');d.innerHTML=${JSON.stringify(HTML)};
document.documentElement.appendChild(d);
var done=false;
window.__pzBootDone=function(){if(done)return;done=true;var w=Math.max(0,${MIN_MS}-(Date.now()-t0));setTimeout(function(){d.classList.add('pz-out');setTimeout(function(){d.remove();s.remove();},500);},w);};
setTimeout(window.__pzBootDone,8000);
}catch(e){}})();`;

/** Wołane po zamontowaniu aplikacji - zdejmuje ekran startowy (no-op poza aplikacją). */
export function dismissBootSplash(): void {
  const done = (window as unknown as { __pzBootDone?: () => void }).__pzBootDone;
  done?.();
}
