import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ url: z.string().trim().url().max(500) });

/**
 * Official Instagram oEmbed HTML for a public post/reel URL, fetched
 * server-side. Meta removed the access-token/App-Review requirement for
 * this endpoint in June 2026 - no credentials needed.
 */
export const getInstagramEmbed = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const u = new URL(data.url);
    if (!u.hostname.endsWith("instagram.com")) {
      throw new Error("To nie jest link do Instagrama.");
    }
    const oembedUrl = `https://graph.facebook.com/v19.0/instagram_oembed?omitscript=true&url=${encodeURIComponent(data.url)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) {
      throw new Error("Nie udało się pobrać podglądu z Instagrama.");
    }
    const json = (await res.json()) as { html?: string };
    if (!json.html) {
      throw new Error("Instagram nie zwrócił podglądu dla tego linku.");
    }
    return { html: json.html };
  });
