/**
 * Animowany ekran startowy aplikacji natywnej (powłoka Capacitor ładująca tę stronę).
 *
 * Natywny splash jest statyczny i znika po ułamku sekundy, a wtedy strona jeszcze się ładuje - przez
 * chwilę widać by było pusty ekran. Ten skrypt chodzi w <head> (przed pierwszym malowaniem), więc animacja
 * zaczyna się od razu: logo poŻeramy jest po kolei "pożerane" pięcioma gryzami (wycinki ze śladami zębów,
 * okruszki, chrupanie), aż zostaje puste miejsce, a pod napisem pojawiają się kropki ładowania. Sekwencja
 * jest jednorazowa i kończy się zjedzonym logo. Znika, gdy React się zamontuje (window.__pzBootDone) i minie
 * czas potrzebny na zjedzenie całości (MIN_MS).
 *
 * Dźwięk jest syntezowany w WebAudio (zero plików) i gra tylko jeśli system pozwala na automatyczne
 * odtwarzanie; jeśli nie, animacja idzie po cichu. Włącza się wyłącznie w aplikacji: powłoka dopisuje
 * "PozeramyApp" do User-Agent (appendUserAgent w capacitor.config.ts). Tło musi zgadzać się z splashem
 * natywnym (#221e50).
 */

/** Momenty gryzów (s od startu animacji). Muszą zgadzać się z opóźnieniami w CSS i keyframes pzsq. */
export const BITE_TIMES = [0.55, 0.95, 1.35, 1.75, 2.15] as const;
const GULP_AT = 2.32;
/** Zjedzenie całości (ostatni gryz 2,15 s + 0,15 s) plus chwila na "gulp" i oddech. */
const MIN_MS = 2700;

/**
 * Kółka wycinane z logo (viewBox 104). Każdy gryz = kółko główne + boczne, które tworzą ślad zębów na
 * krawędzi. Razem pokrywają cały kafelek (sprawdzone numerycznie: 0 niepokrytych punktów).
 */
export const BITES: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[94, 16, 34], [104, 46, 17], [62, 0, 22]],
  [[10, 14, 34], [0, 46, 17], [34, 0, 16]],
  [[14, 92, 34], [0, 60, 17], [38, 104, 16]],
  [[92, 92, 34], [104, 60, 17], [56, 104, 22]],
  [[52, 52, 36], [24, 52, 16], [80, 52, 16], [52, 24, 16], [52, 80, 16]],
];

/** Okruszki: miejsce skąd lecą i przesunięcie w bok (px) podczas spadania. */
const CRUMBS: ReadonlyArray<readonly [number, number, number, string]> = [
  [98, 30, 8, "#f4a7a0"],
  [10, 22, -10, "#fff8ef"],
  [22, 94, -8, "#f4a7a0"],
  [88, 96, 10, "#fff8ef"],
  [52, 54, 4, "#f4a7a0"],
];

const T_SQ = 2.6; // czas trwania keyframes pzsq (s)
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

const CSS = (
  `#pz-boot{position:fixed;inset:0;z-index:2147483647;background:#221e50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;transition:opacity .45s ease}` +
  `#pz-boot.pz-out{opacity:0;pointer-events:none}` +
  `#pz-boot svg{width:112px;height:112px;overflow:visible;animation:pzin .25s cubic-bezier(.2,.8,.2,1) both}` +
  `#pz-boot .sq{transform-box:fill-box;transform-origin:center;animation:pzsq ${T_SQ}s ease-in-out both}` +
  `#pz-boot .b{transform-box:fill-box;transform-origin:center;transform:scale(0);animation:pzb .16s ease-out both}` +
  BITE_TIMES.map((t, i) => `#pz-boot .b${i + 1}{animation-delay:${t}s}`).join("") +
  `#pz-boot .c{opacity:0;animation:pzc .9s ease-in both}` +
  BITE_TIMES.map((t, i) => `#pz-boot .c${i + 1}{animation-delay:${(t + 0.02).toFixed(2)}s}`).join("") +
  `#pz-boot p{margin:0;color:#fff8ef;font:700 22px/1 system-ui,sans-serif;letter-spacing:-.01em;animation:pzup .6s ease-out .25s both}` +
  `#pz-boot .dots{display:flex;gap:7px;height:8px;opacity:0;animation:pzfade .3s ease-out ${GULP_AT}s both}` +
  `#pz-boot .dots i{width:7px;height:7px;border-radius:50%;background:#fff8ef;opacity:.35;animation:pzdot 1s ease-in-out infinite}` +
  `#pz-boot .dots i:nth-child(2){animation-delay:.15s}#pz-boot .dots i:nth-child(3){animation-delay:.3s}` +
  `@keyframes pzin{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}` +
  `@keyframes pzsq{${squishKeyframes}}` +
  `@keyframes pzb{from{transform:scale(0)}to{transform:scale(1)}}` +
  `@keyframes pzc{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),46px)}}` +
  `@keyframes pzup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}` +
  `@keyframes pzfade{from{opacity:0}to{opacity:1}}` +
  `@keyframes pzdot{50%{opacity:1;transform:translateY(-4px)}}` +
  `@media (prefers-reduced-motion:reduce){#pz-boot svg,#pz-boot p,#pz-boot .sq,#pz-boot .dots,#pz-boot .dots i{animation:none}#pz-boot .dots{opacity:1}#pz-boot .b,#pz-boot .c{display:none}}`
).replace(/\n/g, "");

