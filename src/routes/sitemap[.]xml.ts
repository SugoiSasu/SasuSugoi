import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { BASE_URL } from "@/lib/site-config";


interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/mapa", changefreq: "weekly", priority: "0.9" },
          { path: "/u", changefreq: "weekly", priority: "0.5" },
          { path: "/wall", changefreq: "daily", priority: "0.5" },
          { path: "/osiagniecia", changefreq: "monthly", priority: "0.4" },
          { path: "/warte-pozarcia", changefreq: "weekly", priority: "0.5" },
          { path: "/blog", changefreq: "weekly", priority: "0.5" },
          { path: "/wspolpraca", changefreq: "monthly", priority: "0.6" },
          { path: "/regulamin", changefreq: "yearly", priority: "0.3" },
          { path: "/polityka-prywatnosci", changefreq: "yearly", priority: "0.3" },
          { path: "/auth", changefreq: "yearly", priority: "0.3" },
        ];

        // Dynamic content: places + published blog posts
        try {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
          );

          const { data: places } = await supabase
            .from("places")
            .select("id, updated_at");

          for (const k of places ?? []) {
            entries.push({
              path: `/k/${k.id}`,
              lastmod: k.updated_at?.slice(0, 10),
              changefreq: "monthly",
              priority: "0.6",
            });
          }

          const { data: posts } = await supabase
            .from("blog_posts")
            .select("slug, updated_at")
            .eq("status", "published");

          for (const p of posts ?? []) {
            entries.push({
              path: `/blog/${p.slug}`,
              lastmod: p.updated_at?.slice(0, 10),
              changefreq: "monthly",
              priority: "0.5",
            });
          }
        } catch {
          // If DB unreachable at build/runtime, still serve the static routes.
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
