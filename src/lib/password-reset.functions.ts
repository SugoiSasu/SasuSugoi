import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createRateLimiter } from "@/lib/rate-limit";

// Two independent limiters: per-email (stop one victim being email-bombed
// from many IPs) and per-IP (stop one attacker sweeping many addresses).
// Reset requests are rarer and more sensitive than typical API traffic
// (each one sends a real email), so both windows are much stricter than
// the general /mcp rate limit.
const isEmailRateLimited = createRateLimiter(15 * 60_000, 3);
const isIpRateLimited = createRateLimiter(10 * 60_000, 5);

const schema = z.object({ email: z.string().trim().email().max(255) });

/**
 * Proxies supabase.auth.resetPasswordForEmail() through our own server
 * function instead of calling it directly from the browser, so we can add a
 * rate limit Supabase's own (unknown, dashboard-configured) throttle isn't
 * reliably enforcing - direct testing showed 6 rapid identical requests all
 * succeeding with no pushback.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip =
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request?.headers.get("x-real-ip") ??
      "unknown";

    const emailKey = data.email.toLowerCase();
    // Always tick both limiters (never short-circuit) so the response timing
    // doesn't itself leak which check tripped.
    const emailLimited = isEmailRateLimited(emailKey);
    const ipLimited = isIpRateLimited(ip);
    if (emailLimited || ipLimited) {
      // Same generic outcome as a normal call - never reveal that this
      // specific request was throttled vs. just quietly "sent".
      return { ok: true as const };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${new URL(request!.url).origin}/auth/confirm`,
    });
    // Ignore the error deliberately - same anti-enumeration reasoning as the
    // client UI: never tell the caller whether the address exists.
    return { ok: true as const };
  });
