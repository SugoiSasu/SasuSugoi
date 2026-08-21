import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
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
      const { data: list, error } = await supabase
        .from("place_lists")
        .select(LIST_COLUMNS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!list) return null;
      const { data: items, error: itemsErr } = await supabase
        .from("place_list_items")
        .select(`id, list_id, place_id, note, sort_order, added_at, place:places(${PLACE_PICK})`)
        .eq("list_id", id!)
        .order("sort_order", { ascending: true });
      if (itemsErr) throw itemsErr;
      return { list: list as PlaceList, items: (items ?? []) as unknown as PlaceListItem[] };
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
    onSuccess: () => {
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
