-- Moderacja tresci (priorytet Mateusza 2026-09-29).
--
-- Decyzje:
--  - filtr wulgaryzmow / wrazliwych tresci: BLOKADA przed publikacja (autor
--    dostaje komunikat, nic nie trafia na Pozeralnie); egzekwowane w bazie
--    triggerami, wiec nie da sie obejsc przez API,
--  - kary: ostrzezenie -> ban czasowy (1/7/30 dni) -> staly; ban = nie mozna
--    pisac (wpisy, komentarze, recenzje), ale mozna przegladac apke,
--  - zgloszenia od spolecznosci + kolejka w panelu Moderacji,
--  - moderuja wszyscy admini; bany stale i ich cofanie - tylko super admin.
--
-- Lista slow jest w tabeli (moderation_terms), edytowalna z panelu bez
-- wdrozenia. Dopasowanie po normalizacji: male litery, bez polskich znakow,
-- "leet" (k4rw4), znaki w srodku slowa (k.u.r.w.a), rozstrzelone litery
-- (k u r w a), przeciagniete litery (kurwaaa).

-- ── 1. Slowa ───────────────────────────────────────────────────────────────
CREATE TABLE public.moderation_terms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pattern text NOT NULL,                       -- regex na znormalizowanym tekscie
  kind text NOT NULL CHECK (kind IN ('block', 'allow')),
  note text,                                   -- powod pokazywany w logu
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moderation_terms admin all" ON public.moderation_terms
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_terms TO authenticated;

-- Zly regex nie moze wejsc do bazy: kazdy wpis sprawdzalby sie potem z bledem.
CREATE FUNCTION public.moderation_terms_validate() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM '' ~ NEW.pattern;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Niepoprawny wzorzec: %', NEW.pattern;
  END;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_terms_validate BEFORE INSERT OR UPDATE OF pattern ON public.moderation_terms
  FOR EACH ROW EXECUTE FUNCTION public.moderation_terms_validate();

INSERT INTO public.moderation_terms (pattern, kind, note) VALUES
  ('kurw',                              'block', 'wulgaryzm'),
  ('huj',                               'block', 'wulgaryzm'),
  ('pizd',                              'block', 'wulgaryzm'),
  ('pierd(o|a)l',                       'block', 'wulgaryzm'),
  ('jeb',                               'block', 'wulgaryzm'),
  ('\ykutas',                           'block', 'wulgaryzm'),
  ('\ycip(a|y|ie|ke|ka|ko|ki)\y',       'block', 'wulgaryzm'),
  ('\yciul',                            'block', 'wulgaryzm'),
  ('\ysukinsyn',                        'block', 'wulgaryzm'),
  ('\ycwel',                            'block', 'wulgaryzm'),
  ('\yf+u+c+k',                         'block', 'wulgaryzm (ang.)'),
  ('\yfck\y',                           'block', 'wulgaryzm (ang.)'),
  ('\yshit',                            'block', 'wulgaryzm (ang.)'),
  ('\ybitch',                           'block', 'wulgaryzm (ang.)'),
  ('\ycunt\y',                          'block', 'wulgaryzm (ang.)'),
  ('\yasshole',                         'block', 'wulgaryzm (ang.)'),
  ('czarnuch',                          'block', 'mowa nienawisci'),
  ('nigg(er|a)',                        'block', 'mowa nienawisci'),
  ('\yciapat',                          'block', 'mowa nienawisci'),
  ('\yciot(a|y|e|o)\y',                 'block', 'mowa nienawisci'),
  ('heil\s+hitler',                     'block', 'mowa nienawisci'),
  ('sieg\s+heil',                       'block', 'mowa nienawisci'),
  ('zabij(e|emy)\s+(cie|was)',          'block', 'grozba'),
  ('zabij\s+sie',                       'block', 'grozba'),
  ('\ykys\y',                           'block', 'grozba'),
  ('mefedron',                          'block', 'narkotyki'),
  ('amfetamin',                         'block', 'narkotyki'),
  ('kokain',                            'block', 'narkotyki'),
  ('heroin',                            'block', 'narkotyki'),
  ('marihuan',                          'block', 'narkotyki'),
  ('\ythc\y',                           'block', 'narkotyki'),
  ('\yporno',                           'block', 'tresci erotyczne'),
  ('\yminet',                           'block', 'tresci erotyczne'),
  -- "zajebisty" to w recenzjach pochwala, nie przeklenstwo.
  ('zajebis[a-z]*',                     'allow', 'zajebisty = pochwala');

