# poŻeramy — brief do migracji z Lovable na Claude Code

Ten dokument to punkt startowy dla Claude Code. Zawiera wszystko czego potrzeba,
żeby zrozumieć projekt i dokończyć/przebudować to, czego nie dało się ściągnąć
1:1 z Lovable. Przeczytaj to w całości przed zaczęciem kodowania.

---

## 0. Jak masz pracować z tym briefem (przeczytaj to jako pierwsze)

- **Nie zgaduj.** Ten brief opisuje architekturę, model danych i znane wzorce
  — ale przy każdej decyzji, której brief nie rozstrzyga wprost (dokładny
  layout ekranu, konkretne rozwiązanie UX na desktopie, kolejność sekcji,
  szczegóły interakcji), **zapytaj Mateusza zamiast wybierać sam** i lecieć
  dalej z założeniem, że masz rację. Wcześniejsze wersje tej appki (w Lovable)
  miały konkretne rozwiązania (np. dwukolumnowy layout mapy: lista po lewej +
  mapa po prawej) — potraktuj je jako **inspirację, nie jako docelowe
  rozwiązanie do 1:1 skopiowania**. Mateusz explicite nie chce się ograniczać
  do tamtych konkretnych wyborów przy przebudowie.
- **Trzymaj się wizualnie mockupu KV opisanego w sekcji 1a, nie generycznego
  designu.** Nie twórz "standardowego" wyglądu shadcn/Tailwind z domyślnymi
  odległościami, domyślną paletą, domyślnym stylem kart. Paleta kolorów,
  kształty (koła zamiast kwadratów na odznakach, pineski w kształcie łezki na
  mapie), typografia (Bricolage Grotesque) i konkretny układ elementów z KV to
  wymagania, nie sugestie.
- Zadawaj pytania **na bieżąco, ekran po ekranie**, a nie jedno wielkie
  pytanie na starcie. Np. przy budowie ekranu Mapa dopiero wtedy zapytaj jak
  ma wyglądać wersja desktopowa (czy lista+mapa obok siebie, czy inaczej) —
  nie zakładaj wcześniejszego rozwiązania z Lovable.

## 1a. Design reference — mockup KV (opis tekstowy, bo obrazki nie są dołączone do tego pliku)

Mateusz ma gotowy mockup wizualny (KV) całej aplikacji — dwa obrazy: jeden z
6 ekranami mobile + 4 ekranami desktop, drugi to bliższy zoom na te same 6
ekranów mobile z dodatkowym logo "POŻERAMY" u góry. **Poproś Mateusza żeby
załączył Ci te obrazy bezpośrednio w rozmowie** (ma je jako pliki PNG) — to
dużo dokładniejsze źródło prawdy niż poniższy opis słowny. Poniższy opis to
tylko zapasowy fallback, gdyby obrazów nie było pod ręką.

