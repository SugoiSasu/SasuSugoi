-- 1. Add avatar_source column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_source text NOT NULL DEFAULT 'initials'
    CHECK (avatar_source IN ('initials','google','upload'));

-- 2. Backfill: rows with avatar_url assumed to be uploads unless URL is googleusercontent
UPDATE public.profiles
SET avatar_source = CASE
  WHEN avatar_url IS NULL THEN 'initials'
  WHEN avatar_url LIKE '%googleusercontent.com%' THEN 'google'
  ELSE 'upload'
END
WHERE avatar_source = 'initials';

-- 3. Improve handle_new_user to pull Google avatar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avatar text;
  v_source text := 'initials';
BEGIN
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  IF v_avatar IS NOT NULL THEN
    v_source := 'google';
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url, avatar_source)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    v_avatar,
    v_source
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Re-create UPDATE policy with explicit WITH CHECK
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

