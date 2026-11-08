/**
 * Animowany ekran startowy aplikacji natywnej (powłoka Capacitor ładująca tę stronę).
 *
 * Natywny splash jest statyczny i znika po ułamku sekundy, a wtedy strona jeszcze się ładuje - przez
 * chwilę widać by było pusty ekran. Ten skrypt chodzi w <head> (przed pierwszym malowaniem), więc animacja
 * zaczyna się od razu, a znika dopiero gdy React się zamontuje (window.__pzBootDone) i minie minimum 1,5 s,
 * żeby nie mignęła. Włącza się tylko w aplikacji: powłoka dopisuje "PozeramyApp" do User-Agent
 * (appendUserAgent w capacitor.config.ts). Tło i kolor muszą zgadzać się z splashem natywnym (#221e50).
 */
export const BOOT_SPLASH_SCRIPT = [
  "(function(){try{",
  "if(!/PozeramyApp/.test(navigator.userAgent))return;",
  "var t0=Date.now();",
  "var s=document.createElement('style');",
  "s.textContent='",
  "#pz-boot{position:fixed;inset:0;z-index:2147483647;background:#221e50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;transition:opacity .45s ease}",
  "#pz-boot.pz-out{opacity:0;pointer-events:none}",
  "#pz-boot .lg{position:relative;width:104px;height:104px}",
  "#pz-boot img{position:relative;width:104px;height:104px;border-radius:26px;animation:pzin .6s cubic-bezier(.2,.8,.2,1) both,pzbr 2.4s ease-in-out .6s infinite}",
  "#pz-boot .rg{position:absolute;inset:0;border-radius:26px;border:2px solid #e63946;opacity:0;animation:pzrg 1.8s ease-out .5s infinite}",
  "#pz-boot p{margin:0;color:#fff8ef;font:700 22px/1 system-ui,sans-serif;letter-spacing:-.01em;animation:pzup .6s ease-out .25s both}",
  "@keyframes pzin{from{opacity:0;transform:scale(.78)}to{opacity:1;transform:scale(1)}}",
  "@keyframes pzbr{50%{transform:scale(1.04)}}",
  "@keyframes pzrg{0%{opacity:.55;transform:scale(1)}100%{opacity:0;transform:scale(1.55)}}",
  "@keyframes pzup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
  "@media (prefers-reduced-motion:reduce){#pz-boot img,#pz-boot p{animation:none;opacity:1}#pz-boot .rg{display:none}}",
  "';",
  "document.head.appendChild(s);",
  "var d=document.createElement('div');d.id='pz-boot';d.setAttribute('aria-hidden','true');",
  "d.innerHTML='<div class=\"lg\"><span class=\"rg\"></span><img alt=\"\" src=\"/brand/po_zeramy-logo-dark-nav.webp\"></div><p>po\u017beramy</p>';",
  "document.documentElement.appendChild(d);",
  "var done=false;",
  "window.__pzBootDone=function(){if(done)return;done=true;var w=Math.max(0,1500-(Date.now()-t0));setTimeout(function(){d.classList.add('pz-out');setTimeout(function(){d.remove();s.remove();},500);},w);};",
  // Awaryjnie: gdyby React nigdy się nie zamontował, ekran startowy nie zostaje na zawsze.
  "setTimeout(window.__pzBootDone,8000);",
  "}catch(e){}})();",
].join("");

/** Wołane po zamontowaniu aplikacji - zdejmuje ekran startowy (no-op poza aplikacją). */
export function dismissBootSplash(): void {
  const done = (window as unknown as { __pzBootDone?: () => void }).__pzBootDone;
  done?.();
}
