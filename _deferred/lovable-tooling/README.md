# Martwe endpointy Lovable dashboardu

`auth/preview.ts` i `transactional/preview.ts` renderowały podgląd szablonów
maili wyłącznie na potrzeby Go-backendu Lovable (zabezpieczone przez
`LOVABLE_API_KEY`, nikt inny ich nie wołał — sprawdzone grepem po całym
`src/`). Bez Lovable Cloud te endpointy są martwe. Nie wymagają naprawy do
działania aplikacji — jeśli kiedyś przyda się własny podgląd szablonów
(np. do panelu admina), można je odtworzyć stąd, podmieniając autoryzację
`LOVABLE_API_KEY` na coś własnego (np. sesję admina).
