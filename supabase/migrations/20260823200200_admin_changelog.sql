-- Short "what changed" patch-note log, visible to admins in the panel. New
-- entries land here as part of each shipped change (migration INSERT), not
-- through an admin-facing write form - it's a changelog, not user content.
CREATE TABLE public.admin_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_changelog_created_at_idx ON public.admin_changelog(created_at DESC);

GRANT SELECT ON public.admin_changelog TO authenticated;
GRANT ALL ON public.admin_changelog TO service_role;
ALTER TABLE public.admin_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read changelog" ON public.admin_changelog
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.admin_changelog (summary, created_at) VALUES
  ('Naprawiono zgłoszenia właściciela - blokował je martwy wpis roli admina po migracji z Lovable (FK error przy każdej próbie zgłoszenia).', '2026-08-23T20:00:00Z'),
  ('Zatwierdzanie/odrzucanie zgłoszeń właściciela wymaga teraz super_admina - spójnie z resztą panelu Moderacja.', '2026-08-23T20:00:00Z'),
  ('Strona Osiągnięcia pokazuje teraz ekran logowania niezalogowanym gościom zamiast fałszywego widoku postępu.', '2026-08-23T20:00:00Z'),
  ('Dodano ten dziennik zmian w panelu admina.', '2026-08-23T20:00:00Z');
