import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Get-or-create the current user's active (non-expired, pending) invite link. */
export function useMyInviteLink(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-invite-link", userId ?? null],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string> => {
      const { data: existing, error: findErr } = await supabase
        .from("friend_invites")
        .select("token")
        .eq("inviter_id", userId!)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;
      if (existing?.token) return existing.token;

      const token = randomToken();
      const { error: insErr } = await supabase.from("friend_invites").insert({
        inviter_id: userId!,
        token,
      });
      if (insErr) throw insErr;
      return token;
    },
  });
}

export interface InvitePreview {
  inviter_display_name: string | null;
  inviter_username: string | null;
  inviter_avatar_url: string | null;
  status: string;
  expired: boolean;
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ["invite-preview", token ?? null],
    enabled: !!token,
    queryFn: async (): Promise<InvitePreview | null> => {
      const { data, error } = await supabase.rpc("get_invite_preview", { _token: token! });
      if (error) throw error;
      return (data?.[0] as InvitePreview | undefined) ?? null;
    },
  });
}

const ACCEPT_ERROR_MESSAGES: Record<string, string> = {
  invite_not_found: "Nie znaleźliśmy tego zaproszenia. Może link jest niepoprawny?",
  invite_used: "To zaproszenie zostało już wykorzystane.",
  invite_expired: "To zaproszenie już wygasło.",
  cannot_invite_self: "To Twój własny link zaproszenia — wyślij go znajomym!",
  blocked: "Nie można dołączyć do znajomych w tym przypadku.",
};

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase.rpc("accept_friend_invite", { _token: token });
      if (error) {
        const msg = ACCEPT_ERROR_MESSAGES[error.message] ?? "Nie udało się przyjąć zaproszenia.";
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend-profiles"] });
      qc.invalidateQueries({ queryKey: ["friend-leaderboard"] });
      qc.invalidateQueries({ queryKey: ["user-achievements"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
