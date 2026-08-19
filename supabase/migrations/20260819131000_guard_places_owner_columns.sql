-- "places owner update" RLS policy only checks is_place_owner(auth.uid(), id)
-- — row ownership, not which columns change. The owner editor UI
-- (owner.$placeId.tsx) only ever sends phone/website/menu_url/
-- menu_image_url/opening_hours/menu_items, but nothing in the database
-- enforced that: a verified owner could call the REST API directly and
-- rewrite rating, is_published, sort_order, name, address, etc.
--
-- Fail-closed allowlist: admins/super-admins may edit every column (the
-- admin places editor legitimately does); everyone else who reaches this
-- trigger only got here via the owner-update policy, so every column not on
-- the owner-editable list is reset to its OLD value.

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

DROP TRIGGER IF EXISTS places_guard_owner_columns ON public.places;
CREATE TRIGGER places_guard_owner_columns
  BEFORE UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.guard_places_owner_columns();
