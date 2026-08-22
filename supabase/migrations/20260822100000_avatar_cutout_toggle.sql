-- Per-place admin control for the client-side logo background cutout
-- (src/lib/chroma-cutout.ts): it's a corner-sampling heuristic, not real
-- segmentation, so it can misfire on a photographic/gradient avatar - give
-- admins an escape hatch instead of it silently looking wrong.
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS avatar_cutout_enabled BOOLEAN NOT NULL DEFAULT true;

-- avatar_url is admin-only editable (guard_places_owner_columns reverts it
-- for non-admins); this toggle rides along with it, so it must be added to
-- the same revert list or it would silently become owner-editable via the
-- generic "owner update" RLS policy the moment the column exists.
CREATE OR REPLACE FUNCTION public.guard_places_owner_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- Owner-editable columns (must match owner.$placeId.tsx's save payload):
  -- phone, website, menu_url, menu_image_url, opening_hours, menu_items.
  -- Everything else reverts to OLD.
  NEW.name := OLD.name;
  NEW.slug := OLD.slug;
  NEW.cuisine := OLD.cuisine;
  NEW.address := OLD.address;
  NEW.district := OLD.district;
  NEW.description := OLD.description;
  NEW.lat := OLD.lat;
  NEW.lng := OLD.lng;
  NEW.rating := OLD.rating;
  NEW.is_published := OLD.is_published;
  NEW.sort_order := OLD.sort_order;
  NEW.cover_image_url := OLD.cover_image_url;
  NEW.avatar_url := OLD.avatar_url;
  NEW.avatar_cutout_enabled := OLD.avatar_cutout_enabled;
  NEW.reel_url := OLD.reel_url;
  NEW.price_range := OLD.price_range;
  NEW.promo_active := OLD.promo_active;
  NEW.promo_label := OLD.promo_label;
  NEW.has_takeaway := OLD.has_takeaway;
  NEW.wheelchair_accessible := OLD.wheelchair_accessible;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;
