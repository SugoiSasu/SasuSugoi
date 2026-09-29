import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { poLokalach, posortujTrofea, type Trofeum, type TrofeumWiersz, type RodzajTrofeum } from "@/lib/trophies";

// Nowa tabela/funkcja jeszcze nie ma wygenerowanych typow - lokalny, waski cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Zatwierdzone trofea jednego lokalu (reczne + wygrane w glosowaniu). */
export function useTrofeaLokalu(placeId: string | undefined) {
  return useQuery({
    queryKey: ["place-trophies", placeId],
    enabled: !!placeId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Trofeum[]> => {
      const { data, error } = await db.rpc("place_trophies_for", { _place_id: placeId });
      if (error) throw error;
      return posortujTrofea((data ?? []) as Trofeum[]);
    },
  });
}

/** Wszystkie zatwierdzone trofea (lista lokali w adminie): placeId -> trofea. */
export function useWszystkieTrofea() {
  const q = useQuery({
    queryKey: ["place-trophies-all"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Trofeum[]> => {
      const { data, error } = await db.rpc("place_trophies_for", { _place_id: null });
      if (error) throw error;
      return (data ?? []) as Trofeum[];
    },
  });
  const mapa = useMemo(() => poLokalach(q.data ?? []), [q.data]);
  return { ...q, mapa };
}

/** Wiersze tabeli (zatwierdzone i propozycje AI) - tylko dla admina, do edytora lokalu. */
export function useTrofeaWierszeAdmin(placeId: string | undefined) {
  return useQuery({
    queryKey: ["place-trophies-admin", placeId],
    enabled: !!placeId,
    queryFn: async (): Promise<TrofeumWiersz[]> => {
      const { data, error } = await db
        .from("place_trophies")
        .select("id, place_id, kind, tier, year, label, source_url, status, proposed_by_ai")
        .eq("place_id", placeId)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrofeumWiersz[];
    },
  });
}

function useOdswiez(placeId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["place-trophies-admin", placeId] });
    qc.invalidateQueries({ queryKey: ["place-trophies", placeId] });
    qc.invalidateQueries({ queryKey: ["place-trophies-all"] });
  };
}

export interface NoweTrofeum {
  kind: RodzajTrofeum;
  tier: number | null;
  year: number;
  label: string | null;
  source_url: string | null;
}

export function useDodajTrofeum(placeId: string | undefined) {
  const odswiez = useOdswiez(placeId);
  return useMutation({
    mutationFn: async (t: NoweTrofeum) => {
      const { error } = await db.from("place_trophies").insert({ ...t, place_id: placeId, status: "zatwierdzone" });
      if (error) {
        if (String(error.code) === "23505") throw new Error("To trofeum jest już dodane (ten sam rodzaj, rok i opis).");
        throw error;
      }
    },
    onSuccess: odswiez,
  });
}

export function useZatwierdzTrofeum(placeId: string | undefined) {
  const odswiez = useOdswiez(placeId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("place_trophies").update({ status: "zatwierdzone" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: odswiez,
  });
}

export function useUsunTrofeum(placeId: string | undefined) {
  const odswiez = useOdswiez(placeId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("place_trophies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: odswiez,
  });
}
