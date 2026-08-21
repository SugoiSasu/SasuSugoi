import { useEffect, useState } from "react";

export type LatLng = { lat: number; lng: number };

/** Haversine distance in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "1,2 km" / "850 m" - Polish formatting. */
export function formatDistancePl(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/**
 * Asks for the browser geolocation once on mount.
 * Returns null silently when unavailable, denied or timed out.
 */
export function useUserLocation(): LatLng | null {
  const [loc, setLoc] = useState<LatLng | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        /* denied / unavailable / timeout - stay null, no console noise */
      },
      { timeout: 5000, maximumAge: 300000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return loc;
}
