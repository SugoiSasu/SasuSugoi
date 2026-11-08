import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import type { FriendProfile } from "@/lib/friends-api";

/**
 * Wspolne wyjscie: host wybiera znajomych i talie 2-8 lokali, wszyscy glosuja tak/nie, wygrywa najwiecej "tak".
 * Cala logika i bezpieczenstwo sa w funkcjach bazy (supabase/migrations/20261108130000_wspolne_wyjscie.sql).
 */

export interface CzlonekWyjscia {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_host: boolean;
  votes_done: number;
}

export interface Wyjscie {
  id: string;
  host_id: string;
  place_ids: string[];
  status: "open" | "closed";
  expires_at: string;
  /** place_id -> mój głos (tylko to, co już oddałem). */
  my_votes: Record<string, boolean>;
  members: CzlonekWyjscia[];
}

export interface WynikLokalu {
  place_id: string;
  yes_count: number;
  no_count: number;
  members_total: number;
  ideal: boolean;
}

export const MAX_ZNAJOMYCH = 5;
export const MAX_LOKALI = 8;

/** Lokale z najwyższą liczbą "tak" (remis = wszystkie). Brak "tak" u kogokolwiek = pusta lista. */
export function zwyciezcy(wyniki: WynikLokalu[]): { ideal: boolean; top: WynikLokalu[] } {
  const max = Math.max(0, ...wyniki.map((w) => w.yes_count));
  if (max === 0) return { ideal: false, top: [] };
  const top = wyniki.filter((w) => w.yes_count === max);
  return { ideal: top.some((w) => w.ideal), top };
}

/** Kto już oddał wszystkie głosy (do paska "zagłosowali 2 z 3"). */
export function ilu_skonczylo(w: Wyjscie): number {
  return w.members.filter((m) => m.votes_done >= w.place_ids.length).length;
}

export function useZapraszalniZnajomi() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["outing-friends", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<FriendProfile[]> => {
      const { data, error } = await supabase.rpc("outing_friends");
      if (error) throw error;
      return (data ?? []) as unknown as FriendProfile[];
    },
  });
}

export function useUtworzWyjscie() {
  return useMutation({
    mutationFn: async (args: { znajomi: string[]; lokale: string[] }): Promise<string> => {
      const { data, error } = await supabase.rpc("create_outing", {
        _friend_ids: args.znajomi,
        _place_ids: args.lokale,
      });
      if (error) throw error;
      return data as string;
    },
  });
}

export function useWyjscie(id: string) {
  return useQuery({
    queryKey: ["outing", id],
    queryFn: async (): Promise<Wyjscie> => {
      const { data, error } = await supabase.rpc("outing_get", { _session: id });
      if (error) throw error;
      return data as unknown as Wyjscie;
    },
    // Otwarte wyjscie odswiezamy co kilka sekund (inni glosuja); zamkniete jest juz stale.
    refetchInterval: (q) => (q.state.data?.status === "open" ? 5000 : false),
    retry: false,
  });
}

export function useWynikWyjscia(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["outing-results", id],
    enabled,
    queryFn: async (): Promise<WynikLokalu[]> => {
      const { data, error } = await supabase.rpc("outing_results", { _session: id });
      if (error) throw error;
      return (data ?? []) as WynikLokalu[];
    },
    refetchInterval: 5000,
    retry: false,
  });
}

export function useGlosujWyjscie(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { lokal: string; tak: boolean }) => {
      const { error } = await supabase.rpc("outing_vote", { _session: id, _place: args.lokal, _vote: args.tak });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["outing", id] });
      void qc.invalidateQueries({ queryKey: ["outing-results", id] });
    },
  });
}

export function useZamknijWyjscie(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("outing_close", { _session: id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["outing", id] });
      void qc.invalidateQueries({ queryKey: ["outing-results", id] });
    },
  });
}
