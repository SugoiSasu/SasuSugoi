import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { OpeningHours } from "@/lib/places-api";

// Poznań city center — biases results without excluding matches elsewhere.
const POZNAN_CENTER = { latitude: 52.4082, longitude: 16.9335 };

async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
  if (!isAdmin) throw new Error("Forbidden: admin only");
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
}

export const searchGooglePlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(2).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<PlaceSearchResult[]> => {
    await requireAdmin(context.supabase, context.userId);

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("Brak GOOGLE_PLACES_API_KEY na serwerze.");

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: data.query,
        languageCode: "pl",
        locationBias: { circle: { center: POZNAN_CENTER, radius: 20000 } },
        maxResultCount: 8,
      }),
    });
    const json = (await res.json()) as {
      places?: Array<{ id: string; displayName?: { text?: string }; formattedAddress?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message ?? `Google Places ${res.status}`);

    return (json.places ?? []).map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
    }));
  });

export interface PlaceDetailsResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  priceRange: string | null;
  openingHours: OpeningHours | null;
}

const GOOGLE_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const PRICE_LEVEL_MAP: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function mapOpeningHours(
  periods:
    | Array<{
        open?: { day: number; hour: number; minute: number };
        close?: { day: number; hour: number; minute: number };
      }>
    | undefined,
): OpeningHours | null {
  if (!periods?.length) return null;
  const hours: OpeningHours = {};
  for (const period of periods) {
    if (!period.open || !period.close) continue;
    const key = GOOGLE_DAY_KEYS[period.open.day];
    if (!key || hours[key]) continue; // keep first interval per day (our model doesn't support split hours)
    hours[key] = {
      open: `${pad2(period.open.hour)}:${pad2(period.open.minute)}`,
      close: `${pad2(period.close.hour)}:${pad2(period.close.minute)}`,
    };
  }
  return Object.keys(hours).length ? hours : null;
}

export const getGooglePlaceDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ placeId: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<PlaceDetailsResult> => {
    await requireAdmin(context.supabase, context.userId);

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("Brak GOOGLE_PLACES_API_KEY na serwerze.");

    const fields = [
      "displayName",
      "formattedAddress",
      "location",
      "internationalPhoneNumber",
      "websiteUri",
      "priceLevel",
      "regularOpeningHours",
    ].join(",");
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(data.placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fields,
        },
      },
    );
    const json = (await res.json()) as {
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      internationalPhoneNumber?: string;
      websiteUri?: string;
      priceLevel?: string;
      regularOpeningHours?: {
        periods?: Array<{
          open?: { day: number; hour: number; minute: number };
          close?: { day: number; hour: number; minute: number };
        }>;
      };
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message ?? `Google Places ${res.status}`);

    return {
      name: json.displayName?.text ?? "",
      address: json.formattedAddress ?? "",
      lat: json.location?.latitude ?? POZNAN_CENTER.latitude,
      lng: json.location?.longitude ?? POZNAN_CENTER.longitude,
      phone: json.internationalPhoneNumber ?? null,
      website: json.websiteUri ?? null,
      priceRange: json.priceLevel ? (PRICE_LEVEL_MAP[json.priceLevel] ?? null) : null,
      openingHours: mapOpeningHours(json.regularOpeningHours?.periods),
    };
  });
