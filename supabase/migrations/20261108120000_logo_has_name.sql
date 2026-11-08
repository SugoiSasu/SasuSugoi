-- Czesc logo zawiera juz nazwe lokalu (np. "ZA ROGIEM"). Na karcie Kart nazwa pokazywala sie wtedy
-- dwa razy: w logo i w podpisie pod nim. Admin zaznacza taki lokal, a karta chowa podpis.
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS logo_has_name BOOLEAN NOT NULL DEFAULT false;

-- Kolumna rusza razem z avatar_url (edytowalnym tylko przez admina), wiec musi trafic na te sama liste
-- cofanych kolumn - inaczej wlasciciel lokalu zmieniłby ja przez ogolna polityke "owner update".
CREATE OR REPLACE FUNCTION public.guard_places_owner_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  NEW.logo_has_name := OLD.logo_has_name;
  NEW.reel_url := OLD.reel_url;
  NEW.price_range := OLD.price_range;
  NEW.promo_active := OLD.promo_active;
  NEW.promo_label := OLD.promo_label;
  NEW.has_takeaway := OLD.has_takeaway;
  NEW.wheelchair_accessible := OLD.wheelchair_accessible;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$function$;
