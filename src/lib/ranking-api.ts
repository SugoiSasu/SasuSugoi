import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeIlikeTerm } from "@/lib/postgrest-filter";
import type { Metryka, Okres, WierszRankingu } from "@/lib/ranking";

export function useRankingTablica(okres: Okres, metryka: Metryka, userId: string | null) {
  return useQuery({
    // userId w kluczu: wynik zalezy od tego, kto pyta (znajomi, "Ty", profile prywatne).
    queryKey: ["ranking", okres, metryka, userId],
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<WierszRankingu[]> => {
      const { data, error } = await supabase.rpc("ranking_tablica", { _okres: okres, _metryka: metryka });
      if (error) throw error;
      return (data ?? []) as WierszRankingu[];
    },
  });
}

export interface RegulaPunktow {
  event_key: string;
  points: number;
  description: string | null;
}

/** Nazwy dla ludzi - opisy w bazie sa pisane dla admina. */
const NAZWY_REGUL: Record<string, string> = {
  first_visit_new_place: "Pierwsza recenzja nowego lokalu",
  challenge_completed: "Ukończone wyzwanie",
  invite_accepted: "Znajomy dołącza z Twojego zaproszenia",
  review_created: "Recenzja lokalu",
  list_created: "Lista tematyczna",
  review_with_photo: "Zdjęcie w recenzji",
  wall_post_created: "Wpis na Pożeralni",
};

export function useRegulyPunktow() {
  return useQuery({
    queryKey: ["points-rules-public"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_rules")
        .select("event_key, points, description")
        .eq("enabled", true)
        .order("points", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as RegulaPunktow[])
        .filter((r) => NAZWY_REGUL[r.event_key])
        .map((r) => ({ ...r, nazwa: NAZWY_REGUL[r.event_key] }));
    },
  });
}

export interface ProfilSpozaRankingu {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: string | null;
  gender: string | null;
  points_total: number;
}

/**
 * Wyszukiwarka siega tez poza ranking - ranking pokazuje tylko tych, ktorzy
 * cos zrobili, a szuka sie zwykle konkretnej osoby (np. zeby ja dodac).
 */
export function useSzukajProfili(q: string) {
  const safe = sanitizeIlikeTerm(q.trim());
  return useQuery({
    queryKey: ["ranking-search", safe],
    enabled: safe.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<ProfilSpozaRankingu[]> => {
      const like = `%${safe}%`;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, avatar_source, gender, points_total")
        .or(`username.ilike.${like},display_name.ilike.${like}`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ProfilSpozaRankingu[];
    },
  });
}

export interface WierszPorownania {
  kto: "ja" | "on" | "wspolne";
  points_total: number | null;
  recenzje: number | null;
  odznaki: number | null;
  lokale: number | null;
  srednia_ocena: number | null;
}

export function usePorownanie(innyId: string | null) {
  return useQuery({
    queryKey: ["porownanie", innyId],
    enabled: !!innyId,
    queryFn: async (): Promise<WierszPorownania[]> => {
      const { data, error } = await supabase.rpc("porownanie_graczy", { _inny: innyId! });
      if (error) throw error;
      return (data ?? []) as WierszPorownania[];
    },
  });
}
