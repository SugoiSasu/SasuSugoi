import { createFileRoute } from "@tanstack/react-router";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Platform = "instagram" | "facebook" | "youtube" | "tiktok";
interface FetchResult {
  followers: number | null;
  posts: number | null;
  extra?: Record<string, unknown>;
}

function parseIntLoose(s: string | null | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[\s\u00a0.,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// --- YouTube: scrape public /about page (no API key needed) ---
async function scrapeYouTube(handle: string): Promise<FetchResult> {
  const h = handle.replace(/^@/, "");
  const url = `https://www.youtube.com/@${encodeURIComponent(h)}/about`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`YouTube scrape ${res.status}`);
  const html = await res.text();
  // Try several patterns
  const sub =
    html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/)?.[1] ||
    html.match(/(\d[\d,.\s]*[KkMm]?)\s*subscribers?/)?.[1] ||
    null;
  const videos =
    html.match(/"videosCountText":\{"runs":\[\{"text":"([^"]+)"/)?.[1] ||
    html.match(/(\d[\d,.\s]*)\s*videos?/)?.[1] ||
    null;
  const views =
    html.match(/"viewCountText":\{"simpleText":"([^"]+)"/)?.[1] || null;

  // Handle suffixes K/M
  const parseFlex = (s: string | null): number | null => {
    if (!s) return null;
    const m = s.match(/([\d.,]+)\s*([KkMm])?/);
    if (!m) return null;
    const base = Number(m[1].replace(/[,\s]/g, ""));
    if (!Number.isFinite(base)) return null;
    const suffix = m[2];
    if (suffix === "K" || suffix === "k") return Math.round(base * 1000);
    if (suffix === "M" || suffix === "m") return Math.round(base * 1_000_000);
    return Math.round(base);
  };

  return {
    followers: parseFlex(sub),
    posts: parseFlex(videos),
    extra: { view_count_text: views },
  };
}

// --- Instagram: try web_profile_info (often blocked from datacenter IPs) ---
async function scrapeInstagram(handle: string): Promise<FetchResult> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "x-ig-app-id": "936619743392459",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Instagram scrape ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      user?: {
        edge_followed_by?: { count?: number };
        edge_owner_to_timeline_media?: {
          count?: number;
          edges?: Array<{ node?: { shortcode?: string; product_type?: string; is_video?: boolean } }>;
        };
        edge_follow?: { count?: number };
      };
    };
  };
  const u = json.data?.user;
  const edges = u?.edge_owner_to_timeline_media?.edges ?? [];
  // Prefer reels (product_type === 'clips'), fall back to any video, then first post.
  const reelEdge =
    edges.find((e) => e.node?.product_type === "clips") ||
    edges.find((e) => e.node?.is_video) ||
    edges[0];
  const shortcode = reelEdge?.node?.shortcode ?? null;
  const latestReelUrl = shortcode ? `https://www.instagram.com/reel/${shortcode}/` : null;
  return {
    followers: u?.edge_followed_by?.count ?? null,
    posts: u?.edge_owner_to_timeline_media?.count ?? null,
    extra: { following: u?.edge_follow?.count ?? null, latest_reel_url: latestReelUrl },
  };
}


// --- Facebook: prefer Graph API if token set (works), fallback scrape og:description ---
async function fetchFacebook(handle: string): Promise<FetchResult> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (token && pageId) {
    const url = `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count&access_token=${token}`;
    const res = await fetch(url);
    if (res.ok) {
      const d = (await res.json()) as { followers_count?: number; fan_count?: number };
      return {
        followers: d.followers_count ?? d.fan_count ?? null,
        posts: null,
        extra: { source: "graph" },
      };
    }
  }
  // Fallback: scrape multiple public surfaces and parse common patterns.
  const cleanHandle = handle.replace(/^@/, "").replace(/^https?:\/\/(?:www\.|m\.|mbasic\.)?facebook\.com\//i, "").replace(/\/$/, "");
  const candidates = [
    `https://www.facebook.com/${cleanHandle}/`,
    `https://m.facebook.com/${cleanHandle}/`,
    `https://mbasic.facebook.com/${cleanHandle}`,
  ];
  const patterns: RegExp[] = [
    /"follower_count":(\d+)/i,
    /"followers_count":(\d+)/i,
    /([\d,.\s\u00a0]+)\s*(?:obserwuj(?:ących|e|ą)|followers?|people follow this)/i,
    /([\d,.\s\u00a0]+)\s*(?:osób lubi to|likes|polubień)/i,
    /content="[^"]*?·\s*([\d,.\s\u00a0]+)\s*(?:obserwujących|followers)[^"]*"/i,
  ];
  let firstError: string | null = null;
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8" } });
      if (!r.ok) { firstError ??= `${url} → ${r.status}`; continue; }
      const html = await r.text();
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) {
          const n = parseIntLoose(m[1]);
          if (n && n > 0) {
            return { followers: n, posts: null, extra: { source: url } };
          }
        }
      }
    } catch (e) {
      firstError ??= e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(
    `Facebook: nie udało się odczytać liczby obserwujących (FB blokuje publiczny scraping z serwera). ` +
    `Dodaj FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID (Graph API) w sekretach. ` +
    (firstError ? `Pierwszy błąd: ${firstError}` : ""),
  );
}