const HTML = (
  `<svg viewBox="0 0 104 104" aria-hidden="true"><defs><mask id="pzm"><rect width="104" height="104" rx="26" fill="#fff"/><g fill="#000">` +
  BITES.map(
    (g, i) => `<g class="b b${i + 1}">${g.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>`,
  ).join("") +
  `</g></mask></defs><g class="sq"><image href="/brand/po_zeramy-logo-dark-nav.webp" width="104" height="104" mask="url(#pzm)"/></g>` +
  CRUMBS.map(
    ([x, y, dx, fill], i) => `<circle class="c c${i + 1}" cx="${x}" cy="${y}" r="2.6" fill="${fill}" style="--dx:${dx}px"/>`,
  ).join("") +
  `</svg><p>poŻeramy</p><div class="dots"><i></i><i></i><i></i></div>`
).replace(/\n/g, "");

/**
 * Chrupanie: krótkie trzaski szumu przepuszczone przez pasmo ~1,5-4 kHz (trzy mikrouderzenia na gryz,
 * każde nieco inne) plus niskie "puknięcie". Na końcu "gulp" - opadający sinus. Wystawione jako
 * window.__pzSynth, żeby dało się je wyrenderować offline (test).
 */
const AUDIO_JS = `
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
try{
  var AC=window.AudioContext||window.webkitAudioContext;
  if(AC&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    var ac=new AC(),master=ac.createGain();master.gain.value=.7;master.connect(ac.destination);
    var plan=function(){
      var elapsed=(Date.now()-t0)/1000,base=ac.currentTime;
      var at=${JSON.stringify([...BITE_TIMES])};
      at.forEach(function(o){var w=o-elapsed;if(w>=-0.05)window.__pzSynth(ac,master,base+Math.max(0,w),'bite');});
      var gw=${GULP_AT}-elapsed;if(gw>=-0.05)window.__pzSynth(ac,master,base+Math.max(0,gw),'gulp');
    };
    if(ac.state==='running')plan();
    else if(ac.resume){ac.resume().then(function(){if(ac.state==='running')plan();}).catch(function(){});}
  }
}catch(e){}
`.replace(/\n\s*/g, "");

export const BOOT_SPLASH_SCRIPT = `(function(){try{
if(!/PozeramyApp/.test(navigator.userAgent))return;
var t0=Date.now();
var s=document.createElement('style');s.textContent=${JSON.stringify(CSS)};document.head.appendChild(s);
var d=document.createElement('div');d.id='pz-boot';d.setAttribute('aria-hidden','true');d.innerHTML=${JSON.stringify(HTML)};
document.documentElement.appendChild(d);
${AUDIO_JS}
var done=false;
window.__pzBootDone=function(){if(done)return;done=true;var w=Math.max(0,${MIN_MS}-(Date.now()-t0));setTimeout(function(){d.classList.add('pz-out');setTimeout(function(){d.remove();s.remove();},500);},w);};
setTimeout(window.__pzBootDone,8000);
}catch(e){}})();`;

/** Wołane po zamontowaniu aplikacji - zdejmuje ekran startowy (no-op poza aplikacją). */
export function dismissBootSplash(): void {
  const done = (window as unknown as { __pzBootDone?: () => void }).__pzBootDone;
  done?.();
}
