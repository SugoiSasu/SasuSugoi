import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

/**
 * Taste Profile i Match Score. Wzory i prywatnosc: supabase/migrations/20261108140000_taste_profile.sql.
 * Profil gustu widzi tylko wlasciciel i jego znajomi; zgodnosc liczy sie wylacznie ze znajomym.
 */

export interface KuchniaGustu {
  cuisine: string;
  /** Udzial kuchni w gustach (%, zaokraglony). */
  share: number;
}

export interface ProfilGustu {
  user_id: string;
  signals: number;
  cuisines: KuchniaGustu[];
  districts: { district: string; count: number }[];
  visited: number;
  favorites: number;
}

export interface ZgodnoscZeZnajomym {
  score: number | null;
  reason: "za_malo_danych" | null;
  signals_me: number;
  signals_them: number;
  shared_cuisines?: string[];
  common_places?: string[];
  their_top?: string[];
}

/** Minimum sygnalow (ulubione kuchnie, wizyty, ulubione, oceny) po obu stronach, zeby liczyc zgodnosc. */
export const MIN_SYGNALOW = 3;

export interface PoziomZgodnosci {
  etykieta: string;
  /** Klasy koloru plakietki (tlo + tekst), dobrane pod kontrast. */
  klasa: string;
}

/** Opis liczby zgodnosci slowami - sama liczba nic nie mowi. */
export function poziomZgodnosci(score: number): PoziomZgodnosci {
  if (score >= 80) return { etykieta: "Bliźniacy smaku", klasa: "bg-ok/15 text-ok" };
  if (score >= 60) return { etykieta: "Dobrze się dogadacie", klasa: "bg-ok/15 text-ok" };
  if (score >= 40) return { etykieta: "Różne gusty, ciekawe wypady", klasa: "bg-mustard/30 text-foreground" };
  return { etykieta: "Gusty na przeciwnych biegunach", klasa: "bg-muted text-muted-foreground" };
}

/** Czego brakuje, gdy zgodnosci nie da sie policzyc (do podpowiedzi w interfejsie). */
export function czegoBrakuje(z: ZgodnoscZeZnajomym): { ty: boolean; znajomy: boolean } {
  return { ty: z.signals_me < MIN_SYGNALOW, znajomy: z.signals_them < MIN_SYGNALOW };
}

export function useProfilGustu(userId: string | null | undefined) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["taste-profile", userId ?? null],
    enabled: !!user && !!userId,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<ProfilGustu> => {
      const { data, error } = await supabase.rpc("taste_profile", { _user: userId! });
      if (error) throw error;
      return data as unknown as ProfilGustu;
    },
  });
}

export function useZgodnosc(friendId: string | null | undefined, enabled = true) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["taste-match", user?.id ?? null, friendId ?? null],
    enabled: !!user && !!friendId && enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<ZgodnoscZeZnajomym> => {
      const { data, error } = await supabase.rpc("taste_match", { _friend: friendId! });
      if (error) throw error;
      return data as unknown as ZgodnoscZeZnajomym;
    },
  });
}
