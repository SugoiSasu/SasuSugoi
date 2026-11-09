-- Oznaczenia lokali na okazje: "randka", "szybko", "ekipa". Zasilaja filtry intencji na stronie glownej
-- ("Randka", "Na szybko", "Z ekipa"). Ustawia je admin w edytorze lokalu; domyslnie pusto, wiec filtry
-- pojawiaja sie dopiero, gdy jakis lokal jest oznaczony.
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS occasions text[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT places_occasions_valid CHECK (occasions <@ ARRAY['randka', 'szybko', 'ekipa']::text[]);

-- Kolumna jest edytowalna tylko przez admina: dopisujemy ja do listy cofanych kolumn (jak avatar_url), inaczej
-- wlasciciel lokalu zmienilby ja przez ogolna polityke "owner update".
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
  NEW.occasions := OLD.occasions;
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
