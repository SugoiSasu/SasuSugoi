import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import { trackEvent } from "@/lib/analytics";
import type { Place } from "@/lib/places-api";

/** Publiczna - kazdy z linkiem; Znajomi - tylko zaakceptowani znajomi;
 *  Prywatna - tylko wlasciciel. Egzekwowane w bazie przez
 *  list_is_visible_to_me() (migracja 20260927120000), nie w interfejsie. */
export type ListVisibility = "public" | "friends" | "private";

export const VISIBILITY_LABEL: Record<ListVisibility, string> = {
  public: "Publiczna",
  friends: "Znajomi",
  private: "Prywatna",
};

export interface PlaceList {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  visibility: ListVisibility;
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

const LIST_COLUMNS =
  "id, user_id, title, description, cover_image_url, visibility, created_at, updated_at";
const PLACE_PICK = "id, slug, name, cuisine, avatar_url, cover_image_url, address";

export function useMyLists() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["place-lists", "mine", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<PlaceListWithCount[]> => {
      const { data, error } = await supabase
        .from("place_lists")
        .select(`${LIST_COLUMNS}, place_list_items(count)`)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Licznik miejsc idzie agregatem w tym samym zapytaniu - inaczej karta
      // listy musialaby dociagac pozycje kazdej listy osobno tylko po to, zeby
      // napisac "5 miejsc".
      return (data ?? []).map((row) => {
        const { place_list_items, ...lista } = row as unknown as PlaceList & {
          place_list_items?: { count: number }[];
        };
        return { ...lista, places_count: place_list_items?.[0]?.count ?? 0 };
      }) as PlaceListWithCount[];
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
      const { data: listRows, error } = await supabase.rpc("get_shared_list", {
        _id: id!,
      });

      // Migracja 20260925140000 jest na produkcji od 2026-09-27, wiec ta
      // galaz juz nie powinna sie odpalac. Zostaje jako siatka bezpieczenstwa
      // na wypadek srodowiska bez tej migracji (np. swiezy projekt z czesciowo
      // wgrana kolejka) - brak funkcji nie moze wywrocic strony listy.
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

export interface PlaceListWithCount extends PlaceList {
  places_count: number;
}

export interface CreateListInput {
  title: string;
  description?: string | null;
  visibility?: ListVisibility;
  placeIds: string[];
}

export function useCreateList() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async ({ title, description, visibility, placeIds }: CreateListInput) => {
      if (!user) throw new Error("Zaloguj się");
      const { data: list, error } = await supabase
        .from("place_lists")
        .insert({
          user_id: user.id,
          title,
          description: description || null,
          visibility: visibility ?? "public",
        })
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
      // Nowa lista moze od razu zawierac lokale (okno "Dodaj do listy" zaklada
      // ja wraz z biezacym lokalem), wiec przynaleznosc tez sie zmienia. Bez
      // tego checkbox zostawal pusty, a plakietka "Na N listach" nie rosla.
      qc.invalidateQueries({ queryKey: ["place-list-membership"] });
      qc.invalidateQueries({ queryKey: ["place-lists-covers"] });
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

/**
 * Do ktorych WLASNYCH list nalezy dany lokal.
 *
 * Tylko wlasne: plakietka "Na N listach" na karcie lokalu ma odpowiadac na
 * pytanie "czy juz to gdzies zapisalem", a nie zdradzac, ilu obcych ludzi
 * trzyma ten lokal u siebie.
 */
export function useMyListMembership() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["place-list-membership", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data, error } = await supabase
        .from("place_list_items")
        .select("place_id, list_id, place_lists!inner(user_id)")
        .eq("place_lists.user_id", user!.id);
      if (error) throw error;
      const m = new Map<string, string[]>();
      for (const row of (data ?? []) as unknown as { place_id: string; list_id: string }[]) {
        const lista = m.get(row.place_id) ?? [];
        lista.push(row.list_id);
        m.set(row.place_id, lista);
      }
      return m;
    },
  });
}

