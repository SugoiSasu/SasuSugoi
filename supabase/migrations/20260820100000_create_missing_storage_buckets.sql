-- avatars, review-photos, ad-images, and blog-images never actually existed as
-- storage buckets — only place-photos did. Every upload path targeting them
-- (profile picture, review photo, ad creative, blog cover) has been failing
-- with "Bucket not found" in production. RLS policies for all four already
-- exist (from earlier migrations) and were just waiting on the bucket itself.
--
-- Sizes/types mirror what each upload path already enforces client-side (a
-- weak, bypassable check) — this makes it a real, server-enforced limit too.
-- SVG is deliberately excluded from every allowlist: unlike raster formats it
-- can carry embedded script content, so "any image" is not a safe allowlist
-- for user-uploaded files that get displayed back to other users.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',       'avatars',       false, 5242880,   ARRAY['image/jpeg','image/png','image/webp']),
  ('review-photos', 'review-photos', false, 5242880,   ARRAY['image/jpeg','image/png','image/webp']),
  ('ad-images',     'ad-images',     false, 1048576,   ARRAY['image/jpeg','image/png','image/webp']),
  ('blog-images',   'blog-images',   false, 10485760,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
