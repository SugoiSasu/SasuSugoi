import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Real aggregated rating per place, derived from public.reviews.
 *  Returns Map<place_id, { avg, count }>. Places with no reviews are absent. */
export function usePlaceRatingsMap() {
  return useQuery({
    queryKey: ["places-ratings-map"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("place_id, rating");
      if (error) throw error;
      const acc = new Map<string, { sum: number; count: number }>();
      for (const r of (data ?? []) as { place_id: string; rating: number }[]) {
        const cur = acc.get(r.place_id) ?? { sum: 0, count: 0 };
        cur.sum += r.rating;
        cur.count += 1;
        acc.set(r.place_id, cur);
      }
      const out = new Map<string, { avg: number; count: number }>();
      acc.forEach((v, k) => out.set(k, { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }));
      return out;
    },
  });
}

export interface PlaceLocation {
  id: string;
  place_id: string;
  label: string | null;
  address: string;
  lat: number;
  lng: number;
  sort_order: number;
}

export type PlaceLocationInput = {
  id?: string;
  label?: string | null;
  address: string;
  lat: number;
  lng: number;
};

export type OpeningHours = Partial<Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  { open: string; close: string } | null
>>;

export type MenuItem = { name: string; price?: string | null; description?: string | null };
export type MenuCategory = { category: string; items: MenuItem[] };

export interface Place {
  id: string;
  slug: string;
  name: string;
  cuisine: string;
  description: string;
  rating: number;
  address: string;
  lat: number;
  lng: number;
  reel_url: string | null;
  cover_image_url: string | null;
  avatar_url: string | null;
  menu_url: string | null;
  menu_image_url: string | null;
  promo_label: string | null;
  promo_active: boolean;
  phone: string | null;
  website: string | null;
  price_range: string | null;
  has_takeaway: boolean;
  is_published?: boolean;
  wheelchair_accessible: boolean;
  district: string | null;
  opening_hours: OpeningHours | null;
  menu_items: MenuCategory[] | null;
  sort_order: number;
  locations?: PlaceLocation[];
}

export type PlaceInput = Omit<Place, "id" | "slug" | "sort_order" | "locations"> & {
  sort_order?: number;
  extra_locations?: PlaceLocationInput[];
};

export function usePlaces() {
  return useQuery({
    queryKey: ["places"],
    queryFn: async (): Promise<Place[]> => {
      const { data, error } = await supabase
        .from("places")
        .select("*, locations:place_locations(*)")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as Place[]).map((p) => ({
        ...p,
        locations: (p.locations ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
      }));
    },
  });
}

async function syncExtraLocations(placeId: string, extras: PlaceLocationInput[] | undefined) {
  if (!extras) return;
  const { data: existing, error: fetchErr } = await supabase
    .from("place_locations")
    .select("id")
    .eq("place_id", placeId);
  if (fetchErr) throw fetchErr;

  const keepIds = new Set(extras.filter((e) => e.id).map((e) => e.id!));
  const toDelete = (existing ?? []).filter((e) => !keepIds.has(e.id)).map((e) => e.id);
  if (toDelete.length) {
    const { error } = await supabase.from("place_locations").delete().in("id", toDelete);
    if (error) throw error;
  }

  for (let i = 0; i < extras.length; i++) {
    const loc = extras[i];
    const payload = {
      place_id: placeId,
      label: loc.label ?? null,
      address: loc.address,
      lat: loc.lat,
      lng: loc.lng,
      sort_order: i,
    };
    if (loc.id) {
      const { error } = await supabase.from("place_locations").update(payload).eq("id", loc.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("place_locations").insert(payload);
      if (error) throw error;
    }
  }
}

export function useSavePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: PlaceInput }) => {
      const { extra_locations, ...placeFields } = values;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = placeFields as any;
      let placeId = id;
      if (id) {
        const { error } = await supabase.from("places").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("places").insert(payload).select("id").single();
        if (error) throw error;
        placeId = data.id;
      }
      if (placeId) await syncExtraLocations(placeId, extra_locations);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["places"] }),
  });
}

export function useDeletePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("places").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["places"] }),
  });
}

export function usePlaceRatingBreakdown(placeId: string) {
  return useQuery({
    queryKey: ["place-rating-breakdown", placeId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("place_rating_breakdown", { _place_id: placeId });
      if (error) throw error;
      return (data ?? []) as { rating: number; count: number }[];
    },
    enabled: !!placeId,
  });
}

const DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** True when the place's opening_hours cover the current local day/time (handles past-midnight closing). */
export function isPlaceOpenNow(hours: OpeningHours | null | undefined, now: Date = new Date()): boolean {
  if (!hours) return false;
  const cur = now.getHours() * 60 + now.getMinutes();

  const check = (slot: { open: string; close: string } | null | undefined, offset: number) => {
    if (!slot?.open || !slot?.close) return false;
    const [oh, om] = slot.open.split(":").map(Number);
    const [ch, cm] = slot.close.split(":").map(Number);
    if ([oh, om, ch, cm].some((n) => Number.isNaN(n))) return false;
    const openMin = oh * 60 + om;
    let closeMin = ch * 60 + cm;
    if (closeMin <= openMin) closeMin += 24 * 60; // spans midnight
    const t = cur + offset;
    return t >= openMin && t < closeMin;
  };

  const todayIdx = now.getDay();
  const yesterdayIdx = (todayIdx + 6) % 7;
  // today's slot, plus yesterday's slot that may still run past midnight
  return check(hours[DAY_ORDER[todayIdx]], 0) || check(hours[DAY_ORDER[yesterdayIdx]], 24 * 60);
}
