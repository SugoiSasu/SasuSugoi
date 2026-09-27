-- Wspolrzedne 36 lokali stojacych na domyslnym punkcie 52.4082, 16.9335.
--
-- Formularz nowego lokalu w adminie wpisuje domyslnie ten punkt (centrum
-- Poznania), a jedynym sposobem na prawdziwe polozenie bylo reczne wpisanie
-- liczb w pola lat/lng. Nikt tego nie robil, wiec 36 lokali (35 szkicow i
-- opublikowana Lontra Pizza & Bar) stalo w jednej pinezce na Starym Rynku.
--
-- Wspolrzedne z geokodowania adresow przez Nominatim (OpenStreetMap - z tych
-- samych danych jest mapa w apce). 35 DOKLADNYCH (zgadza sie ulica i numer
-- domu, punkt w Poznaniu), 1 PRZYBLIZONY (Pansa Piena: pawilon na placu
-- Wielkopolskim bez numeru w OSM - srodek placu).
--
-- Trigger places_guard_owner_columns cofa po cichu kazda zmiane lat/lng
-- spoza sesji admina, takze z klucza serwisowego. Wylaczony na czas tej
-- jednej transakcji - zabezpieczenie zostaje nienaruszone.
--
-- Warunek na domyslny punkt w kazdym UPDATE: nie nadpisujemy lokalu, ktory
-- ktos w miedzyczasie poprawil recznie.

ALTER TABLE public.places DISABLE TRIGGER places_guard_owner_columns;

