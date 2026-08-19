import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlaceSuggestion {
  id: string;
  name: string;
  address: string | null;
  cuisine: string | null;
  website: string | null;
  instagram: string | null;
  notes: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  submitted_by: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_place_id: string | null;
  created_at: string;
}

export type PlaceSuggestionInput = {
  name: string;
  address?: string;
  cuisine?: string;
  website?: string;
  instagram?: string;
  notes?: string;
  submitter_name?: string;
  submitter_email?: string;
};

export function usePlaceSuggestions() {
  return useQuery({
    queryKey: ["place-suggestions"],
    queryFn: async (): Promise<PlaceSuggestion[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("place_suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlaceSuggestion[];
    },
  });
}

/** Approves a suggestion by creating an unpublished draft place from it (to
 * finish in the Lokale tab), then marking the suggestion approved. */
export function useApproveSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: PlaceSuggestion): Promise<string | undefined> => {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: insertError } = await (supabase as any)
        .from("places")
        .insert({
          name: s.name,
          cuisine: s.cuisine || "Inna",
          address: s.address || "",
          description: s.notes || "",
          website: s.website || null,
          instagram: s.instagram || null,
          lat: 52.4082,
          lng: 16.9335,
          is_published: false,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      const approvedPlaceId: string | undefined = created?.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any).from("place_suggestions").update({
        status: "approved",
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        approved_place_id: approvedPlaceId ?? null,
      }).eq("id", s.id);
      if (updateError) throw updateError;
      return approvedPlaceId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-suggestions"] }),
  });
}

export function useRejectSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("place_suggestions").update({
        status: "rejected",
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        approved_place_id: null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-suggestions"] }),
  });
}

export function useDeleteSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("place_suggestions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-suggestions"] }),
  });
}
