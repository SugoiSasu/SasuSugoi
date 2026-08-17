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

export function useSubmitPlaceSuggestion() {
  return useMutation({
    mutationFn: async (values: PlaceSuggestionInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("place_suggestions").insert({
        ...values,
        submitted_by: user?.id ?? null,
      });
      if (error) throw error;
    },
  });
}

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

export function useUpdateSuggestionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, status, approved_place_id,
    }: { id: string; status: "approved" | "rejected"; approved_place_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("place_suggestions").update({
        status,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        approved_place_id: approved_place_id ?? null,
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
