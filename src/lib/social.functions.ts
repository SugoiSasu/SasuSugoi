import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CACHE_MS = 48 * 60 * 60 * 1000;

const platformSchema = z.enum(["instagram", "tiktok", "youtube", "facebook"]);

const refreshSchema = z.object({
  platform: platformSchema,
  force: z.boolean().optional(),
});

interface FetchResult {
  followers: number | null;
  posts: number | null;
  extra?: Record<string, unknown>;
}

async function fetchInstagram(): Promise<FetchResult> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) {
    throw new Error(
      "Brak INSTAGRAM_ACCESS_TOKEN lub INSTAGRAM_USER_ID. Dodaj je w sekretach (Meta Graph API, IG Business Account).",
    );
  }
  const url = `https://graph.facebook.com/v21.0/${userId}?fields=followers_count,media_count&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { followers_count?: number; media_count?: number };
  return { followers: data.followers_count ?? null, posts: data.media_count ?? null };
}

async function fetchTikTok(): Promise<FetchResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const tiktokKey = process.env.TIKTOK_API_KEY;
  if (!lovableKey || !tiktokKey) {
    throw new Error(
      "Brak TIKTOK_API_KEY. Podłącz konektor TikTok przez panel (Lovable connector → TikTok).",
    );
  }
  const url =
    "https://connector-gateway.lovable.dev/tiktok/user/info/?fields=open_id,display_name,follower_count,video_count,likes_count";
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": tiktokKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TikTok API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: { user?: { follower_count?: number; video_count?: number; likes_count?: number } };
  };
  const u = json.data?.user;
  return {
    followers: u?.follower_count ?? null,
    posts: u?.video_count ?? null,
    extra: { likes_count: u?.likes_count ?? null },
  };
}

async function fetchYouTube(handle: string): Promise<FetchResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("Brak YOUTUBE_API_KEY w sekretach.");
  // forHandle accepts @handle; strip leading @
  const h = handle.replace(/^@/, "");
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(h)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    items?: Array<{ statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string } }>;
  };
  const s = json.items?.[0]?.statistics;
  return {
    followers: s?.subscriberCount ? Number(s.subscriberCount) : null,
    posts: s?.videoCount ? Number(s.videoCount) : null,
    extra: { view_count: s?.viewCount ? Number(s.viewCount) : null },
  };
}

async function fetchFacebook(): Promise<FetchResult> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) {
    throw new Error("Brak FACEBOOK_PAGE_ACCESS_TOKEN lub FACEBOOK_PAGE_ID w sekretach.");
  }
  const url = `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Facebook API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { followers_count?: number; fan_count?: number };
  return {
    followers: data.followers_count ?? data.fan_count ?? null,
    posts: null,
  };
}

/** Super-admin only. Refreshes metrics if cache > 48h (or force=true). */
export const refreshSocialMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => refreshSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Authorize: super_admin only (inline role check)
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Tylko Super Admin może odświeżać metryki.");


    // Load current row
    const { data: row, error: selErr } = await context.supabase
      .from("social_accounts")
      .select("*")
      .eq("platform", data.platform)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Konto nie istnieje. Najpierw dodaj handle.");

    // Cache check
    if (!data.force && row.last_synced_at) {
      const age = Date.now() - new Date(row.last_synced_at).getTime();
      if (age < CACHE_MS) {
        return { cached: true, ageMinutes: Math.round(age / 60000), row };
      }
    }

    // Fetch from provider
    let result: FetchResult;
    try {
      switch (data.platform) {
        case "instagram":
          result = await fetchInstagram();
          break;
        case "tiktok":
          result = await fetchTikTok();
          break;
        case "youtube":
          result = await fetchYouTube(row.handle);
          break;
        case "facebook":
          result = await fetchFacebook();
          break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await context.supabase
        .from("social_accounts")
        .update({ last_sync_error: msg, last_synced_at: new Date().toISOString() })
        .eq("platform", data.platform);
      throw new Error(msg);
    }

    // Persist
    const { data: updated, error: upErr } = await context.supabase
      .from("social_accounts")
      .update({
        followers_count: result.followers,
        posts_count: result.posts,
        extra: (result.extra ?? {}) as never,
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("platform", data.platform)
      .select()
      .single();
    if (upErr) throw new Error(upErr.message);

    return { cached: false, ageMinutes: 0, row: updated };
  });