// --- TikTok: real Login Kit OAuth (user must connect once via /api/public/hooks/tiktok-oauth-start) ---
async function getValidTikTokAccessToken(): Promise<string> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error("Brak TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tokenRow, error } = await supabaseAdmin
    .from("tiktok_oauth_tokens")
    .select("access_token, refresh_token, expires_at, refresh_expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`TikTok token lookup: ${error.message}`);
  if (!tokenRow) {
    throw new Error(
      "TikTok nie jest połączony. Odwiedź /api/public/hooks/tiktok-oauth-start?secret=... aby połączyć konto.",
    );
  }

  const now = Date.now();
  // Refresh a bit early (60s) so the sync call itself never races an expiring token.
  if (new Date(tokenRow.expires_at).getTime() - now > 60_000) {
    return tokenRow.access_token;
  }
  if (new Date(tokenRow.refresh_expires_at).getTime() <= now) {
    throw new Error(
      "Token odświeżający TikToka wygasł. Odwiedź /api/public/hooks/tiktok-oauth-start?secret=... aby połączyć konto ponownie.",
    );
  }

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(`TikTok refresh: ${json.error_description ?? json.error ?? res.status}`);
  }

  await supabaseAdmin
    .from("tiktok_oauth_tokens")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: new Date(now + (json.expires_in ?? 0) * 1000).toISOString(),
      refresh_expires_at: new Date(now + (json.refresh_expires_in ?? 0) * 1000).toISOString(),
    })
    .eq("id", 1);

  return json.access_token;
}

async function fetchTikTok(): Promise<FetchResult> {
  const accessToken = await getValidTikTokAccessToken();
  const res = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,video_count,likes_count",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`TikTok ${res.status}`);
  const j = (await res.json()) as {
    data?: { user?: { follower_count?: number; video_count?: number; likes_count?: number } };
    error?: { code?: string; message?: string };
  };
  if (j.error && j.error.code !== "ok") throw new Error(`TikTok: ${j.error.message ?? j.error.code}`);
  const u = j.data?.user;
  return {
    followers: u?.follower_count ?? null,
    posts: u?.video_count ?? null,
    extra: { likes_count: u?.likes_count ?? null },
  };
}

async function runPlatform(
  platform: Platform,
  handle: string,
): Promise<FetchResult> {
  switch (platform) {
    case "youtube":
      return scrapeYouTube(handle);
    case "instagram":
      return scrapeInstagram(handle);
    case "facebook":
      return fetchFacebook(handle);
    case "tiktok":
      return fetchTikTok();
  }
}

export const Route = createFileRoute("/api/public/hooks/social-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows, error } = await supabaseAdmin
          .from("social_accounts")
          .select("*")
          .eq("is_active", true);
        if (error)
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const results: Array<{ platform: string; ok: boolean; error?: string; followers?: number | null }> = [];
        for (const row of rows ?? []) {
          try {
            const r = await runPlatform(row.platform as Platform, row.handle);
            await supabaseAdmin
              .from("social_accounts")
              .update({
                followers_count: r.followers,
                posts_count: r.posts,
                extra: (r.extra ?? {}) as never,
                last_synced_at: new Date().toISOString(),
                last_sync_error: null,
              })
              .eq("platform", row.platform);
            results.push({ platform: row.platform, ok: true, followers: r.followers });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await supabaseAdmin
              .from("social_accounts")
              .update({ last_sync_error: msg, last_synced_at: new Date().toISOString() })
              .eq("platform", row.platform);
            results.push({ platform: row.platform, ok: false, error: msg });
          }
        }

        return new Response(JSON.stringify({ results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "POST to trigger sync" }), {
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