-- DRAM: Cocktail Bar & Restaurant | Stary Rynek 92, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4090603, lng = 16.9339732
  WHERE id = 'dffc3e94-baa0-479c-bddf-dfdfc985cc0d' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Mozaika Lounge | ul. Wrocławska 14, 61-838 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4064207, lng = 16.9327105
  WHERE id = 'ca554f7e-63da-43c1-9f2a-b312d2859219' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Miskuzi | ul. Ratajczaka 34, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4061588, lng = 16.925326
  WHERE id = '18c4a784-0a43-4574-bceb-2a18e61eeb0f' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- FIKA | ul. Różana 9a, 61-577 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3971023, lng = 16.9243286
  WHERE id = 'aee8d218-c403-4c8e-b89e-486bf69db41d' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Prościutko Pizza | ul. Dobrzyckiego 1, 61-692 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4382014, lng = 16.9139638
  WHERE id = 'bf89e112-aac5-4cc5-a4db-7c84359ba8a4' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Wypas | ul. Jackowskiego 38/1, 60-512 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4098565, lng = 16.8970448
  WHERE id = '57299f3a-e6a2-4514-a67a-121a49c05a4f' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- K-BOB | ul. Żydowska 26, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4104974, lng = 16.9356315
  WHERE id = '517547ba-df7f-452e-a1a6-657b4c20095e' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Restauracja Panorama (Hotel HP Park) | ul. abpa A. Baraniaka 77, 61-131 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3999656, lng = 16.9721072
  WHERE id = 'e9b25ce1-3742-4e8c-98af-9a0ad73ff2d3' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- START.WSCHÓD | ul. Górna Wilda 74, 61-564 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3975877, lng = 16.9248166
  WHERE id = 'b1c63a56-7d50-426a-87ed-17c5a5796f73' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Tureckie Smaki | ul. Święty Marcin 25, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4058156, lng = 16.9264471
  WHERE id = 'b453a03c-93df-4ae6-b290-ec8b7cce20ac' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Oseyo25 | ul. Szewska 2, 61-760 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4092292, lng = 16.9361988
  WHERE id = '5811ee61-e598-4292-a4a7-f9872bb3b221' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Phożar | ul. Marcelińska 27, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4059224, lng = 16.8898723
  WHERE id = 'ff589f33-e020-49f5-8524-c13ffb1b7731' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Hatti | ul. Głogowska 86/4, 60-262 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3939229, lng = 16.8980511
  WHERE id = 'b840e9d1-4dda-44cd-80f5-ffd3eea1f4d3' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Taczaka20 | ul. Taczaka 20, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4055569, lng = 16.9233413
  WHERE id = 'c0cbcbbf-7ad6-4929-8cfb-da19095c9dbf' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Marietta Focacceria | ul. Ratajczaka 35, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4073878, lng = 16.9250202
  WHERE id = '0223df41-dcd1-4085-afc0-4071c8082c4a' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- TÖP Modern Turkish Kebap | ul. Górna Wilda 79, 61-563 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3965909, lng = 16.9249004
  WHERE id = 'e6539e16-2d27-4e35-9c79-ec33a09d83ed' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- 109 Za Rogiem | ul. Ściegiennego 109 (wejście od ul. Listopadowej), 60-147 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3936147, lng = 16.8687522
  WHERE id = '2c9eb9e4-5a64-427c-87a3-c4f8cd787e69' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- La Niña | ul. Kościelna 4, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4131282, lng = 16.903983
  WHERE id = 'd5b39c15-e857-4fc4-8543-7fb895c42705' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Kim Chi Ken | ul. Kraszewskiego 14, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4104206, lng = 16.9030377
  WHERE id = 'a76f744f-e1b5-49ca-a105-dbb74a527298' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Oldskulowa Cafe & Restaurant | ul. Aleksandra Fredry 2, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.408523, lng = 16.9209705
  WHERE id = 'ae242062-90b2-44db-b624-d203b4dec35c' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- El Patio | ul. Święty Marcin 28, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4063977, lng = 16.9267987
  WHERE id = '4145ef01-2c83-4be8-9989-e04907b7371d' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- DeliCafé | ul. Szczepankowo 92/1, 61-306 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3617828, lng = 17.0149177
  WHERE id = 'f2564ea0-00f2-4f39-8e69-03c6ab899876' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Dragon Hill | ul. Adama Mickiewicza 20, 60-834 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4112564, lng = 16.911638
  WHERE id = '50eda653-687b-44f9-a986-5641efab136d' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Shawarma from Odessa | ul. Św. Rocha 8, 61-142 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3990332, lng = 16.9496346
  WHERE id = '0553d453-b395-4d44-850c-9b6cf656c01e' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- JEMRAMEN&chicken | ul. Kościelna 48, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4165122, lng = 16.9068107
  WHERE id = 'feeec0d7-1e28-4139-8e7a-70c4976f325f' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Tętno Cafe | ul. Półwiejska 20, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4029919, lng = 16.9296185
  WHERE id = '07b2e863-294b-4a4e-a4a1-a017eb9df958' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Przyjemność | ul. Górna Wilda 82/84, 61-564 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3969186, lng = 16.9245411
  WHERE id = '6d738cde-18f8-4c67-8fcf-b5be5c3f762a' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Turecka-Szama | ul. Głogowska 99A, 60-738 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3921678, lng = 16.8969503
  WHERE id = '94df8303-2fe4-44e0-bfbd-ab5f28181931' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Turkish Kebab (Halal) | ul. Święty Marcin 45, 61-714 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4064047, lng = 16.9236556
  WHERE id = 'd1cd83c8-f708-4d4d-8a98-fce13bb7e641' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- U Marudy | ul. Zamenhofa 133 (Pasaż Rondo, I piętro), 61-131 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.3823323, lng = 16.9460837
  WHERE id = '5bf50d17-e85d-4f11-b034-d4aebf1ee809' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Pianta Pizza e Pasta | ul. Jana Henryka Dąbrowskiego 5, 60-838 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4109523, lng = 16.9125219
  WHERE id = '4edabfad-a878-4d96-9139-68d650b6d41a' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Pansa Piena | pawilon nr 8, plac Wielkopolski, 60-101 Poznań | PRZYBLIZONY
UPDATE public.places SET lat = 52.4105481, lng = 16.9312903
  WHERE id = 'fedbc967-99e4-4bef-8213-5475b3973614' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Winogratka | ul. Przełajowa 14, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4272212, lng = 16.9472387
  WHERE id = 'cca86e75-3815-4f28-92a8-28bfd3df62eb' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Kuchi Sabishii | ul. Kantaka 10, Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4076543, lng = 16.9228446
  WHERE id = 'e04b991a-337d-4688-a308-ad3c18358d37' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Pastrami Summer Barbecue | ul. Święty Marcin 28, 61-805 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4063977, lng = 16.9267987
  WHERE id = '0df990b9-1d68-45ba-93a1-e38aa38107d3' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

-- Lontra Pizza & Bar | ul. 27 Grudnia 21, 61-737 Poznań | DOKLADNY
UPDATE public.places SET lat = 52.4079205, lng = 16.9219203
  WHERE id = '955235ca-a31a-4c7a-8e58-cf75d3171464' AND round(lat::numeric, 4) = 52.4082 AND round(lng::numeric, 4) = 16.9335;

ALTER TABLE public.places ENABLE TRIGGER places_guard_owner_columns;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Wspolrzedne 36 lokali z domyslnego punktu na prawdziwe (geokodowanie adresow, OpenStreetMap).');
