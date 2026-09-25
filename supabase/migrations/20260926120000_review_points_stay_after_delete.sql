-- Decyzja Mateusza: punkty za recenzje maja ZOSTAWAC po jej usunieciu.
--
-- Dotad dzialalo to tak, ze trigger reviews_reverse_after_delete cofal cala
-- pule przy kasowaniu. Efekt w praktyce: konto sasu ma 22 transakcje w ksiedze
-- sumujace sie do ZERA, bo kazdy test konczyl sie usunieciem recenzji. Z
-- perspektywy uzytkownika wygladalo to jak "punkty sie nie naliczaja".
--
-- Samo zdjecie cofania otworzyloby z powrotem farmienie (dodaj -> +30 -> usun
-- -> powtorz), przed ktorym bronila migracja 20260819130000. Dlatego nagroda
-- staje sie JEDNORAZOWA NA LOKAL, a nie jednorazowa na recenzje: raz zdobyta,
-- zostaje na zawsze, ale drugi raz za ten sam lokal juz nie padnie - niezaleznie
-- od tego, ile razy recenzja zostanie usunieta i dodana.

CREATE TABLE IF NOT EXISTS public.review_points_claims (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id, event_key)
);

COMMENT ON TABLE public.review_points_claims IS
  'Slad po juz przyznanej nagrodzie za recenzje danego lokalu. Nie kasuje sie razem z recenzja - to on sprawia, ze punkty zostaja, a mimo to nie da sie ich zdobyc po raz drugi.';

ALTER TABLE public.review_points_claims ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.review_points_claims TO authenticated;

-- Tylko odczyt wlasnych wierszy. Zapisuje wylacznie trigger (SECURITY DEFINER,
-- omija RLS), wiec klient nie moze sobie "odblokowac" ponownej nagrody
-- kasujac wpis.
DROP POLICY IF EXISTS "review_points_claims read own" ON public.review_points_claims;
CREATE POLICY "review_points_claims read own" ON public.review_points_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Przyznaje nagrode tylko wtedy, gdy dla tej pary (uzytkownik, lokal, rodzaj)
-- jeszcze jej nie bylo. PRIMARY KEY zalatwia wyscig rownoleglych zadan: drugie
-- odbije sie o konflikt i nic nie przyzna.
CREATE OR REPLACE FUNCTION public.award_review_points_once(
  _user_id uuid, _place_id uuid, _event_key text, _review_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.review_points_claims (user_id, place_id, event_key)
  VALUES (_user_id, _place_id, _event_key)
  ON CONFLICT DO NOTHING;

  -- FOUND = false, gdy wiersz juz istnial (ON CONFLICT DO NOTHING nie ruszyl
  -- zadnego wiersza) - czyli nagroda byla juz kiedys przyznana.
  IF FOUND THEN
    PERFORM public.award_points(_user_id, _event_key, 'review', _review_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.award_review_points_once(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reviews_award_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.award_review_points_once(NEW.user_id, NEW.place_id, 'review_created', NEW.id);

  IF NEW.photo_url IS NOT NULL AND NEW.photo_url <> '' THEN
    PERFORM public.award_review_points_once(NEW.user_id, NEW.place_id, 'review_with_photo', NEW.id);
  END IF;

  -- "Pierwsza wizyta" nie potrzebuje juz liczenia recenzji: pierwszy wpis w
  -- review_points_claims dla tego lokalu JEST definicja pierwszego razu.
  PERFORM public.award_review_points_once(NEW.user_id, NEW.place_id, 'first_visit_new_place', NEW.id);

  PERFORM public.check_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Zdjecie cofania. Funkcja zostaje w bazie (nieuzywana), zeby nie zerwac
-- niczego, co moze sie do niej odwolywac - liczy sie brak triggera.
DROP TRIGGER IF EXISTS reviews_reverse_after_delete ON public.reviews;

COMMENT ON FUNCTION public.reviews_reverse_on_delete() IS
  'NIEUZYWANE od 20260926120000: punkty za recenzje zostaja po jej usunieciu, a przed farmieniem broni review_points_claims.';

-- Slady po nagrodach przyznanych PRZED ta migracja. Bez tego uzytkownik, ktory
-- kiedys dostal i stracil punkty za lokal, dostalby je teraz ponownie przy
-- kolejnej recenzji tego samego miejsca - czyli dokladnie farmienie, ktore
-- chcemy wykluczyc. Miejsce pobrania: ksiega punktow + wciaz istniejace
-- recenzje (ref_id wskazuje na recenzje, a ta zna swoj lokal).
INSERT INTO public.review_points_claims (user_id, place_id, event_key, created_at)
SELECT pt.user_id, r.place_id, pt.event_key, min(pt.created_at)
FROM public.points_transactions pt
JOIN public.reviews r ON r.id = pt.ref_id
WHERE pt.ref_type = 'review'
  AND pt.points > 0
  AND pt.event_key IN ('review_created', 'review_with_photo', 'first_visit_new_place')
GROUP BY pt.user_id, r.place_id, pt.event_key
ON CONFLICT DO NOTHING;
