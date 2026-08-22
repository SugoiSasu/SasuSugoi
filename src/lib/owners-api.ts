import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";
import {
  submitOwnerRequest,
  approveOwnerRequest,
  rejectOwnerRequest,
} from "./owners.functions";

export interface PlaceOwner {
  id: string;
  user_id: string;
  place_id: string;
  verified: boolean;
  created_at: string;
}

export interface OwnerRequest {
  id: string;
  place_id: string;
  user_id: string | null;
  name: string;
  email: string;
  instagram_url: string | null;
  website_url: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  place?: { id: string; name: string; slug: string } | null;
}

/** Verified owner (jeżeli jest) dla knajpy - publiczne, na odznakę. */
export function usePlaceOwner(placeId: string) {
  return useQuery({
    queryKey: ["place-owner", placeId],
    enabled: !!placeId,
    queryFn: async (): Promise<PlaceOwner | null> => {
      const { data, error } = await supabase
        .from("place_owners")
        .select("*")
        .eq("place_id", placeId)
        .eq("verified", true)
        .maybeSingle();
      if (error) throw error;
      return (data as PlaceOwner | null) ?? null;
    },
  });
}

/** Czy zalogowany user jest zweryfikowanym właścicielem danej knajpy. */
export function useIsOwnerOf(placeId: string) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["is-owner-of", placeId, user?.id ?? null],
    enabled: !!user && !!placeId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("place_owners")
        .select("id")
        .eq("place_id", placeId)
        .eq("user_id", user!.id)
        .eq("verified", true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

/** Wszystkie knajpy, których zalogowany user jest właścicielem. */
export function useMyOwnedPlaces() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-owned-places", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("place_owners")
        .select("id, verified, place:places(id, slug, name, cover_image_url, cuisine)")
        .eq("user_id", user!.id)
        .eq("verified", true);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        verified: boolean;
        place: { id: string; slug: string; name: string; cover_image_url: string | null; cuisine: string } | null;
      }>;
    },
  });
}

/** Ostatnie zgłoszenie właściciela tego użytkownika dla knajpy - do stanu formularza. */
export function useMyOwnerRequestFor(placeId: string) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-owner-request", placeId, user?.id ?? null],
    enabled: !!user && !!placeId,
    queryFn: async (): Promise<OwnerRequest | null> => {
      const { data, error } = await supabase
        .from("owner_requests")
        .select("*")
        .eq("place_id", placeId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as OwnerRequest | null) ?? null;
    },
  });
}

export function useSubmitOwnerRequest() {
  const qc = useQueryClient();
  const fn = useServerFn(submitOwnerRequest);
  return useMutation({
    mutationFn: (data: {
      placeId: string;
      name: string;
      email: string;
      instagram_url?: string;
      website_url?: string;
      message?: string;
    }) => fn({ data }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["my-owner-request", vars.placeId] });
    },
  });
}

/* -------- ADMIN -------- */
export function useAdminOwnerRequests(status: "pending" | "approved" | "rejected" | "all" = "pending") {
  return useQuery({
    queryKey: ["admin-owner-requests", status],
    queryFn: async (): Promise<OwnerRequest[]> => {
      let q = supabase
        .from("owner_requests")
        .select("*, place:places(id, name, slug)")
        .order("created_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OwnerRequest[];
    },
  });
}

export function useApproveOwnerRequest() {
  const qc = useQueryClient();
  const fn = useServerFn(approveOwnerRequest);
  return useMutation({
    mutationFn: (requestId: string) => fn({ data: { requestId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-owner-requests"] });
      qc.invalidateQueries({ queryKey: ["place-owner"] });
      qc.invalidateQueries({ queryKey: ["is-owner-of"] });
    },
  });
}

export function useRejectOwnerRequest() {
  const qc = useQueryClient();
  const fn = useServerFn(rejectOwnerRequest);
  return useMutation({
    mutationFn: (requestId: string) => fn({ data: { requestId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-owner-requests"] }),
  });
}
