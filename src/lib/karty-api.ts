import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export interface ZnajomyLite {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: "google" | "upload" | "initials";
}

export function imieZnajomego(z: Pick<ZnajomyLite, "display_name" | "username">): string {
  return (z.display_name?.trim() || z.username?.trim() || "Znajomy").split(/\s+/)[0];
}

/**
 * placeId -> znajomi, którzy oznaczyli lokal jako "chcę odwiedzić".
 * Jedno zapytanie na całą talię (znajomi -> ich "chcę" -> profile), a nie
 * osobne pytanie o każdą kartę. Z tego bierze się plakietka na karcie i ekran
 * "Match ze znajomymi".
 */
export function useZnajomiChcacy() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["friends-want-map", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, ZnajomyLite[]>> => {
      const { data: fs, error: fErr } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted");
      if (fErr) throw fErr;
      const ids = (fs ?? [])
        .map((f) => (f.requester_id === user!.id ? f.addressee_id : f.requester_id))
        .filter((id): id is string => !!id);
      const wynik = new Map<string, ZnajomyLite[]>();
      if (ids.length === 0) return wynik;

      const { data: wants, error } = await supabase
        .from("place_visits")
        .select("place_id, user_id")
        .eq("status", "want")
        .in("user_id", ids);
      if (error) throw error;
      const uzytkownicy = [...new Set((wants ?? []).map((w) => w.user_id))];
      if (uzytkownicy.length === 0) return wynik;

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, avatar_source")
        .in("id", uzytkownicy);
      if (pErr) throw pErr;
      const wgId = new Map(
        (profile ?? []).map((p) => [
          p.id,
          {
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            avatar_source: p.avatar_source as ZnajomyLite["avatar_source"],
          } satisfies ZnajomyLite,
        ]),
      );
      for (const w of wants ?? []) {
        const z = wgId.get(w.user_id);
        if (!z) continue;
        const lista = wynik.get(w.place_id) ?? [];
        lista.push(z);
        wynik.set(w.place_id, lista);
      }
      return wynik;
    },
  });
}

/** Powiadomienie do znajomych, którzy też chcą ten lokal (RPC propose_outing). */
export function useProponujWyjscie() {
  return useMutation({
    mutationFn: async (placeId: string): Promise<number> => {
      const { data, error } = await supabase.rpc("propose_outing", { _place_id: placeId });
      if (error) throw error;
      return data ?? 0;
    },
  });
}