function uniewaznijListy(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["place-lists"] });
  qc.invalidateQueries({ queryKey: ["place-list"] });
  qc.invalidateQueries({ queryKey: ["place-list-membership"] });
  // Okladka 2x2 na karcie listy jest zlozona z pierwszych czterech lokali,
  // wiec kazde dodanie, usuniecie i zmiana kolejnosci moze ja zmienic.
  qc.invalidateQueries({ queryKey: ["place-lists-covers"] });
}

export function useAddPlaceToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, placeId }: { listId: string; placeId: string }) => {
      // Nowa pozycja lakduje na koncu listy. sort_order liczymy z aktualnego
      // maksimum, a nie z liczby pozycji - po usunieciu czegos ze srodka te
      // dwie liczby przestaja byc rowne i doszloby do kolizji kolejnosci.
      const { data: ostatnia, error: maxErr } = await supabase
        .from("place_list_items")
        .select("sort_order")
        .eq("list_id", listId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxErr) throw maxErr;
      const { error } = await supabase
        .from("place_list_items")
        .insert({ list_id: listId, place_id: placeId, sort_order: (ostatnia?.sort_order ?? -1) + 1 });
      if (error) throw error;
    },
    onSuccess: () => uniewaznijListy(qc),
  });
}

export function useRemovePlaceFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, placeId }: { listId: string; placeId: string }) => {
      const { error } = await supabase
        .from("place_list_items")
        .delete()
        .eq("list_id", listId)
        .eq("place_id", placeId);
      if (error) throw error;
    },
    onSuccess: () => uniewaznijListy(qc),
  });
}

export interface UpdateListInput {
  id: string;
  title?: string;
  description?: string | null;
  visibility?: ListVisibility;
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...pola }: UpdateListInput) => {
      // .select() jest konieczne: bez niego Supabase zwraca error: null takze
      // wtedy, gdy RLS odfiltrowalo wiersz, i interfejs pokazalby "zapisano"
      // mimo ze nic sie nie zapisalo.
      const { data, error } = await supabase
        .from("place_lists")
        .update(pola)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Nie udało się zapisać zmian w liście");
    },
    onSuccess: () => uniewaznijListy(qc),
  });
}

/** Przesuwa pozycje o jedno miejsce w gore albo w dol, zamieniajac ja sasiadem. */
export function useMoveListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      index,
      kierunek,
    }: {
      items: PlaceListItem[];
      index: number;
      kierunek: -1 | 1;
    }) => {
      const cel = index + kierunek;
      if (cel < 0 || cel >= items.length) return;
      const a = items[index];
      const b = items[cel];
      // Zamiana wartosci sort_order, nie przepisywanie calej listy - dwa
      // UPDATE-y zamiast N, i kolejnosc pozostalych pozycji zostaje nietknieta.
      const { error: e1 } = await supabase
        .from("place_list_items")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("place_list_items")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => uniewaznijListy(qc),
  });
}

/**
 * Identyfikatory lokali z WLASNYCH list, w kolejnosci ustawionej przez
 * wlasciciela - zrodlo okladek 2x2 na karcie listy.
 *
 * Jedno zapytanie dla wszystkich list naraz zamiast po jednym na kazda: przy
 * kilkunastu listach roznica to kilkanascie round-tripow na wejsciu w
 * zakladke.
 */
export function useListsCovers() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["place-lists-covers", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data, error } = await supabase
        .from("place_list_items")
        .select("list_id, place_id, sort_order, place_lists!inner(user_id)")
        .eq("place_lists.user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const m = new Map<string, string[]>();
      for (const row of (data ?? []) as unknown as { list_id: string; place_id: string }[]) {
        const lista = m.get(row.list_id) ?? [];
        if (lista.length < 4) lista.push(row.place_id);
        m.set(row.list_id, lista);
      }
      return m;
    },
  });
}