**Styl ogólny:** ciepłe, kremowe tło (#EDEADE), organiczne kleksy/plamy w tle
jako dekoracja, zaokrąglone karty (duży border-radius), zdjęcia jedzenia jako
główny element wizualny, emoji jako ikony kategorii kuchni.

**Ekran 1 — Odkrywaj (mobile):** logo "POŻERA" u góry po lewej + dzwonek
powiadomień po prawej. Pasek wyszukiwania z placeholder "Szukaj restauracje,
kuchni, miejsc..." i ikoną filtra po prawej. Sekcja "Kategorie" — rząd
kolorowych kwadratowych kafli z emoji (Pizza, Burgery, Sushi, Kawa) + link
"Zobacz wszystkie". Sekcja "Polecane dla Ciebie" — poziomo scrollowane karty
(zdjęcie z ikoną serca w rogu, nazwa, kuchnia+cena, ocena+liczba opinii).
Sekcja "Nowo otwarte" — podobne karty, jedna widoczna na pełną szerokość.
Dolny pasek nawigacji: Odkrywaj / Mapa / [+ w pomarańczowym kółku] / Moje
miejsca / Profil.

**Ekran 2 — Mapa:** pasek filtrów pod wyszukiwarką: "Filtry", "Kuchnia ⌄",
"Ocena ⌄", "Otwarte teraz" jako osobne przyciski/dropdowny (NIE chipsy).
Mapa Poznania z kolorowymi pineskami w kształcie łezki (kolor zależny od
kuchni). Karta wybranego miejsca wysunięta z dołu mapy: zdjęcie, nazwa,
kuchnia+cena, ocena+odległość, strzałka rozwinięcia.

**Ekran 3 — Profil restauracji:** górny pasek: strzałka wstecz, ikony
udostępnij/menu po prawej, na zdjęciu tła. Duże zdjęcie wnętrza jako hero.
Okrągły awatar z inicjałami w kolorowym kółku (np. "WJ" na granatowym tle)
nachodzący na zdjęcie, obok nazwa restauracji. Poniżej: kuchnia+cena, ocena+
liczba opinii+odległość, status otwarcia ("Otwarte • Zamknięcie 23:00" zielony
kropkowany wskaźnik), adres. Krótki opis tekstowy. Trzy równe przyciski w
rzędzie: "Chcę odwiedzić" (obrys), "Byłem tutaj" (wypełniony granatowy),
"Ulubione" (wypełniony pomarańczowy/terakota). Sekcja "Zdjęcia" — pozioma
galeria miniaturek + "Zobacz wszystkie". Sekcja "Opinie" — lista z awatarem,
imieniem, czasem, gwiazdkami, treścią.

**Ekran 4 — Profil użytkownika:** górny pasek z ikoną ustawień i dzwonkiem.
Duży okrągły avatar na środku, imię, @username, badge poziomu (pomarańczowy,
"Poziom 24"), pasek postępu XP z liczbami ("2630 / 3500 XP"). Trzy statystyki
w rzędzie (Odwiedzone / Do odwiedzenia / Ulubione) jako duże liczby. Sekcja
"Odznaki" — rząd kolorowych kółek z emoji + link "Zobacz wszystkie". Sekcja
"Ostatnia aktywność" — lista wpisów z ikoną, opisem czynności, czasem
względnym ("2 dni temu").

**Ekran 5 — Moje miejsca:** zakładki poziome (Do odwiedzenia / Odwiedzone /
Ulubione / Znajomi), aktywna podkreślona na pomarańczowo. Lista wierszy:
kwadratowe zdjęcie miniaturki, nazwa, kuchnia+cena, dystans w km, ikona
zakładki/opcji po prawej.

**Ekran 6 — Osiągnięcia:** karta "Twój postęp" z dużym poziomem, paskiem XP,
ikonką lodów po prawej. Sekcja "Odznaki" — siatka KOLISTYCH ikon w różnych
nasyconych kolorach (nie szarość, każda odznaka ma swój kolor tła), nazwa pod
spodem, + link "Zobacz wszystkie". Sekcja "Ranking znajomych" — podium/lista
z miejscem (1/2/3), avatarem, imieniem, liczbą odwiedzonych miejsc, emoji-
odznaką po prawej, użytkownik ("Ty") podświetlony.

**Wersja desktop:** lewy sidebar (granatowy #3A4489, szerokość ~stała) z
logo na górze i pionową listą: Odkrywaj / Mapa / Moje miejsca / Znajomi /
Osiągnięcia / Profil, na dole Ustawienia / Wyloguj. Główna treść po prawej,
te same ekrany co mobile ale z wykorzystaniem szerszej przestrzeni (np.
siatka kart zamiast poziomego scrolla) — DOKŁADNY układ per ekran do ustalenia
z Mateuszem, nie zakładaj z góry (patrz sekcja 0).

## 1. Czym jest ta aplikacja

poŻeramy (docelowa domena: **pozeramy.live**) to aplikacja do odkrywania
restauracji w Poznaniu — mapa interaktywna, recenzje, gamifikacja (odznaki,
ranking znajomych), integracja z rolkami z Instagrama, i konta dla właścicieli
restauracji. Marka ma casualowy, "gastro bro" ton głosu — bezpośredni, bez
korpo-mowy, bez myślników em-dash w treściach PL. Hasło marki: "Testujemy.
Polecamy."

Pełny opis produktowy (funkcje, target, plany rozwoju) jest w tym samym
katalogu co ten plik — jeśli dostałeś też `pozeramy-brief-claude-design.md`
z wcześniejszej sesji, przeczytaj i to.

## 2. Stack techniczny

- **Frontend:** React 19 + TanStack Start/Router (SSR) + Vite 8 + Tailwind CSS 4
- **UI:** shadcn/ui (style "new-york", ikony lucide-react) — **NIE jest
  dołączone do tego exportu**, patrz sekcja 4.
- **Backend:** Supabase (Postgres + Auth + Storage), obecnie jako "Lovable
  Cloud" (managed) — po migracji podłączyć jako zwykły, własny projekt Supabase
- **Mapa:** Leaflet + leaflet.markercluster
- **Formularze:** react-hook-form + zod
- **Email:** react-email (szablony) + kolejka w Postgres (pgmq-style) — obecnie
  wysyłane przez `@lovable.dev/email-js`, patrz sekcja 5

## 3. Co jest w tym folderze (co realnie ściągnąłem)

```
supabase/EXPORT_SCHEMA_COMBINED.sql   ← PEŁNY schemat bazy, 55 migracji SQL w kolejności
src/integrations/supabase/types.ts     ← pełny model danych (Insert/Update uproszczone,
                                          i tak wygenerują się na nowo z `supabase gen types`)
src/integrations/supabase/client.ts, client.server.ts,
  auth-attacher.ts, auth-middleware.ts ← w 95% standardowy @supabase/supabase-js, gotowe do użycia
src/integrations/lovable/index.ts      ← JEDYNY plik zależny od @lovable.dev/cloud-auth-js,
                                          patrz sekcja 5 punkt 1
src/styles.css                         ← pełny, wszystkie design tokeny i utility klasy
src/data/places.ts                     ← metadata kuchni (kolory, emoji)
src/router.tsx, server.ts, start.ts    ← routing/SSR wiring
package.json                           ← pełna lista zależności (patrz sekcja 5 co usunąć)
vite.config.ts, tsconfig.json, eslint.config.js, components.json,
  .prettierrc, .prettierignore, bunfig.toml, .gitignore, supabase/config.toml
EXPORT_LIB.txt      ← 61 plików z src/lib/**/*.ts(x) sklejonych w jeden plik,
                       separator "-- FILE: {ścieżka}" — ROZBIJ na osobne pliki wg ścieżek
EXPORT_ROUTES.txt   ← 53 pliki z src/routes/**/*.ts(x), ten sam format
EXPORT_COMPONENTS.txt ← 27 plików z src/components/*.tsx (BEZ components/ui/), ten sam format
```

**Jak rozbić EXPORT_*.txt na prawdziwe pliki:** każdy fragment zaczyna się od
linii `-- FILE: sciezka/do/pliku.ts`. Napisz krótki skrypt (Python/Node), który
dzieli po tym markerze i zapisuje każdy fragment pod właściwą ścieżką
względem korzenia repo. Zrób to jako pierwszy krok w Claude Code.

## 4. Czego NIE ma w tym exporcie (celowo albo z ograniczeń technicznych)

- **`src/components/ui/*.tsx`** (~60 plików) — to standardowe komponenty
  shadcn/ui, nieedytowane. Zamiast kopiować, zainstaluj je na nowo:
  `npx shadcn@latest init` (style: new-york, baseColor: slate, cssVariables:
  true — patrz `components.json` w tym folderze dla dokładnej konfiguracji),
  potem `npx shadcn@latest add accordion alert-dialog alert aspect-ratio
  avatar badge breadcrumb button calendar card carousel chart checkbox
  collapsible command context-menu dialog drawer dropdown-menu form
  hover-card input-otp input label menubar navigation-menu pagination
  popover progress radio-group resizable scroll-area select separator
  sheet sidebar skeleton slider sonner switch table tabs textarea
  toggle-group toggle tooltip`
- **`src/assets/**`** — pliki `.asset.json` to wskaźniki na obrazy hostowane
  przez Lovable (`/__l5e/assets-v1/...`), nie same obrazy. Musisz albo pobrać
  te obrazy ręcznie z żywego serwisu (https://pozeramy.live) i wrzucić do
  `src/assets/`, albo wygenerować/zamówić nowe grafiki brandowe. Lista plików
  które trzeba odtworzyć: logo (3 warianty kolorystyczne), 7 okładek kuchni
  (american, asia, breakfast, italiano, mix, kebab/mrga-rollo, sweet), ikona
  404 (sad-pizza), font Persona (.otf/.ttf — licencja personal-use, dafont).
- **`routeTree.gen.ts`** — nie kopiuj, to plik auto-generowany przez
  `@tanstack/router-plugin` przy starcie `vite dev`/`vite build`. Wygeneruje
  się sam z plików w `src/routes/`.
- **`package-lock.json` / `bun.lock`** — nie kopiuj, wygeneruje się przy
  `npm install` / `bun install`.
- **`.env`** — nigdy nie eksportowany (sekrety). Lista **nazw** zmiennych
  (bez wartości) w sekcji 6 — musisz uzupełnić realne wartości sam.
- ~~Migracje danych~~ **JUŻ ZROBIONE** — `supabase/data_export.sql` w tym
  folderze zawiera pełny zrzut danych produkcyjnych (308 wierszy, 48 tabel,
  INSERT z `ON CONFLICT DO NOTHING`, w kolejności topologicznej wg FK, gotowe
  do wgrania PO `schema_combined.sql`). Dwie rzeczy do wiedzy:
  - Kolumny z tokenami (`email_unsubscribe_tokens.token`,
    `friend_invites.token`) zostały pominięte — obie tabele i tak miały 0
    wierszy w momencie eksportu, więc brak realnej straty.
    `site_settings.alpha_gate` (hasło bramki beta) zamienione na
    `__REDACTED__` — ustaw nowe hasło ręcznie po imporcie.
  - E-maile w `collab_submissions` i `email_send_log` zostały wyeksportowane
    jako zwykłe dane biznesowe (nieanonimizowane) — to Twoje dane, ale
    pamiętaj że to PII jeśli gdzieś to repo/zip udostępniasz dalej.
- **`tests/integration/achievements.test.mjs`** — pominięty w tym exporcie,
  drugorzędne.

## 5. Cztery miejsca zależne od pakietów `@lovable.dev/*` — plan zastąpienia

To jest najważniejsza sekcja. Projekt NIE jest w 100% przenośny 1:1 — cztery
rzeczy używają prywatnych pakietów npm Lovable, które nie będą dostępne poza
ich ekosystemem.

### 5.1 `@lovable.dev/cloud-auth-js` — logowanie OAuth (Google/Apple/Microsoft)
Jedyny plik: `src/integrations/lovable/index.ts`. **Dobra wiadomość:** logowanie
e-mail/hasło już idzie przez zwykłego `@supabase/supabase-js`
(`src/integrations/supabase/client.ts`) — to działa bez zmian. Do naprawienia
jest tylko OAuth. Zastąp `lovableAuth.signInWithOAuth(...)` czymś w stylu:
```ts
await supabase.auth.signInWithOAuth({
  provider: "google", // albo "azure" dla Microsoft; Apple wymaga dodatkowej konfiguracji w Supabase Dashboard
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```
Trzeba w nowym projekcie Supabase (Authentication → Providers) włączyć i
skonfigurować dokładnie te same providery OAuth co teraz.

### 5.2 `@lovable.dev/email-js` + `@lovable.dev/webhooks-js` — wysyłka maili
Pliki: `src/routes/lovable/email/**` (auth webhook, transactional send,
queue processor, suppression list), `src/lib/email/enqueue-internal.server.ts`,
cały `src/lib/email-templates/**` (te są OK, to czyste react-email, nie trzeba
ruszać). Kolejka maili w Postgres (`email_send_log`, `email_send_state`,
funkcje `enqueue_email`/`read_email_batch`/`email_queue_dispatch` w schemacie)
już jest niezależna od Lovable — to dobry fundament. Trzeba podmienić tylko
faktyczny transport wysyłki: zamiast wołania do `LOVABLE_SEND_URL` z
`LOVABLE_API_KEY`, podłącz Resend albo Postmark (oba mają proste SDK, Resend
jest zwykle najszybsze do wdrożenia). Webhook Supabase Auth (potwierdzenia
rejestracji, reset hasła) też trzeba przekierować na nowy endpoint.

### 5.3 `@lovable.dev/mcp-js` — Twój endpoint pozeramy.live/mcp
Pliki: `src/routes/mcp.ts`, `src/routes/[.mcp]/**`,
`src/routes/[.well-known]/oauth-protected-resource.ts`, `src/lib/mcp/**`.
To realizuje protokół MCP (Model Context Protocol) ręcznie po HTTP — sam
`mcpPlugin()` w `vite.config.ts` to tylko dev-time wiring. Do zastąpienia:
albo użyj oficjalnego `@modelcontextprotocol/sdk` (biblioteka Anthropic, nie
Lovable) do zbudowania tego samego endpointu, albo — jeśli to niekrytyczne —
tymczasowo wyłącz i dodaj z powrotem później. Logika samych narzędzi
(`get_place`, `list_cuisines`, `search_places` w `src/lib/mcp/tools/`) jest
czystym TS, niezależnym od Lovable — tylko warstwa transportowa (routing HTTP)
wymaga podmiany.

### 5.4 `@lovable.dev/vite-tanstack-config` — sam build
`vite.config.ts` bazuje na presecie Lovable, który cicho konfiguruje:
TanStack Start, React, Tailwind, tsconfig-paths, Nitro (target: cloudflare),
alias `@`, dedupe React/TanStack. Do odtworzenia standardowym Vite configiem:
```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths(), tailwindcss(), tanstackStart({ server: { entry: "server" } }), viteReact()],
});
```
Docelowy hosting (Vercel/Netlify/Cloudflare Pages) określi dokładny target
Nitro — dostosuj wtedy.

## 6. Zmienne środowiskowe (same nazwy, wartości uzupełnij sam)

```
VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY   ← z nowego projektu Supabase
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY  ← jw. (server-side)
INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID          ← social sync (rolki)
FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID       ← social sync
TIKTOK_API_KEY, YOUTUBE_API_KEY                    ← social sync
LOVABLE_API_KEY, LOVABLE_SEND_URL                  ← DO ZASTĄPIENIA kluczem Resend/Postmark (sekcja 5.2)
```

## 7. Model danych — skrót (pełny schemat w EXPORT_SCHEMA_COMBINED.sql)

Kluczowe tabele i po co są:
- `places` — lokale (nazwa, kuchnia, lokalizacja, godziny otwarcia jako JSON,
  ceny, zdjęcia, menu)
- `place_visits` (status: want/visited), `place_favorites`, `reviews`,
  `place_photos` — interakcje usera z lokalem
- `profiles`, `friendships`, `friend_invites`, `friend_lists` — social layer
- `achievements`, `user_achievements`, `points_transactions`, `points_rules`,
  `ranks`, `user_ranks` — system gamifikacji (kryteria odznak w polu
  `achievements.criteria` jako JSON, sprawdzane funkcją `check_achievements()`)
- `place_owners`, `owner_requests` — konta właścicieli restauracji
- `ads`, `ad_events` — banery reklamowe z trackingiem
- `notifications` — powiadomienia in-app
- `blog_posts`, `blog_comments` — blog
- `collab_submissions`, `collab_replies` — formularz współpracy dla marek
- `social_accounts` — cache statystyk kont social media
- `email_send_log`, `email_send_state`, `suppressed_emails`,
  `email_unsubscribe_tokens` — infrastruktura mailowa (kolejka + suppression)
- `food_challenges`, `food_challenge_completions` — wyzwania jedzeniowe
  (funkcja zbudowana, ale wg wcześniejszych ustaleń niepełna feature-wise —
  sprawdź czy UI istnieje w EXPORT_ROUTES.txt/EXPORT_COMPONENTS.txt)

Ciekawe funkcje Postgresowe (logika biznesowa w bazie, nie w JS):
`check_achievements(user_id)`, `award_points(...)`, `friend_leaderboard(user)`,
`friend_activity_feed(user)`, `place_rating_breakdown(place_id)`,
`accept_friend_invite(token)`, `search_users(query)`, `slugify(input)`.

## 8. Znane usterki/wzorce do zachowania (z doświadczenia zespołu)

- **Panel admina** (`/admin/places`): przycisk "Zapisz" może cicho nic nie
  robić gdy brakuje wymaganych pól (brak errora, brak network requesta).
- Godziny otwarcia (`places.opening_hours` jako JSON) mają realną logikę
  parsowania względem dnia tygodnia i strefy czasowej — obsługuje lokale
  otwarte po północy. Zobacz `src/lib/places-api.ts` w EXPORT_LIB.txt.
- Zdjęcia lokali migrowane z hotlinków IG/FB do Supabase Storage (bucket
  `place-photos`, prywatny — podpisane URL na 10 lat) — logika w
  `src/lib/place-image-migration.ts` + `.functions.ts` — wzoruj się na tym
  wzorcu przy każdej nowej funkcji importującej obrazy z zewnątrz.
- Feed "Ostatnia aktywność" na profilu (`src/lib/activity-feed-api.ts`) to
  computed UNION po `place_visits`/`place_favorites`/`reviews` — świadomie
  bez osobnej tabeli/triggerów, prostsze i wystarczające przy obecnej skali.
- Wyszukiwanie w Odkrywaj ma własny lekki Levenshtein fallback (bez
  zewnętrznej biblioteki) — `src/lib/place-search.ts`.
- Bezpieczeństwo dotyku: klasy `.pz-tap` / `.pz-hit` w styles.css wymuszają
  min. 44×44px hit-area na elementach klikalnych (WCAG 2.5.5) — używaj ich
  konsekwentnie przy nowym UI zamiast pomijać.
- Animacje nawigacji mobile: `document.startViewTransition` przez
  `defaultViewTransition: true` w `router.tsx`, gated do `max-width: 1023px`
  w CSS — nie dodawaj ciężkich bibliotek animacyjnych (framer-motion) bez
  potrzeby, natywne API wystarcza.

## 9. Sugerowana kolejność pracy w Claude Code

1. `npx create-tanstack-app` albo ręczny scaffold Vite + TanStack Start, wklej
   `package.json` z tego folderu (usuń 4 pakiety `@lovable.dev/*`, dodaj
   zamienniki: `@tanstack/react-start/plugin/vite` bezpośrednio, `resend`
   albo `@postmarkapp/postmark`, `@modelcontextprotocol/sdk` jeśli MCP wraca)
2. Rozbij `EXPORT_LIB.txt`, `EXPORT_ROUTES.txt`, `EXPORT_COMPONENTS.txt` na
   prawdziwe pliki (skrypt z sekcji 3)
3. `npx shadcn@latest init` + `add` (lista w sekcji 4) zamiast kopiowania ui/
4. Załóż nowy projekt na supabase.com, wklej `EXPORT_SCHEMA_COMBINED.sql`
   jako migrację startową (`supabase db push` albo ręcznie w SQL editorze)
5. `supabase gen types typescript` żeby odświeżyć `types.ts` z pełnymi
   Insert/Update (ten w exporcie ma je uproszczone)
6. Podmień 4 punkty z sekcji 5 (OAuth, email, MCP, vite config)
7. Uzupełnij zmienne środowiskowe (sekcja 6)
8. Odtwórz/zamów brandowe obrazy (sekcja 4)
9. `bun install && bun run dev` (albo npm), napraw błędy importów jeden po
   drugim — większość będzie dotyczyć brakujących assetów i typów
9a. Przy odtwarzaniu/redesignie UI: trzymaj się mockupu KV (sekcja 1a) jako
    źródła prawdy dla stylu, ale pytaj Mateusza o konkretne rozwiązania tam,
    gdzie KV nie rozstrzyga (np. dokładny układ desktopowy, drobne
    interakcje) — nie kopiuj automatycznie wcześniejszych wyborów z wersji
    Lovable, patrz sekcja 0
10. Zaimportuj `supabase/data_export.sql` (już wyeksportowany, patrz sekcja
    4) do nowego projektu — po `schema_combined.sql`, dopiero gdy kod już
    działa
11. Domena: dopiero po weryfikacji że wszystko działa na nowym hostingu,
    przepnij DNS pozeramy.live (sprawdź w Lovable Project Settings → Domains
    czy jest opcja transferu rejestracji, albo czy to tylko DNS)
