export interface PatchNote {
  version: string;
  date: string; // ISO, for display + "unseen" comparison
  title: string;
  items: { icon: string; text: string }[];
}

/** Newest first. Bump `version` whenever this list grows — that's also
 * what drives the "unseen" dot on the "Co nowego?" menu item. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: "1.4",
    date: "2026-08-19",
    title: "Losowe poleajki i nagrody za zaproszenia",
    items: [
      { icon: "🎲", text: "Losowa poleajka w bocznym menu — miejsce, w którym jeszcze nie byłeś." },
      { icon: "🎁", text: "Punkty PoŻarcia za zaproszenie znajomego, który dołączy do appki." },
      { icon: "📊", text: "Podgląd na /Znajomi: ile zaprosiłeś, kto dołączył i ile punktów zdobyłeś." },
      { icon: "🔗", text: "Więcej klikalnych linków do profili w bocznym menu." },
      { icon: "✨", text: "Odświeżony wygląd nagłówka profilu publicznego." },
    ],
  },
  {
    version: "1.3",
    date: "2026-08-18",
    title: "Zaproszenia, VIP i własne zdjęcie profilowe",
    items: [
      { icon: "👥", text: "Nowy, prostszy system zaproszeń znajomych z podglądem linku." },
      { icon: "👑", text: "Status VIP w nagrodę za zaproszenie 10 znajomych do poŻeramy." },
      { icon: "🖼️", text: "Możliwość wgrania własnego zdjęcia profilowego." },
      { icon: "📱", text: "Przeprojektowane boczne menu — więcej informacji na pierwszy rzut oka." },
      { icon: "📄", text: "Zaktualizowany regulamin i polityka prywatności." },
    ],
  },
  {
    version: "1.2",
    date: "2026-08-15",
    title: "Poprawki i porządki",
    items: [
      { icon: "🍕", text: "Nowa grafika na stronie błędu 404." },
      { icon: "📍", text: "Zakładki w „Moje miejsca” — czytelniejszy wybór aktywnej." },
      { icon: "🐛", text: "Drobne poprawki stabilności." },
    ],
  },
];

export const LATEST_PATCH_VERSION = PATCH_NOTES[0]?.version ?? "1.0";

const STORAGE_KEY = "pz_patch_notes_seen_version";

export function getSeenPatchVersion(): string | null {
  if (typeof window === "undefined") return LATEST_PATCH_VERSION;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return LATEST_PATCH_VERSION;
  }
}

export function markPatchNotesSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, LATEST_PATCH_VERSION);
  } catch {
    /* ignore */
  }
}

export function hasUnseenPatchNotes(): boolean {
  return getSeenPatchVersion() !== LATEST_PATCH_VERSION;
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Lets any component (e.g. a "Co nowego?" menu item) open the patch notes on demand. */
export function openPatchNotes() {
  listeners.forEach((fn) => fn());
}

export function onPatchNotesOpenRequest(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
