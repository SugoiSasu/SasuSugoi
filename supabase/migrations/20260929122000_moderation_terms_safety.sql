-- Wzorzec, ktory blokuje zwykle slowa, zablokowalby cala Pozeralnie. Przy
-- dodawaniu / zmianie wzorca "blokujacego" sprawdzamy go na zestawie
-- codziennych slow z recenzji - jesli cokolwiek z nich lapie, wzorzec wchodzi
-- do bazy tylko z bledem.
CREATE OR REPLACE FUNCTION public.moderation_terms_validate() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_probka constant text :=
  'dzien dobry dziekuje prosze smacznego polecam pizza pierogi makaron zupa burger kebab ramen sushi kawa ciasto obsluga bardzo dobre jedzenie swietne miejsce wrocimy na pewno cena jakosc porcja szybko mila pani kelner stolik rezerwacja';
BEGIN
  BEGIN
    PERFORM '' ~ NEW.pattern;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Niepoprawny wzorzec: %', NEW.pattern;
  END;
  IF NEW.kind = 'block' AND v_probka ~ NEW.pattern THEN
    RAISE EXCEPTION 'Ten wzorzec blokuje zwykłe słowa (np. z recenzji): %', NEW.pattern;
  END IF;
  RETURN NEW;
END $$;
