# Status: nie jest kierunkiem wizualnym tej appki

Ten folder to alternatywny prototyp (Baloo 2, hexagonowe odznaki, ikony-
kategorii jako monogramy) dostarczony przez Mateusza 2026-08-17. Po
przejściu przez różnice punkt po punkcie z Mateuszem, **stary kierunek KV
(opisany w PROJECT_BRIEF.md sekcja 1a) wygrał na każdym z rozstrzygniętych
punktów**:

- Font UI: Bricolage Grotesque (nie Baloo 2)
- Font tytułów restauracji: Persona, tylko tam jako ozdobnik (już tak
  zaimplementowane — potwierdzone, nie zmieniać)
- Kształt odznak: koła + emoji (nie hexagony + inicjały)
- Ikony kategorii: kwadraty + emoji (nie koła + inicjały)
- "Znajomi": osobna pozycja w nawigacji (nie zakładka w Moje miejsca)

**Co jest tu mimo to przydatne:** precyzyjny model stanu i logika
interakcji w `Pozeramy App.dc.html` (`class Component extends DCLogic`,
metoda `renderVals()`) — np. dokładny mechanizm trzech niezależnie
przełączalnych flag (`want`/`visited`/`favorite`) na profilu restauracji,
merge'owanych jako overrides nad danymi bazowymi. Warto to sprawdzić przy
budowie realnej logiki tych przycisków, niezależnie od tego że warstwa
wizualna (kolory, fonty, kształty) nie jest tu używana.
