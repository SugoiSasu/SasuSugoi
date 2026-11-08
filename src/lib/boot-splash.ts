import { BITE_TIMES, GULP_AT } from "./boot-splash-art";

/**
 * Animowany ekran startowy aplikacji natywnej (powłoka Capacitor ładująca tę stronę).
 *
 * Natywny splash jest statyczny i znika po ułamku sekundy, a wtedy strona jeszcze się ładuje - przez
 * chwilę widać by było pusty ekran. Ten skrypt chodzi w <head> (przed pierwszym malowaniem): pokazuje
 * animowany obraz, w którym logo poŻeramy jest "pożerane" pięcioma gryzami, aż zostaje puste miejsce
 * i kropki ładowania. To obraz (WebP), a nie animowany SVG: przeglądarka dekoduje go poza wątkiem
 * głównym, więc nie laguje, gdy ten sam wątek ładuje i uruchamia całą aplikację.
 *
 * - Gra RAZ NA URUCHOMIENIE aplikacji (sessionStorage): pełne przeładowania strony (przejścia, auto-odświeżanie
 *   po nowej wersji) nie powtarzają ekranu ani dźwięku.
 * - Dźwięk jest syntezowany w WebAudio (zero plików), startuje razem z obrazem, gra tylko jeśli system
 *   pozwala na automatyczne odtwarzanie, i jest zamykany razem z ekranem.
 * - Włącza się wyłącznie w aplikacji: powłoka dopisuje "PozeramyApp" do User-Agent (appendUserAgent
 *   w capacitor.config.ts). Tło musi zgadzać się z splashem natywnym (#221e50).
 * - Obraz powstaje ze scripts/build-boot-splash.mjs (rysunek: boot-splash-art.ts).
 */

/** Zjedzenie całości (ostatni gryz 2,15 s + 0,15 s) plus chwila na "gulp" i oddech - liczone od startu obrazu. */
const MIN_MS = 2700;

const CSS =
  `#pz-boot{position:fixed;inset:0;z-index:2147483647;background:#221e50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;transition:opacity .45s ease}` +
  `#pz-boot.pz-out{opacity:0;pointer-events:none}` +
  `#pz-boot .lg{position:relative;width:112px;height:112px}` +
  `#pz-boot .ch{position:absolute;left:-6px;top:-6px;width:124px;height:156px}` +
  `#pz-boot p{margin:0;color:#fff8ef;font:700 22px/1 system-ui,sans-serif;letter-spacing:-.01em;animation:pzup .5s ease-out both}` +
  `#pz-boot .dots{display:flex;gap:7px;height:8px;opacity:0;animation:pzfade .3s ease-out ${GULP_AT}s both}` +
  `#pz-boot .dots i{width:7px;height:7px;border-radius:50%;background:#fff8ef;opacity:.35;animation:pzdot 1s ease-in-out infinite}` +
  `#pz-boot .dots i:nth-child(2){animation-delay:.15s}#pz-boot .dots i:nth-child(3){animation-delay:.3s}` +
  `@keyframes pzup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}` +
  `@keyframes pzfade{from{opacity:0}to{opacity:1}}` +
  `@keyframes pzdot{50%{opacity:1;transform:translateY(-4px)}}` +
  `@media (prefers-reduced-motion:reduce){#pz-boot p,#pz-boot .dots,#pz-boot .dots i{animation:none}#pz-boot .dots{opacity:1}}`;

const HTML = `<div class="lg"></div><p>poŻeramy</p><div class="dots"><i></i><i></i><i></i></div>`;

/**
 * Chrupanie: krótkie trzaski szumu przepuszczone przez pasmo ~1,5-4 kHz (trzy mikrouderzenia na gryz,
 * każde nieco inne) plus niskie "puknięcie". Na końcu "gulp" - opadający sinus. Wystawione jako
 * window.__pzSynth, żeby dało się je wyrenderować offline (test).
 */
const SYNTH_JS = `
window.__pzSynth=function(ctx,dest,t,kind){
  if(kind==='gulp'){
    var o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(260,t);o.frequency.exponentialRampToValueAtTime(95,t+.16);
    var g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.2);
    o.connect(g);g.connect(dest);o.start(t);o.stop(t+.22);return;
  }
  var sr=ctx.sampleRate,len=Math.floor(sr*.09),buf=ctx.createBuffer(1,len,sr),d=buf.getChannelData(0);
  for(var k=0;k<len;k++){d[k]=(Math.random()*2-1)*Math.pow(1-k/len,2.2);}
  [0,.035,.07].forEach(function(off,j){
    var src=ctx.createBufferSource();src.buffer=buf;src.playbackRate.value=.85+Math.random()*.5;
    var bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1500+Math.random()*2500;bp.Q.value=.9;
    var g=ctx.createGain(),tt=t+off;g.gain.setValueAtTime(0,tt);g.gain.linearRampToValueAtTime(.55-j*.12,tt+.004);g.gain.exponentialRampToValueAtTime(.001,tt+.09);
    src.connect(bp);bp.connect(g);g.connect(dest);src.start(tt);
  });
  var o2=ctx.createOscillator();o2.type='triangle';o2.frequency.setValueAtTime(180,t);o2.frequency.exponentialRampToValueAtTime(70,t+.07);
  var g2=ctx.createGain();g2.gain.setValueAtTime(.0001,t);g2.gain.exponentialRampToValueAtTime(.25,t+.005);g2.gain.exponentialRampToValueAtTime(.001,t+.09);
  o2.connect(g2);g2.connect(dest);o2.start(t);o2.stop(t+.1);
};
`.replace(/\n\s*/g, "");

