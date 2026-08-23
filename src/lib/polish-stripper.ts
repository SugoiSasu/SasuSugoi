// Globally transliterates Polish diacritics (ą,ć,ę,ł,ń,ó,ś,ź,ż + uppercase)
// inside any element rendered with the Persona display font, so words don't
// awkwardly fall back to the body font mid-word (e.g. "CHCę ODWIEDZIć").
// Persona's @font-face only declares unicode-range U+0020-00FF, so it's
// missing glyphs for most of these letters specifically - other faces
// (Bricolage Grotesque, Manrope, body text) have full Polish coverage and
// must NOT be touched here, or real headings lose their diacritics for no
// reason (e.g. a plain <h2> reading "Osiągnięcia" turning into "Osiagniecia").
//
// Strategy: walk text nodes whose nearest ancestor matches .font-persona
// specifically, and replace chars in-place. A MutationObserver re-runs on
// DOM changes so React updates are covered.

const MAP: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  Ą: "A",
  Ć: "C",
  Ę: "E",
  Ł: "L",
  Ń: "N",
  Ó: "O",
  Ś: "S",
  Ź: "Z",
  Ż: "Z",
};
const RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
const DISPLAY_SELECTOR = ".font-persona";

function strip(s: string): string {
  return s.replace(RE, (ch) => MAP[ch] ?? ch);
}

function processNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    if (!text || !RE.test(text)) return;
    RE.lastIndex = 0;
    const parent = node.parentElement;
    if (!parent) return;
    // Skip script/style/textarea/input/contenteditable.
    const tag = parent.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT") return;
    if (parent.isContentEditable) return;
    if (!parent.closest(DISPLAY_SELECTOR)) return;
    const next = strip(text);
    if (next !== text) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
  // Walk subtree text nodes.
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const v = n.nodeValue;
      if (!v) return NodeFilter.FILTER_REJECT;
      RE.lastIndex = 0;
      return RE.test(v) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets: Text[] = [];
  let cur = walker.nextNode();
  while (cur) {
    targets.push(cur as Text);
    cur = walker.nextNode();
  }
  for (const t of targets) processNode(t);
}

let installed = false;
let observer: MutationObserver | null = null;

export function installPolishStripper() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const run = () => processNode(document.body);
  run();
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") {
        processNode(m.target);
      } else if (m.type === "childList") {
        m.addedNodes.forEach((n) => processNode(n));
      } else if (m.type === "attributes" && m.target.nodeType === Node.ELEMENT_NODE) {
        // class change may add font-display - reprocess subtree.
        processNode(m.target);
      }
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

export function uninstallPolishStripper() {
  observer?.disconnect();
  observer = null;
  installed = false;
}
