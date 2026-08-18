import { randomBytes, createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/tiktok-oauth-start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const adminSecret = process.env.TIKTOK_OAUTH_ADMIN_SECRET;
        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const redirectUri = process.env.TIKTOK_REDIRECT_URI;
        if (!adminSecret || !clientKey || !redirectUri) {
          return new Response("Brak konfiguracji TikTok OAuth na serwerze.", { status: 500 });
        }

        const url = new URL(request.url);
        if (url.searchParams.get("secret") !== adminSecret) {
          return new Response("Forbidden", { status: 403 });
        }

        const codeVerifier = randomBytes(64).toString("base64url");
        const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
        const state = randomBytes(24).toString("base64url");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Single-use, short-lived: consumed (and expiry-checked) by the callback.
        await supabaseAdmin.from("tiktok_oauth_flow").delete().lt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
        const { error } = await supabaseAdmin
          .from("tiktok_oauth_flow")
          .insert({ state, code_verifier: codeVerifier });
        if (error) return new Response(`Nie udało się zainicjować OAuth: ${error.message}`, { status: 500 });

        const authorizeUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
        authorizeUrl.searchParams.set("client_key", clientKey);
        authorizeUrl.searchParams.set("scope", "user.info.basic,user.info.stats");
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("redirect_uri", redirectUri);
        authorizeUrl.searchParams.set("state", state);
        authorizeUrl.searchParams.set("code_challenge", codeChallenge);
        authorizeUrl.searchParams.set("code_challenge_method", "S256");

        return Response.redirect(authorizeUrl.toString(), 302);
      },
    },
  },
});
