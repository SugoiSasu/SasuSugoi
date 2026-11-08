# Redesign poŻeramy - ustalenia (2026-11-08)

Decyzje Mateusza po badaniu rynku (Beli, Dither/Munch, Swarm, Google Maps, Wolt/Pyszne; wzorce Duolingo/Strava/Spotify).

## Decyzje
- **Wygląd:** zostaje terrazzo (granat, pomidorowy, konfetti), ale uporządkowane: mniej wariantów kart, jedna skala napisów (min 11 px), więcej oddechu.
- **Rdzeń:** odkrywanie - ekran główny "Co dziś jemy?" + swipe (Karty) jako główne narzędzie decyzji.
- **Nawigacja mobilna:** 5 zakładek bez przycisku "+": Odkrywaj, Mapa, Karty, Znajomi, Profil. "Dodaj" w kontekście (na lokalu, w feedzie).
- **Zakres:** najpierw system, potem ekrany po kolei; po każdym etapie wdrożenie i akceptacja.
- **Ekran główny (wybór Claude'a, na prośbę "wybierz najlepsze"):** przycisk "Wylosuj mi obiad", filtry intencji (głodny / randka / szybko / z ekipą), pas "Znajomi byli tu"; nowe i wyróżnione lokale (trofea, Warte poŻarcia) niżej.
- **Nowe funkcje:** Taste Profile + Match Score ze znajomymi, Wspólne wyjście (decyzja w grupie), szybki check-in "Byłem tu" (ocena 3-stopniowa: super / ok / nie), podsumowanie roku (Wrapped).
- **Gamifikacja:** zostaje, ale cichsza (mniej plakietek w kluczowych ekranach; poziomy/odznaki/wyzwania na profilu i w Osiągnięciach).
- **Karta lokalu na listach:** duże zdjęcie + logo w kółku (rozwiązuje rozmazane/rozciągnięte logo).

## Etapy
1. **System:** tokeny (napisy, odstępy, promienie), wspólny `PlaceLogo`, spójne chipy/przyciski/karty. 
2. Strona główna "Co dziś jemy?" + karta lokalu (`/k/...`).
3. Karty (swipe) + Mapa + Wspólne wyjście.
4. Społeczność: Pożeralnia, Znajomi, Taste Profile / Match Score.
5. Profil, Osiągnięcia, Moje miejsca, check-in, Wrapped, nawigacja 5 zakładek.

## Zasady z badania
- Nie wymuszać żmudnych akcji (Beli: obowiązkowe porównania par irytują). Ocena maks. 3 dotknięcia.
- Nie wymagać kontaktów do rejestracji. Pokazywać wartość przed zapisem.
- Ikony z podpisami tam, gdzie akcja nie jest oczywista.
- Swipe ma kończyć się decyzją (wspólne wyjście), nie tylko lajkiem.

## Etap 1 - system (wdrożone 2026-11-08)
- `PlaceLogo` (src/components/PlaceLogo.tsx): jedno logo lokalu w kółku; małe pliki w naturalnym rozmiarze, ciemny motyw z poświatą, brak logo = emoji kuchni; `tryb="lekki"` do długich list. Wdrożone na liście mapy; kolejne miejsca (karta główna, Karty, Moje miejsca) w etapach 2-3.
- Skala napisów: min 10 px (11 px dla tekstu czytanego), pilnuje tego `src/lib/min-font-size.test.ts` (wyjątki: cyfry w okrągłych plakietkach).

## Etap 2 - strona główna i karta lokalu (wdrożone 2026-11-08)
Nowa karta (hero z kolorem kuchni/okładką + logo w kółku wsunięte w róg, nazwa obok logo), jasne logo na ciemnym kółku, "Wylosuj mi obiad" wyżej na telefonie. Nie zrobione (wymagają danych): filtry intencji randka/szybko/z ekipą (tagi lokali), pas "Znajomi byli tu".

## Etap 3 - Karty, Mapa, Wspólne wyjście (wdrożone 2026-11-08)
- Karty i Mapa: logo małej rozdzielczości w naturalnym rozmiarze; wybrany lokal na mapie z `PlaceLogo`.
- **Wspólne wyjście:** migracja `20261108130000` (outing_sessions/members/votes + create_outing, outing_get, outing_vote, outing_results, outing_close, outing_friends). Host wybiera do 5 znajomych (tylko zaakceptowani, z kontem logowania) i talię 2-8 lokali z filtrów Kart; sesja 24 h; wynik (liczby "tak") widoczny dopiero po oddaniu własnych głosów albo po zamknięciu; wygrywa najwięcej "tak", remis = wszystkie. UI: arkusz w Kartach + `/wyjscie/$id`. Zapisy tylko przez funkcje SECURITY DEFINER; test na bazie w transakcji z rollbackiem + kontrole anon w `scripts/smoke-anon.mjs`.

## Etap 4 - społeczność (wdrożone 2026-11-08)
- Pożeralnia: kompaktowe karty pojedynczej odznaki i "chce odwiedzić" (cichsza gamifikacja).
- **Taste Profile + Match Score:** migracja `20261108140000` (taste_profile, taste_match; funkcje pomocnicze wewnętrzne). Wagi kuchni: ulubione z profilu +3, wizyta "byłem" +2 / "chcę" +1, ulubione +2, ocena >=4 +2 / <=2 -1. Zgodność = 60% kosinus kuchni + 30% Jaccard miejsc + 10% zgodność ocen; < 3 sygnały po którejkolwiek stronie = "za_malo_danych". Widoczne tylko dla właściciela i zaakceptowanych znajomych. UI: karta "Gust" na profilu, plakietka i arkusz zgodności przy znajomych (`TasteComponents.tsx`, `taste-api.ts`).
