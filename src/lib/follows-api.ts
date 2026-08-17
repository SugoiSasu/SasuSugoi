import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/use-auth";

export function useMyFollowedPlaceIds() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-followed-place-ids", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("place_follows")
        .select("place_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.place_id);
    },
  });
}

export function useIsFollowing(placeId: string) {
  const { data: ids } = useMyFollowedPlaceIds();
  return (ids ?? []).includes(placeId);
}

export function useFollowCounts() {
  return useQuery({
    queryKey: ["place-follow-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("place_follows").select("place_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.place_id] = (counts[row.place_id] ?? 0) + 1;
      return counts;
    },
    staleTime: 30_000,
  });
}

export function useFollowCount(placeId: string) {
  const { data } = useFollowCounts();
  return data?.[placeId] ?? 0;
}

export function useToggleFollow() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: async ({ placeId, on }: { placeId: string; on: boolean }) => {
      if (!user) throw new Error("Musisz być zalogowany");
      if (on) {
        const { error } = await supabase
          .from("place_follows")
          .insert({ user_id: user.id, place_id: placeId });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("place_follows")
          .delete()
          .eq("user_id", user.id)
          .eq("place_id", placeId);
        if (error) throw error;
      }
    },
    onMutate: async ({ placeId, on }) => {
      await qc.cancelQueries({ queryKey: ["my-followed-place-ids"] });
      await qc.cancelQueries({ queryKey: ["place-follow-counts"] });
      const prevIds = qc.getQueryData<string[]>(["my-followed-place-ids", user?.id ?? null]);
      qc.setQueryData<string[]>(["my-followed-place-ids", user?.id ?? null], (cur) => {
        const list = cur ?? [];
        if (on) return list.includes(placeId) ? list : [...list, placeId];
        return list.filter((id) => id !== placeId);
      });
      const prevCounts = qc.getQueryData<Record<string, number>>(["place-follow-counts"]);
      qc.setQueryData<Record<string, number>>(["place-follow-counts"], (cur) => {
        const next = { ...(cur ?? {}) };
        next[placeId] = Math.max(0, (next[placeId] ?? 0) + (on ? 1 : -1));
        return next;
      });
      return { prevIds, prevCounts };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevIds) qc.setQueryData(["my-followed-place-ids", user?.id ?? null], ctx.prevIds);
      if (ctx?.prevCounts) qc.setQueryData(["place-follow-counts"], ctx.prevCounts);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-followed-place-ids"] });
      qc.invalidateQueries({ queryKey: ["place-follow-counts"] });
      qc.invalidateQueries({ queryKey: ["wall-feed"] });
    },
  });
}