export const BOOT_SPLASH_SCRIPT = `(function(){try{
if(!/PozeramyApp/.test(navigator.userAgent))return;
${SYNTH_JS}
var cur=null;
function play(){
  var s=document.createElement('style');s.textContent=${JSON.stringify(CSS)};document.head.appendChild(s);
  var d=document.createElement('div');d.id='pz-boot';d.setAttribute('aria-hidden','true');d.innerHTML=${JSON.stringify(HTML)};
  document.documentElement.appendChild(d);
  var ac=null,tStart=0,ready=false,wantDone=false,gone=false;
  function closeAudio(){try{if(ac&&ac.state!=='closed')ac.close();}catch(e){}ac=null;}
  function startSound(){
    try{
      var AC=window.AudioContext||window.webkitAudioContext;
      if(!AC||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
      ac=new AC();var master=ac.createGain();master.gain.value=.7;master.connect(ac.destination);
      var plan=function(){
        if(!ac||gone)return;
        var el=(Date.now()-tStart)/1000,base=ac.currentTime;
        ${JSON.stringify([...BITE_TIMES])}.forEach(function(o){var w=o-el;if(w>=-0.05)window.__pzSynth(ac,master,base+Math.max(0,w),'bite');});
        var gw=${GULP_AT}-el;if(gw>=-0.05)window.__pzSynth(ac,master,base+Math.max(0,gw),'gulp');
      };
      if(ac.state==='running')plan();
      else if(ac.resume)ac.resume().then(function(){if(ac&&ac.state==='running')plan();}).catch(function(){});
      setTimeout(closeAudio,${Math.round((GULP_AT + 1) * 1000)});
    }catch(e){}
  }
  function tryDismiss(force){
    if(!wantDone||gone)return;
    if(!ready&&!force)return;
    gone=true;
    var w=ready?Math.max(0,${MIN_MS}-(Date.now()-tStart)):0;
    setTimeout(function(){d.classList.add('pz-out');closeAudio();setTimeout(function(){d.remove();s.remove();},500);},w);
  }
  var lg=d.querySelector('.lg'),im=new Image();
  im.className='ch';im.alt='';im.decoding='async';
  function start(){tStart=Date.now();ready=true;startSound();tryDismiss(false);}
  im.onload=function(){
    var go=function(){lg.appendChild(im);start();};
    if(im.decode)im.decode().then(go,go);else go();
  };
  im.onerror=function(){var f=new Image();f.alt='';f.src='/brand/po_zeramy-logo-dark-nav.webp';f.style.cssText='width:112px;height:112px;border-radius:26px';lg.appendChild(f);start();};
  im.src='/brand/boot-chomp.webp';
  return {done:function(force){wantDone=true;tryDismiss(!!force);}};
}
// Pierwsze zaladowanie okna WebView: raz na jego zycie (przeladowania i przejscia nie powtarzaja ekranu).
var first=true;
try{if(sessionStorage.getItem('pz-boot'))first=false;else sessionStorage.setItem('pz-boot','1');}catch(e){}
if(first){
  cur=play();
  setTimeout(function(){if(cur)cur.done(true);},10000);
}
window.__pzBootDone=function(){if(cur)cur.done(false);};
// Powrot do aplikacji po dluzszej nieobecnosci (strona sie wtedy nie przeladowuje): gramy ekran jeszcze raz.
window.__pzBootShow=function(){
  if(document.getElementById('pz-boot'))return;
  cur=play();cur.done(false);
};
}catch(e){}})();`;

/** Wołane po zamontowaniu aplikacji - zdejmuje ekran startowy (no-op poza aplikacją). */
export function dismissBootSplash(): void {
  const done = (window as unknown as { __pzBootDone?: () => void }).__pzBootDone;
  done?.();
}

/** Po jakiej nieobecności w tle powrót do aplikacji znów pokazuje ekran startowy. */
export const RESUME_AFTER_MS = 30_000;

/**
 * Android nie niszczy okna WebView po zamknięciu aplikacji - zostaje w pamięci, a ponowne otwarcie nie
 * ładuje strony od nowa, więc sam skrypt w <head> by się nie odpalił. Ta funkcja nasłuchuje zmian stanu
 * aplikacji (przekazanych z mostu, patrz onAppEvent) i po powrocie po dłuższej nieobecności odtwarza ekran.
 * Zwraca funkcję odłączającą nasłuch.
 */
export function installResumeBootSplash(
  subscribe: (event: string, cb: (e: { isActive: boolean }) => void) => () => void,
  now: () => number = Date.now,
): () => void {
  let hiddenAt = 0;
  return subscribe("appStateChange", ({ isActive }) => {
    if (!isActive) {
      hiddenAt = now();
      return;
    }
    if (hiddenAt && now() - hiddenAt >= RESUME_AFTER_MS) {
      (window as unknown as { __pzBootShow?: () => void }).__pzBootShow?.();
    }
    hiddenAt = 0;
  });
}
