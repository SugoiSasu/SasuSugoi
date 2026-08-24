import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface AwardsEvent {
  id: string;
  name: string;
  status: "draft" | "active" | "closed";
  cuisine_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface AwardWinner {
  id: string;
  event_id: string;
  cuisine_id: string;
  place_id: string;
  vote_count: number;
}

/** Public: the event worth showing right now - most recent active or closed one. Drives nav visibility. */
export function useCurrentAwardsEvent() {
  return useQuery({
    queryKey: ["awards-event-current"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("awards_events")
        .select("*")
        .in("status", ["active", "closed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AwardsEvent | null;
    },
    staleTime: 60_000,
  });
}

/** Admin: every event, newest first. */
export function useAdminAwardsEvents() {
  return useQuery({
    queryKey: ["awards-events-admin"],
    queryFn: async () => {
      const { data, error } = await sb.from("awards_events").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AwardsEvent[];
    },
  });
}

export function useCreateAwardsEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; cuisineIds: string[] }) => {
      const { error } = await sb.from("awards_events").insert({ name: input.name, cuisine_ids: input.cuisineIds });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["awards-events-admin"] }),
  });
}

export function useActivateAwardsEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await sb.from("awards_events").update({ status: "active" }).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["awards-events-admin"] });
      qc.invalidateQueries({ queryKey: ["awards-event-current"] });
    },
  });
}

export function useCloseAwardsEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await sb.rpc("close_awards_event", { _event_id: eventId });
      if (error) throw error;
    },
    onSuccess: (_data: unknown, eventId: string) => {
      qc.invalidateQueries({ queryKey: ["awards-events-admin"] });
      qc.invalidateQueries({ queryKey: ["awards-event-current"] });
      qc.invalidateQueries({ queryKey: ["award-winners", eventId] });
    },
  });
}

/** Admin monitoring: live vote counts for one event while it's still active - "cuisineId:placeId" -> count. */
export function useAwardsEventTally(eventId: string | null) {
  return useQuery({
    queryKey: ["awards-event-tally", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await sb.from("award_votes").select("cuisine_id, place_id").eq("event_id", eventId);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const key = `${row.cuisine_id}:${row.place_id}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return counts;
    },
  });
}

/** The logged-in user's own ballot for one event: cuisine_id -> place_id. */
export function useMyAwardVotes(eventId: string | null) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-award-votes", eventId, user?.id ?? null],
    enabled: !!eventId && !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("award_votes")
        .select("cuisine_id, place_id")
        .eq("event_id", eventId)
        .eq("user_id", user!.id);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) map.set(row.cuisine_id, row.place_id);
      return map;
    },
  });
}

/** Has this account already sent its final ballot for this event? Once true,
 * voting is locked for them - submit_award_ballot() refuses a second call. */
export function useHasSubmittedBallot(eventId: string | null) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["award-ballot-submitted", eventId, user?.id ?? null],
    enabled: !!eventId && !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("award_ballots")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

const BALLOT_ERROR_MESSAGES: Record<string, string> = {
  auth_required: "Musisz być zalogowany.",
  event_not_found: "Wydarzenie nie istnieje.",
  event_not_active: "Głosowanie jest zamknięte.",
  already_submitted: "Już wysłałeś swoje głosy - można to zrobić tylko raz.",
  invalid_pick: "Wybierz lokal w każdej kategorii.",
};

/** Sends every pick at once and permanently locks this account's ballot for
 * the event - there's no per-category autosave anymore, just this one shot. */
export function useSubmitAwardBallot(eventId: string) {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async (picks: Array<{ cuisineId: string; placeId: string }>) => {
      if (!user) throw new Error("Musisz być zalogowany");
      const { error } = await sb.rpc("submit_award_ballot", {
        _event_id: eventId,
        _picks: picks.map((p) => ({ cuisine_id: p.cuisineId, place_id: p.placeId })),
      });
      if (error) throw new Error(BALLOT_ERROR_MESSAGES[error.message] ?? "Nie udało się wysłać głosów.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-award-votes", eventId] });
      qc.invalidateQueries({ queryKey: ["award-ballot-submitted", eventId] });
    },
  });
}

/** Public: frozen winners for one event, one per cuisine. */
export function useAwardWinners(eventId: string | null) {
  return useQuery({
    queryKey: ["award-winners", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("award_winners")
        .select("*, place:places(id, name, slug, avatar_url, cover_image_url), cuisine:cuisines(id, name, emoji, color)")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as Array<
        AwardWinner & {
          place: { id: string; name: string; slug: string | null; avatar_url: string | null; cover_image_url: string | null } | null;
          cuisine: { id: string; name: string; emoji: string | null; color: string | null } | null;
        }
      >;
    },
  });
}

/** Public: every award a place has ever won - profile badge. */
export function usePlaceAwardWins(placeId: string | null | undefined) {
  return useQuery({
    queryKey: ["place-award-wins", placeId ?? null],
    enabled: !!placeId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("award_winners")
        .select("id, vote_count, cuisine:cuisines(name), event:awards_events(name, closed_at)")
        .eq("place_id", placeId);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        vote_count: number;
        cuisine: { name: string } | null;
        event: { name: string; closed_at: string | null } | null;
      }>;
    },
  });
}
