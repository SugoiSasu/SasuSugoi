import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { szukajDanychLokalu } from "@/lib/place-enrichment.functions";
import type { PropozycjaLokalu } from "@/lib/place-enrichment.core";

export type StatusPropozycji = "szukam" | "gotowe" | "blad";

export interface WierszPropozycji {
  place_id: string;
  status: StatusPropozycji;
  propozycja: PropozycjaLokalu | null;
  blad: string | null;
  updated_at: string;
}

const KLUCZ = ["place-enrichment"] as const;

/**
 * "szukam" starsze niz 5 minut to przerwane szukanie (zamknieta karta, timeout
 * funkcji) - nie blokujemy przez to przycisku na zawsze.
 */
export function czyTrwa(w: WierszPropozycji | null | undefined): boolean {
  return w?.status === "szukam" && Date.now() - new Date(w.updated_at).getTime() < 5 * 60_000;
}

export function usePropozycjeLokali() {
  return useQuery({
    queryKey: KLUCZ,
    queryFn: async (): Promise<WierszPropozycji[]> => {
      const { data, error } = await supabase
        .from("place_enrichment")
        .select("place_id, status, propozycja, blad, updated_at");
      if (error) throw error;
      return (data ?? []) as unknown as WierszPropozycji[];
    },
  });
}

export function usePropozycjaLokalu(placeId: string | null) {
  const q = usePropozycjeLokali();
  return { ...q, data: q.data?.find((w) => w.place_id === placeId) ?? null };
}

export function useSzukajDanych() {
  const qc = useQueryClient();
  const szukaj = useServerFn(szukajDanychLokalu);
  return useMutation({
    mutationFn: ({ placeId, dokladnie }: { placeId: string; dokladnie?: boolean }) =>
      szukaj({ data: { placeId, dokladnie } }),
    // Zawsze odswiezamy - takze po bledzie, bo serwer zapisal status "blad".
    onSettled: () => qc.invalidateQueries({ queryKey: KLUCZ }),
  });
}

export function useOdrzucPropozycje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (placeId: string) => {
      const { error } = await supabase.from("place_enrichment").delete().eq("place_id", placeId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KLUCZ }),
  });
}