-- ── 2. Normalizacja i dopasowanie ──────────────────────────────────────────
CREATE FUNCTION public.moderation_variants(_t text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  WITH base AS (
    SELECT regexp_replace(
             translate(lower(coalesce(_t, '')), 'ąćęłńóśźż01345@$7', 'acelnoszzoieasast'),
             '(.)\1{2,}', '\1', 'g') AS t
  ),
  v AS (
    SELECT
      regexp_replace(t, '[^a-z ]+', ' ', 'g') AS v1,
      -- znaki wewnatrz slowa znikaja: k.u.r.w.a, k*rwa -> kurwa, krwa
      regexp_replace(regexp_replace(t, '(?<=[a-z])[^a-z\s]+(?=[a-z])', '', 'g'), '[^a-z ]+', ' ', 'g') AS v2
    FROM base
  )
  -- v3: pojedyncze litery rozdzielone spacjami sklejone w slowo (k u r w a)
  SELECT ARRAY[v1, v2, regexp_replace(v1, '\y([a-z]) (?=[a-z]\y)', '\1', 'g')] FROM v;
$$;

CREATE FUNCTION public.moderation_match(_t text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text[]; t text; s text; a record; b record;
BEGIN
  IF _t IS NULL OR length(trim(_t)) = 0 THEN RETURN NULL; END IF;
  v := public.moderation_variants(_t);
  FOREACH t IN ARRAY v LOOP
    s := t;
    FOR a IN SELECT pattern FROM public.moderation_terms WHERE kind = 'allow' AND enabled LOOP
      BEGIN s := regexp_replace(s, a.pattern, ' ', 'g'); EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
    FOR b IN SELECT pattern, coalesce(note, 'inne') AS n FROM public.moderation_terms
             WHERE kind = 'block' AND enabled LOOP
      BEGIN
        IF s ~ b.pattern THEN RETURN b.n; END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.moderation_match(text) FROM PUBLIC, anon, authenticated;

-- ── 3. Kary ────────────────────────────────────────────────────────────────
CREATE TABLE public.user_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('warning', 'ban')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  expires_at timestamptz,                       -- tylko ban; NULL = staly
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_kind text,
  source_excerpt text
);
CREATE INDEX user_sanctions_user_idx ON public.user_sanctions (user_id, created_at DESC);
ALTER TABLE public.user_sanctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_sanctions read own or admin" ON public.user_sanctions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
GRANT SELECT ON public.user_sanctions TO authenticated;

CREATE FUNCTION public.is_banned(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_sanctions
    WHERE user_id = _uid AND kind = 'ban' AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_banned(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.my_ban_status()
RETURNS TABLE (banned boolean, permanent boolean, expires_at timestamptz, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT true, s.expires_at IS NULL, s.expires_at, s.reason
  FROM public.user_sanctions s
  WHERE s.user_id = auth.uid() AND s.kind = 'ban' AND s.revoked_at IS NULL
    AND (s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY s.expires_at DESC NULLS FIRST
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_ban_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_ban_status() TO authenticated;

-- ── 4. Straznik tresci (triggery) ──────────────────────────────────────────
-- Jedna funkcja na wszystkie tabele z trescia; nazwa kolumny w TG_ARGV[0].
CREATE FUNCTION public.moderation_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kol text := TG_ARGV[0];
  v_nowa text := to_jsonb(NEW) ->> v_kol;
  v_uid uuid := (to_jsonb(NEW) ->> 'user_id')::uuid;
  v_do timestamptz;
BEGIN
  -- Zmiana czegos innego niz tresc (np. edycja zdjecia, licznik) - bez kontroli.
  IF TG_OP = 'UPDATE' AND v_nowa IS NOT DISTINCT FROM (to_jsonb(OLD) ->> v_kol) THEN
    RETURN NEW;
  END IF;
  -- Zapisy z serwera (service role, bez sesji) nie sa tresciami uzytkownikow.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF public.is_banned(v_uid) THEN
    SELECT max(expires_at) INTO v_do FROM public.user_sanctions
      WHERE user_id = v_uid AND kind = 'ban' AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now());
    RAISE EXCEPTION 'PZ_BANNED' USING DETAIL = coalesce(v_do::text, 'permanent');
  END IF;
  IF public.moderation_match(v_nowa) IS NOT NULL THEN
    RAISE EXCEPTION 'PZ_PROFANITY';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.moderation_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER moderation_guard BEFORE INSERT OR UPDATE OF body ON public.wall_posts
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('body');
CREATE TRIGGER moderation_guard BEFORE INSERT OR UPDATE OF body ON public.wall_comments
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('body');
CREATE TRIGGER moderation_guard BEFORE INSERT OR UPDATE OF body ON public.review_comments
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('body');
CREATE TRIGGER moderation_guard BEFORE INSERT OR UPDATE OF body ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('body');
CREATE TRIGGER moderation_guard BEFORE INSERT OR UPDATE OF body ON public.place_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('body');

-- Profil: nick, nazwa i opis sa publiczne. Tylko UPDATE - handle_new_user
-- wpisuje nazwe z Google i rejestracja nie moze sie wywrocic na czyims imieniu.
CREATE FUNCTION public.moderation_guard_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.username IS DISTINCT FROM OLD.username
      OR NEW.display_name IS DISTINCT FROM OLD.display_name
      OR NEW.bio IS DISTINCT FROM OLD.bio)
     AND public.moderation_match(concat_ws(' ', NEW.username, NEW.display_name, NEW.bio)) IS NOT NULL THEN
    RAISE EXCEPTION 'PZ_PROFANITY';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.moderation_guard_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER moderation_guard_profile BEFORE UPDATE OF username, display_name, bio ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard_profile();

-- Usuniety wpis nie zostawia sierot: reakcje i komentarze wisza na ref_id (text).
CREATE FUNCTION public.wall_posts_cleanup_social() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.wall_reactions WHERE kind = 'post' AND ref_id = OLD.id::text;
  DELETE FROM public.wall_comments WHERE kind = 'post' AND ref_id = OLD.id::text;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.wall_posts_cleanup_social() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wall_posts_cleanup_social AFTER DELETE ON public.wall_posts
  FOR EACH ROW EXECUTE FUNCTION public.wall_posts_cleanup_social();

-- ── 5. Zgloszenia od spolecznosci ──────────────────────────────────────────
CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('post', 'review', 'wall_comment', 'review_comment', 'place_post_comment')),
  target_id uuid NOT NULL,
  target_user_id uuid,
  target_excerpt text,                           -- migawka: przetrwa usuniecie tresci
  target_image text,
  reason text NOT NULL CHECK (reason IN ('wulgaryzmy', 'nienawisc', 'spam', 'erotyka', 'przemoc', 'inne')),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  resolution text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_kind, target_id)
);
CREATE INDEX content_reports_open_idx ON public.content_reports (status, created_at DESC);
CREATE INDEX content_reports_target_idx ON public.content_reports (target_kind, target_id);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_reports read own or admin" ON public.content_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_admin());
GRANT SELECT ON public.content_reports TO authenticated;

