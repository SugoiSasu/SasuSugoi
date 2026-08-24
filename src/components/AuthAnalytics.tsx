import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const SEEN_KEY = "pz_ga_auth_session_seen";

/** Singleton (mount once in __root.tsx) - fires GA4's recommended `sign_up`/
 * `login` events exactly once per real sign-in, for every auth method
 * (email, Google, Apple) from one place. Doing this centrally instead of in
 * each auth code path avoids two problems: useUser() sets up its own
 * onAuthStateChange subscription per call site (dozens of components use
 * it), so hooking tracking there would fire once per mounted component; and
 * email/password signup doesn't have an active session until the user
 * clicks the confirmation email, so the signup form's own submit handler
 * never actually observes a completed sign-up. */
export function AuthAnalytics() {
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      if (lastToken.current === session.access_token) return;
      lastToken.current = session.access_token;

      let seen: string | null = null;
      try {
        seen = sessionStorage.getItem(SEEN_KEY);
      } catch {
        /* sessionStorage unavailable (private mode etc.) - fall through, dedupe by ref only */
      }
      if (seen === session.access_token) return;
      try {
        sessionStorage.setItem(SEEN_KEY, session.access_token);
      } catch {
        /* non-fatal */
      }

      const user = session.user;
      const method = (user.app_metadata?.provider as string | undefined) ?? "email";
      const createdAt = new Date(user.created_at).getTime();
      const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : createdAt;
      const isNewSignup = Math.abs(lastSignInAt - createdAt) < 60_000;

      trackEvent(isNewSignup ? "sign_up" : "login", { method });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
