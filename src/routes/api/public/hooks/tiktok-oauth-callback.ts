import { createFileRoute } from "@tanstack/react-router";

function htmlResult(title: string, body: string, ok: boolean) {
  return new Response(
    `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;text-align:center">` +
      `<h1>${title}</h1><p>${body}</p></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/hooks/tiktok-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const oauthError = url.searchParams.get("error");
        if (oauthError) {
          return htmlResult("TikTok — odmowa autoryzacji", url.searchParams.get("error_description") ?? oauthError, false);
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return htmlResult("TikTok — błąd", "Brak parametru code lub state w odpowiedzi TikToka.", false);
        }

        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
        const redirectUri = process.env.TIKTOK_REDIRECT_URI;
        if (!clientKey || !clientSecret || !redirectUri) {
          return htmlResult("TikTok — błąd konfiguracji", "Brak TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI na serwerze.", false);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: flow, error: flowError } = await supabaseAdmin
          .from("tiktok_oauth_flow")
          .select("code_verifier, created_at")
          .eq("state", state)
          .maybeSingle();
        if (flowError || !flow) {
          return htmlResult("TikTok — błąd", "Nieznany lub wygasły stan OAuth. Spróbuj połączyć konto ponownie.", false);
        }
        await supabaseAdmin.from("tiktok_oauth_flow").delete().eq("state", state);

        const isExpired = Date.now() - new Date(flow.created_at).getTime() > 10 * 60_000;
        if (isExpired) {
          return htmlResult("TikTok — błąd", "Link do autoryzacji wygasł (limit 10 minut). Spróbuj ponownie.", false);
        }

        const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
          },
          body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code_verifier: flow.code_verifier,
          }),
        });
        const tokenJson = (await tokenRes.json()) as {
          access_token?: string;
          expires_in?: number;
          refresh_token?: string;
          refresh_expires_in?: number;
          open_id?: string;
          scope?: string;
          error?: string;
          error_description?: string;
        };
        if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token) {
          return htmlResult(
            "TikTok — błąd wymiany tokenu",
            tokenJson.error_description ?? tokenJson.error ?? `HTTP ${tokenRes.status}`,
            false,
          );
        }

        const now = Date.now();
        const { error: upsertError } = await supabaseAdmin.from("tiktok_oauth_tokens").upsert({
          id: 1,
          open_id: tokenJson.open_id ?? null,
          scope: tokenJson.scope ?? null,
          access_token: tokenJson.access_token,
          refresh_token: tokenJson.refresh_token,
          expires_at: new Date(now + (tokenJson.expires_in ?? 0) * 1000).toISOString(),
          refresh_expires_at: new Date(now + (tokenJson.refresh_expires_in ?? 0) * 1000).toISOString(),
        });
        if (upsertError) {
          return htmlResult("TikTok — błąd zapisu", upsertError.message, false);
        }

        return htmlResult(
          "TikTok połączony ✓",
          "Konto TikTok zostało połączone. Synchronizacja followersów/postów zadziała przy najbliższym uruchomieniu social-sync.",
          true,
        );
      },
    },
  },
});