-- Log prob (zablokowane teksty, kontrole zdjec) - do oceny, kto sie upiera.
CREATE TABLE public.moderation_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,                            -- text_blocked | image_check | image_blocked | image_check_failed
  excerpt text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_log_user_idx ON public.moderation_log (user_id, created_at DESC);
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moderation_log admin read" ON public.moderation_log
  FOR SELECT TO authenticated USING (public.is_admin());
GRANT SELECT ON public.moderation_log TO authenticated;

-- Migawka tresci (autor, fragment, zdjecie) - wspolna dla zgloszen i akcji.
CREATE FUNCTION public._moderation_target(_kind text, _id uuid)
RETURNS TABLE (user_id uuid, excerpt text, image text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind = 'post' THEN
    RETURN QUERY SELECT w.user_id, left(w.body, 300), w.image_url FROM public.wall_posts w WHERE w.id = _id;
  ELSIF _kind = 'review' THEN
    RETURN QUERY SELECT r.user_id, left(coalesce(r.body, ''), 300), r.photo_url FROM public.reviews r WHERE r.id = _id;
  ELSIF _kind = 'wall_comment' THEN
    RETURN QUERY SELECT c.user_id, left(c.body, 300), NULL::text FROM public.wall_comments c WHERE c.id = _id;
  ELSIF _kind = 'review_comment' THEN
    RETURN QUERY SELECT c.user_id, left(c.body, 300), NULL::text FROM public.review_comments c WHERE c.id = _id;
  ELSIF _kind = 'place_post_comment' THEN
    RETURN QUERY SELECT c.user_id, left(c.body, 300), NULL::text FROM public.place_post_comments c WHERE c.id = _id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._moderation_target(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.report_content(_kind text, _id uuid, _reason text, _details text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); t record; v_id uuid; v_admin uuid; v_ile int;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO t FROM public._moderation_target(_kind, _id);
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF t.user_id = v_me THEN RAISE EXCEPTION 'own_content'; END IF;
  SELECT count(*) INTO v_ile FROM public.content_reports
    WHERE reporter_id = v_me AND created_at > now() - interval '24 hours';
  IF v_ile >= 20 THEN RAISE EXCEPTION 'rate_limited'; END IF;

  INSERT INTO public.content_reports
    (reporter_id, target_kind, target_id, target_user_id, target_excerpt, target_image, reason, details)
  VALUES (v_me, _kind, _id, t.user_id, t.excerpt, t.image, _reason, nullif(trim(_details), ''))
  ON CONFLICT (reporter_id, target_kind, target_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN; END IF;   -- juz zgloszone przez te osobe

  FOR v_admin IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'super_admin') LOOP
    PERFORM public.notify(v_admin, 'content_report', 'Nowe zgłoszenie treści',
      'Powód: ' || _reason, '/admin/moderacja', 'content_report', v_id);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.report_content(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) TO authenticated;

-- ── 6. Akcje moderatora ────────────────────────────────────────────────────
CREATE FUNCTION public._moderation_delete(_kind text, _id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind = 'post' THEN DELETE FROM public.wall_posts WHERE id = _id;
  ELSIF _kind = 'review' THEN DELETE FROM public.reviews WHERE id = _id;
  ELSIF _kind = 'wall_comment' THEN DELETE FROM public.wall_comments WHERE id = _id;
  ELSIF _kind = 'review_comment' THEN DELETE FROM public.review_comments WHERE id = _id;
  ELSIF _kind = 'place_post_comment' THEN DELETE FROM public.place_post_comments WHERE id = _id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._moderation_delete(text, uuid) FROM PUBLIC, anon, authenticated;

-- Nakladanie kary. Bez sprawdzania roli - wolane tylko z funkcji nizej i z testow
-- (service role). Uprawnienia sprawdzaja opakowania.
CREATE FUNCTION public._moderation_sanction(
  _actor uuid, _user uuid, _kind text, _reason text, _days int, _src_kind text, _src_excerpt text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_exp timestamptz; v_tresc text;
BEGIN
  IF _kind = 'ban' AND _days IS NOT NULL THEN v_exp := now() + make_interval(days => _days); END IF;
  INSERT INTO public.user_sanctions (user_id, kind, reason, expires_at, created_by, source_kind, source_excerpt)
  VALUES (_user, _kind, _reason, v_exp, _actor, _src_kind, _src_excerpt) RETURNING id INTO v_id;

  v_tresc := CASE
    WHEN _kind = 'warning' THEN 'Ostrzeżenie: ' || _reason
    WHEN v_exp IS NULL THEN 'Twoje konto zostało zablokowane na stałe. Powód: ' || _reason
    ELSE 'Nie możesz pisać do ' || to_char(v_exp AT TIME ZONE 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI') || '. Powód: ' || _reason
  END;
  PERFORM public.notify(_user, 'moderation',
    CASE WHEN _kind = 'warning' THEN 'Ostrzeżenie od moderatora' ELSE 'Blokada pisania' END,
    v_tresc, '/regulamin', 'sanction', v_id);
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
  VALUES (_actor, 'moderation_' || _kind, _user,
          jsonb_build_object('reason', _reason, 'days', _days, 'source', _src_kind, 'excerpt', _src_excerpt));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._moderation_sanction(uuid, uuid, text, text, int, text, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public._moderation_check_target_user(_actor uuid, _user uuid, _kind text, _days int) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user = _actor THEN RAISE EXCEPTION 'self'; END IF;
  IF public.has_role(_user, 'super_admin')
     OR (public.has_role(_user, 'admin') AND NOT public.has_role(_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'protected';
  END IF;
  IF _kind = 'ban' AND _days IS NULL AND NOT public.has_role(_actor, 'super_admin') THEN
    RAISE EXCEPTION 'super_only';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._moderation_check_target_user(uuid, uuid, text, int) FROM PUBLIC, anon, authenticated;

-- Rdzen: usun tresc + ewentualna kara + zamkniecie zgloszen + powiadomienie.
CREATE FUNCTION public._moderation_apply(
  _actor uuid, _kind text, _id uuid, _action text, _reason text, _days int, _report uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_excerpt text; t record;
BEGIN
  SELECT * INTO t FROM public._moderation_target(_kind, _id);
  IF FOUND THEN
    v_user := t.user_id; v_excerpt := t.excerpt;
  ELSIF _report IS NOT NULL THEN
    -- Tresc juz usunieta (np. przez autora) - kara z migawki w zgloszeniu.
    SELECT target_user_id, target_excerpt INTO v_user, v_excerpt FROM public.content_reports WHERE id = _report;
  END IF;
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  IF _action IN ('warn', 'ban') THEN
    PERFORM public._moderation_check_target_user(_actor, v_user, CASE WHEN _action = 'ban' THEN 'ban' ELSE 'warning' END, _days);
  ELSIF _action = 'remove' THEN
    IF v_user = _actor THEN RAISE EXCEPTION 'self'; END IF;
  END IF;

  PERFORM public._moderation_delete(_kind, _id);
  IF _action IN ('warn', 'ban') THEN
    PERFORM public._moderation_sanction(_actor, v_user, CASE WHEN _action = 'ban' THEN 'ban' ELSE 'warning' END,
                                        _reason, _days, _kind, v_excerpt);
  ELSE
    PERFORM public.notify(v_user, 'moderation', 'Twoja treść została usunięta',
      'Moderator usunął Twoją treść. Powód: ' || _reason, '/regulamin', 'moderation', NULL);
    INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
    VALUES (_actor, 'moderation_remove', v_user, jsonb_build_object('reason', _reason, 'source', _kind, 'excerpt', v_excerpt));
  END IF;

  UPDATE public.content_reports
     SET status = 'actioned', resolution = _action, resolved_by = _actor, resolved_at = now()
   WHERE target_kind = _kind AND target_id = _id AND status = 'open';
END $$;
REVOKE ALL ON FUNCTION public._moderation_apply(uuid, text, uuid, text, text, int, uuid) FROM PUBLIC, anon, authenticated;

-- Publiczne wejscia dla admina (kazde sprawdza role).
CREATE FUNCTION public.moderation_act(_kind text, _id uuid, _action text, _reason text, _days int DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action NOT IN ('remove', 'warn', 'ban') THEN RAISE EXCEPTION 'bad_action'; END IF;
  IF char_length(coalesce(trim(_reason), '')) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  PERFORM public._moderation_apply(auth.uid(), _kind, _id, _action, trim(_reason), _days);
END $$;
REVOKE ALL ON FUNCTION public.moderation_act(text, uuid, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_act(text, uuid, text, text, int) TO authenticated;

CREATE FUNCTION public.moderation_resolve_report(_report uuid, _action text, _reason text DEFAULT NULL, _days int DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.content_reports WHERE id = _report;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _action = 'dismiss' THEN
    UPDATE public.content_reports
       SET status = 'dismissed', resolution = 'dismissed', resolved_by = auth.uid(), resolved_at = now()
     WHERE target_kind = r.target_kind AND target_id = r.target_id AND status = 'open';
    RETURN;
  END IF;
  IF _action NOT IN ('remove', 'warn', 'ban') THEN RAISE EXCEPTION 'bad_action'; END IF;
  IF char_length(coalesce(trim(_reason), '')) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  PERFORM public._moderation_apply(auth.uid(), r.target_kind, r.target_id, _action, trim(_reason), _days, _report);
END $$;
REVOKE ALL ON FUNCTION public.moderation_resolve_report(uuid, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_resolve_report(uuid, text, text, int) TO authenticated;

-- Kara bez tresci (np. z profilu uzytkownika).
CREATE FUNCTION public.moderation_sanction_user(_user uuid, _kind text, _reason text, _days int DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _kind NOT IN ('warning', 'ban') THEN RAISE EXCEPTION 'bad_action'; END IF;
  IF char_length(coalesce(trim(_reason), '')) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  PERFORM public._moderation_check_target_user(auth.uid(), _user, _kind, _days);
  PERFORM public._moderation_sanction(auth.uid(), _user, _kind, trim(_reason), _days, NULL, NULL);
END $$;
REVOKE ALL ON FUNCTION public.moderation_sanction_user(uuid, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_sanction_user(uuid, text, text, int) TO authenticated;

CREATE FUNCTION public.moderation_revoke(_sanction uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO s FROM public.user_sanctions WHERE id = _sanction AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.kind = 'ban' AND s.expires_at IS NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'super_only';
  END IF;
  UPDATE public.user_sanctions SET revoked_at = now(), revoked_by = auth.uid() WHERE id = _sanction;
  IF s.kind = 'ban' THEN
    PERFORM public.notify(s.user_id, 'moderation', 'Blokada zdjęta', 'Możesz znowu pisać na Pożeralni.', '/wall', 'sanction', s.id);
  END IF;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
  VALUES (auth.uid(), 'moderation_revoke', s.user_id, jsonb_build_object('sanction', s.id, 'kind', s.kind));
END $$;
REVOKE ALL ON FUNCTION public.moderation_revoke(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_revoke(uuid) TO authenticated;

-- ── 7. Log prob i limit kontroli zdjec ─────────────────────────────────────
-- Klient po odrzuceniu tekstu zglasza probe - serwer sam ponownie sprawdza,
-- wiec nie da sie zasypac logu wymyslonymi wpisami (i max 50/dobe na osobe).
CREATE FUNCTION public.moderation_log_blocked(_text text, _where text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_note text; v_ile int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  v_note := public.moderation_match(_text);
  IF v_note IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_ile FROM public.moderation_log
    WHERE user_id = auth.uid() AND kind = 'text_blocked' AND created_at > now() - interval '24 hours';
  IF v_ile >= 50 THEN RETURN; END IF;
  INSERT INTO public.moderation_log (user_id, kind, excerpt, note)
  VALUES (auth.uid(), 'text_blocked', left(_text, 200), v_note || coalesce(' (' || _where || ')', ''));
END $$;
REVOKE ALL ON FUNCTION public.moderation_log_blocked(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_log_blocked(text, text) TO authenticated;

-- Kontrola zdjecia kosztuje (Claude vision) - limit na osobe, zapis w logu.
CREATE FUNCTION public.moderation_image_check_allowed() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ile int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO v_ile FROM public.moderation_log
    WHERE user_id = auth.uid() AND kind LIKE 'image%' AND created_at > now() - interval '1 hour';
  IF v_ile >= 40 THEN RETURN false; END IF;
  INSERT INTO public.moderation_log (user_id, kind) VALUES (auth.uid(), 'image_check');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.moderation_image_check_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_image_check_allowed() TO authenticated;

CREATE FUNCTION public.moderation_log_image(_kind text, _note text DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.moderation_log (user_id, kind, note)
  SELECT auth.uid(), _kind, left(_note, 200)
  WHERE auth.uid() IS NOT NULL AND _kind IN ('image_blocked', 'image_check_failed');
$$;
REVOKE ALL ON FUNCTION public.moderation_log_image(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_log_image(text, text) TO authenticated;

INSERT INTO public.admin_changelog (summary) VALUES
  ('Moderacja: filtr wulgaryzmow (blokada przed publikacja), zgloszenia tresci, ostrzezenia i bany (1/7/30 dni, staly), usuwanie wpisow i komentarzy.');
