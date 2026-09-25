import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { trackEvent } from "@/lib/analytics";
import type { Place } from "@/lib/places-api";

export interface PlaceList {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaceListItem {
  id: string;
  list_id: string;
  place_id: string;
  note: string | null;
  sort_order: number;
  added_at: string;
  place?: Pick<
    Place,
    "id" | "slug" | "name" | "cuisine" | "avatar_url" | "cover_image_url" | "address"
  > | null;
}

const LIST_COLUMNS = "id, user_id, title, description, cover_image_url, created_at, updated_at";
const PLACE_PICK = "id, slug, name, cuisine, avatar_url, cover_image_url, address";

export function useMyLists() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["place-lists", "mine", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<PlaceList[]> => {
      const { data, error } = await supabase
        .from("place_lists")
        .select(LIST_COLUMNS)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlaceList[];
    },
  });
}

export function useList(id: string | undefined) {
  return useQuery({
    queryKey: ["place-list", id ?? null],
    enabled: !!id,
    queryFn: async (): Promise<{ list: PlaceList; items: PlaceListItem[] } | null> => {
      // Czytane przez get_shared_list/get_shared_list_items, a nie wprost z
      // tabel. Polityka na place_lists zawęża odczyt do "wlasciciel / znajomy
      // / profil publiczny" (migracja 20260925140000), bo inaczej kazdy mogl
      // pobrac listy WSZYSTKICH uzytkownikow jednym zapytaniem - wbrew
      // obietnicy w Ustawieniach. Te dwie funkcje przyjmuja konkretne id, wiec
      // UUID listy dziala jak klucz: kto ma link, ten widzi liste, ale nikt
      // nie wylistuje tabeli.
      const { data: listRows, error } = await supabase.rpc("get_shared_list" as never, {
        _id: id!,
      } as never);

      // Dopoki migracja 20260925140000 nie jest zaaplikowana, funkcji nie ma
      // (PGRST202) - wtedy czytamy po staremu wprost z tabel, ktore w tym
      // stanie i tak maja jeszcze stara, otwarta polityke. Bez tego strona
      // listy przestalaby dzialac miedzy deployem a wklejeniem migracji.
      if (error) {
        if (error.code !== "PGRST202") throw error;
        const { data: legacyList, error: legacyErr } = await supabase
          .from("place_lists")
          .select(LIST_COLUMNS)
          .eq("id", id!)
          .maybeSingle();
        if (legacyErr) throw legacyErr;
        if (!legacyList) return null;
        const { data: legacyItems, error: legacyItemsErr } = await supabase
          .from("place_list_items")
          .select(`id, list_id, place_id, note, sort_order, added_at, place:places(${PLACE_PICK})`)
          .eq("list_id", id!)
          .order("sort_order", { ascending: true });
        if (legacyItemsErr) throw legacyItemsErr;
        return {
          list: legacyList as PlaceList,
          items: (legacyItems ?? []) as unknown as PlaceListItem[],
        };
      }

      const list = (listRows as PlaceList[] | null)?.[0];
      if (!list) return null;

      const { data: itemRows, error: itemsErr } = await supabase.rpc(
        "get_shared_list_items" as never,
        { _id: id! } as never,
      );
      if (itemsErr) throw itemsErr;
      const items = ((itemRows ?? []) as PlaceListItem[]).slice();

      // Lokale dociagane osobno - wczesniej szly zagniezdzonym selectem, ktory
      // przez RPC nie przechodzi. `places` i tak ma wlasna polityke (tylko
      // opublikowane), wiec nie obchodzi to niczyich uprawnien.
      const placeIds = Array.from(new Set(items.map((i) => i.place_id).filter(Boolean)));
      if (placeIds.length) {
        const { data: places, error: placesErr } = await supabase
          .from("places")
          .select(PLACE_PICK)
          .in("id", placeIds);
        if (placesErr) throw placesErr;
        const byId = new Map((places ?? []).map((p) => [p.id, p]));
        for (const item of items) {
          item.place = (byId.get(item.place_id) ?? null) as PlaceListItem["place"];
        }
      }

      return { list, items };
    },
  });
}

export interface CreateListInput {
  title: string;
  description?: string | null;
  placeIds: string[];
}

export function useCreateList() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async ({ title, description, placeIds }: CreateListInput) => {
      if (!user) throw new Error("Zaloguj się");
      const { data: list, error } = await supabase
        .from("place_lists")
        .insert({ user_id: user.id, title, description: description || null })
        .select("id")
        .single();
      if (error) throw error;
      if (placeIds.length) {
        const rows = placeIds.map((place_id, i) => ({ list_id: list.id, place_id, sort_order: i }));
        const { error: itemsErr } = await supabase.from("place_list_items").insert(rows);
        if (itemsErr) throw itemsErr;
      }
      return list.id as string;
    },
    onSuccess: (listId, vars) => {
      trackEvent("list_created", { item_id: listId, value: vars.placeIds.length });
      qc.invalidateQueries({ queryKey: ["place-lists"] });
      qc.invalidateQueries({ queryKey: ["wall-feed"] });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("place_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-lists"] }),
  });
}
