# Handoff: Pożeramy Mobile App Prototype

## Overview
Interactive mobile prototype for Pożeramy, a restaurant-discovery app with social/gamification features (badges, XP, friend rankings). Covers 6 screens: Discover, Map, Restaurant Profile, User Profile, My Places, Achievements.

## About the Design Files
The files in this bundle are **design references built in HTML/React** (a "Design Component" runtime specific to this design tool) — they show intended layout, styling and interaction, not production code to copy verbatim. The task is to **recreate these designs in the target codebase's real environment** (iOS/Android native, React Native, Flutter, etc. — whichever the app already uses) using its own component patterns, navigation stack, and data layer. If no mobile stack exists yet, pick the framework best suited to the target platforms and implement there.

## Fidelity
**High-fidelity.** Colors, type, spacing and copy (in Polish) are final-direction; all restaurant names, review text, and stats are **placeholder content** and should be replaced with real data from the backend.

## Files
- `Pozeramy App.dc.html` — main prototype: all 6 screens, state, and interaction logic (in the `class Component extends DCLogic { ... }` block — read `renderVals()` for the full data/derived-state model, e.g. how favorite/visited/want toggles are stored and merged with base data).
- `PozeramyTabBar.dc.html` — the bottom tab bar component (5 items: Odkrywaj, Mapa, add-action, Moje miejsca, Profil), with active/inactive icon color logic.
- `ios-frame.jsx` — iPhone bezel/status-bar chrome used only for the prototype presentation; **not part of the app itself**, ignore for implementation.

Open `Pozeramy App.dc.html` in a browser to view/interact with the live prototype (double-click or serve statically).

## Design Tokens

**Colors**
- Navy (primary / headings / dark surfaces): `#23255E`
- Navy soft (secondary dark accent): `#3B3D7A`
- Pink background (profile/achievements header): `#F0B6B4`
- Pink deep (accent, favorite badge, avatar): `#E8807E`
- Orange (primary CTA, active states, add button, level badge): `#E2572A`
- Cream background (app base): `#F7F1E3`
- Card white: `#FFFDF8`
- Placeholder pattern stripes: `#E7DEC7` / `#F1EADA`
- Gold accent (badges/rank #1): `oklch(78% 0.1 85)`
- Teal accent (badges): `oklch(66% 0.09 190)`
- Violet accent (badges/avatars): `oklch(66% 0.1 300)`
- Muted text: `rgba(35,37,94,0.45–0.6)`
- Success/open status: `#3C8A5A` · Closed status: `#B23A3A`

**Typography**
- Display / headings / logo: **Baloo 2** (weights 600–800), Google Fonts
- Body / UI text: **Manrope** (weights 400–800), Google Fonts
- Minimum text size: 10px (captions), body copy 12–13px, section headers 15–16px, screen titles 18–22px

**Shape language**
- Cards / rows: 12–16px border radius
- Avatars: circles, monogram initials, white 2–3px ring border
- Achievement badges: **hexagon** (`clip-path: polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)`) — distinct from restaurant/avatar circles, with a gold "sparkle" diamond accent when unlocked and a lock glyph when locked
- Decorative header blobs: organic asymmetric border-radius shapes, low z-index, kept clear of icons/text
- Map pins & favorite hearts: pin = rotated square with one square corner rounded (`border-radius:50% 50% 50% 0`); heart = two circles + a rotated square (kept visually distinct from the pin shape)

## Screens

### 1. Odkrywaj (Discover)
- Navy header, rounded search bar, horizontal category chips (circular monogram icons), horizontal "Polecane dla Ciebie" recommendation cards (image placeholder + heart-toggle + name/category/price/rating), vertical "Nowo otwarte" list rows.
- Tapping any restaurant card/row opens Restaurant Profile.

### 2. Mapa (Map)
- Filter chip row (Filtry / Kuchnia / Ocena / Otwarte teraz — visual only in the prototype).
- Map placeholder with scattered pin markers (colored per restaurant) and a "locate me" floating button.
- Bottom peek card previews one nearby restaurant; tapping opens its Profile.

### 3. Profil restauracji (Restaurant Profile)
- Full-screen overlay (back/share/more controls over hero image placeholder).
- Name + monogram avatar, category/price, rating + review count, address, open/closed status (color-coded).
- Three toggle buttons: **Chcę odwiedzić** (want to visit) / **Byłem tutaj** (visited) / **Ulubione** (favorite) — each independently toggleable, filled when active.
- Photo strip (placeholders) and reviews list (avatar, star rating, text, timestamp).

### 4. Profil użytkownika (User Profile)
- Pink header with avatar, name, handle, level pill + XP progress bar.
- Stat row: Odwiedzone / Do odwiedzenia / Ulubione counts.
- Badge preview (top 4 unlocked achievements) with a link to the full Achievements screen.
- Recent activity feed (avatar + action text + relative time).

### 5. Moje miejsca (My Places)
- Segmented filter: Do odwiedzenia / Odwiedzone / Ulubione / Znajomi.
- First three filters show the restaurant list filtered by the matching toggle state (want/visited/favorite).
- **Znajomi (Friends)** filter shows a friends list: avatar with initials, medal-colored rank badge (gold/silver/bronze-style colors for top 3) overlapping the avatar, name, and saved-places count.
- Empty state message when a filter has no results.

### 6. Osiągnięcia (Achievements)
- Reached via "Zobacz wszystkie" from the Profile badges section (back button returns to Profile).
- Progress card: level, XP bar.
- Full badge grid (hexagon medals): unlocked badges show colored fill + sparkle + monogram; locked badges show a muted hexagon with a lock glyph instead of letters.
- Ranking znajomych: same friends-list treatment as the Moje miejsca → Znajomi tab (avatar + rank medal + name + visited count).

## Interactions & State
- **Tab navigation**: 4 primary tabs (Discover/Map/Places/Profile) plus a center "add" button that opens a bottom sheet (Dodaj opinię / Dodaj miejsce / Zrób zdjęcie — placeholder actions, dismiss via backdrop tap).
- **Detail overlay**: opening a restaurant sets a `detailId`; closing returns to whichever tab was active underneath (overlay, not a tab).
- **Achievements overlay**: boolean flag independent of tabs, opened from Profile.
- **Per-restaurant toggle state** (want/visited/favorite): stored as overrides merged over seed data, so toggling in the Detail screen updates My Places filtering live.
- No animated transitions between screens in the prototype — implement standard platform navigation transitions (push/modal presentation) in the real app.

## Assets
No real photography — all images are diagonal-stripe placeholder blocks labeled "zdjęcie ..." (Polish for "photo of ..."). Replace with real restaurant/menu photography and user avatars. Brand wordmark/logo files were supplied separately by the user (not embedded in these HTML files) — use those source logo assets for the real app's header/splash.

## Language
All copy is in Polish and should be kept verbatim or translated by a native speaker for any additional locales — no auto-translation.
