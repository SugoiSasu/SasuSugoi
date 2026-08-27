import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { cuisineMeta } from "@/data/places";
import type { Place } from "@/lib/places-api";
import { trackEvent } from "@/lib/analytics";
import { useUnlockManualAchievement } from "@/lib/achievements-api";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";


/** CARTO started watermarking unauthenticated raster tiles with "API KEY REQUIRED"
 *  burnt into the pixels, and its free key is aimed at non-commercial use. OpenFreeMap
 *  needs no key at all, sets no request limits, and allows commercial use outright.
 *  These are vector tiles, so the whole basemap restyles at runtime from one URL -
 *  which is what a light/dark switch needs. `fiord` is the dark counterpart and sits
 *  close to our own --navy. */
const BASEMAP_STYLE = {
  light: "/map/pozeramy-light.json",
  dark: "/map/pozeramy-dark.json",
} as const;
const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> ' +
  '&copy; <a href="https://openmaptiles.org">OpenMapTiles</a> ' +
  '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>';

interface Props {
  places: Place[];
  onSelect?: (p: Place) => void;
  focusPlaceId?: string | null;
  focusTick?: number;
  query?: string;
  /** "mini" = preview (profile page): no popup CTAs, no navigation on click, just pin highlight. */
  variant?: "full" | "mini";
  /** Real aggregated review ratings per place id. */
  ratings?: Map<string, { avg: number; count: number }>;
  /** Visitor's browser geolocation, if granted - shown as a pulsing "you are here" dot. */
  userLocation?: { lat: number; lng: number } | null;
  /** Fired when the visitor themselves pans/zooms - not when we fly to a pin.
   *  Drives the "Szukaj w tym obszarze" affordance in the parent. */
  onUserMove?: (bounds: MapBounds) => void;
  /** How many of my friends favourited each place - drawn as a badge on the pin. */
  friendCounts?: Map<string, number>;
  /** The area the visitor chose to search in, drawn on the map so the filter is
   *  visible rather than invisible state. Null means the whole city. */
  areaBounds?: MapBounds | null;
  /** Where to open the map, when we have somewhere better than the city centre.
   *  Applied once, and only while the visitor has not moved the map themselves. */
  autoCenter?: { lat: number; lng: number } | null;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export default function FoodMap({ places, onSelect, focusPlaceId, focusTick, query = "", variant = "full", ratings, userLocation, onUserMove, friendCounts, areaBounds, autoCenter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerByPlaceRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const youAreHereRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areaLayersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const glLayerRef = useRef<any>(null);

  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const userMoveRef = useRef(onUserMove);
  userMoveRef.current = onUserMove;
  // Leaflet reports "moveend" identically whether the visitor dragged the map
  // or we flew it to a pin. Only the former should offer to re-search, so we
  // mark our own moves and let the flag outlive the animation.
  const programmaticMoveRef = useRef(false);
  // Geolocation resolves after the map is already on screen, so recentring has to
  // stop the moment the visitor takes over - having the map jump out from under a
  // drag is worse than opening on the wrong part of town.
  const userMovedRef = useRef(false);
  const autoCenteredRef = useRef(false);

  const { resolved: theme } = useTheme();
  const unlockAchievement = useUnlockManualAchievement();
  const achievementTried = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current) return;
      const L = (await import("leaflet")).default;
      // The bridge augments the Leaflet namespace in place, so it has to land after
      // Leaflet itself. Both stay inside the effect to keep maplibre out of the SSR
      // pass and out of every chunk that is not the map.
      await import("maplibre-gl/dist/maplibre-gl.css");
      await import("@maplibre/maplibre-gl-leaflet");
      if (variant === "full") {
        await import("leaflet.markercluster");
      }
      if (cancelled || !containerRef.current) return;


      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          center: [52.4082, 16.9335],
          zoom: 13,
          // markercluster refuses to run on a map with no maxZoom, and it used to pick
          // one up from the raster tile layer. The vector layer supplies none, so the map
          // has to state it itself - otherwise every marker silently fails to attach.
          maxZoom: 19,
          scrollWheelZoom: false,
          doubleClickZoom: variant === "full",
          zoomControl: variant === "full",
          dragging: true,
          // Leaflet's `tap` handler improves touch responsiveness; typed via any to avoid TS DefinitelyTyped drift.
          ...({ tap: true, tapTolerance: 20 } as Record<string, unknown>),
        });
        mapRef.current = map;
        setMapReady(true);
        // Wheel zoom aktywne po kliknięciu / dotknięciu mapy; wyłącza się gdy mysz opuści mapę.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyMap = map as any;
        map.on("click focus", () => anyMap.scrollWheelZoom?.enable?.());
        map.on("mouseout blur", () => anyMap.scrollWheelZoom?.disable?.());
        map.on("moveend", () => {
          if (programmaticMoveRef.current) return;
          userMovedRef.current = true;
          const b = map.getBounds();
          userMoveRef.current?.({
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest(),
          });
        });
        glLayerRef.current = L.maplibreGL({ style: BASEMAP_STYLE[theme] }).addTo(map);
        // The bridge types only cover maplibre's own options, so attribution goes
        // through the control directly. OpenFreeMap requires it to stay visible.
        map.attributionControl.addAttribution(BASEMAP_ATTRIBUTION);
        // Three credits do not fit on a 375px screen next to Leaflet's own "Leaflet"
        // prefix, and the line was clipping. OpenFreeMap, OpenMapTiles and OSM all have
        // to stay; the library plug is the only part nobody requires.
        map.attributionControl.setPrefix(false);

        if (variant === "full") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clusterRef.current = (L as any).markerClusterGroup({
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            disableClusteringAtZoom: 17,
            maxClusterRadius: 55,
            iconCreateFunction: (cluster: { getChildCount: () => number }) => {
              const c = cluster.getChildCount();
              const size = c < 10 ? 34 : c < 50 ? 42 : 50;
              return L.divIcon({
                className: "",
                html: `<div class="pz-cluster" style="width:${size}px;height:${size}px;line-height:${size}px">${c}</div>`,
                iconSize: [size, size],
              });
            },
          });
          map.addLayer(clusterRef.current);
        }


        map.on("popupopen", (e: { popup: { getElement: () => HTMLElement | null } }) => {
          const el = e.popup.getElement();
          if (!el) return;
          const btn = el.querySelector("[data-place-id]") as HTMLAnchorElement | null;
          if (btn) {
            btn.addEventListener("click", (ev) => {
              const id = btn.dataset.placeId;
              if (!id) return;
              const place = places.find((x) => x.id === id);
              if (place?.reel_url) return;
              ev.preventDefault();
              ev.stopPropagation();
              if (place && selectRef.current) {
                selectRef.current(place);
              } else {
                window.location.assign(`/k/${id}`);
              }
            });
          }
          el.querySelectorAll<HTMLButtonElement>("[data-visit-action]").forEach((b) => {
            b.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const placeId = b.dataset.placeId;
              const status = b.dataset.visitAction as "want" | "visited" | undefined;
              if (!placeId || !status) return;
              window.dispatchEvent(new CustomEvent("pz:toggle-visit", { detail: { placeId, status } }));
            });
          });
        });


      }

      const map = mapRef.current;
      const cluster = clusterRef.current;
      if (cluster) {
        cluster.clearLayers();
      } else {
        markersRef.current.forEach((m) => map.removeLayer(m));
      }
      markersRef.current = [];
      markerByPlaceRef.current.clear();

      places.forEach((p) => {
        const color = cuisineMeta(p.cuisine).color;
        const pins: Array<{ lat: number; lng: number; label: string | null; address: string; main: boolean }> = [
          { lat: p.lat, lng: p.lng, label: null, address: p.address, main: true },
          ...(p.locations ?? []).map((l) => ({
            lat: l.lat,
            lng: l.lng,
            label: l.label,
            address: l.address,
            main: false,
          })),
        ];

        const emoji = cuisineMeta(p.cuisine).emoji;
        const friends = friendCounts?.get(p.id) ?? 0;
        pins.forEach((pin) => {
          // The badge sits in a wrapper, not inside .pz-pin: that element is
          // rotated -45deg to make the teardrop shape, and a digit inheriting
          // that rotation would sit on its side. Only the main pin carries it -
          // a place with several locations should not claim the count twice.
          const badge =
            friends > 0 && pin.main
              ? `<span class="pz-pin-friends" aria-hidden="true">${friends > 9 ? "9+" : friends}</span>`
              : "";
          const icon = L.divIcon({
            className: "",
            html: `<div class="pz-pin-wrap"><div class="pz-pin" style="background:${color};${pin.main ? "" : "opacity:.85"}"><span class="pz-pin-emoji">${emoji}</span></div>${badge}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -26],
          });
          const marker = L.marker([pin.lat, pin.lng], { icon });
          if (cluster) cluster.addLayer(marker); else marker.addTo(map);

          // Always highlight the clicked pin (all variants).
          marker.on("click", () => {
            trackEvent("map_pin_click", { place_id: p.id, cuisine: p.cuisine, variant });
            markerByPlaceRef.current.forEach((m) => {
              const el = m?._icon as HTMLElement | undefined;
              el?.querySelector(".pz-pin")?.classList.remove("pz-pin--active");
            });
            const el = (marker as unknown as { _icon?: HTMLElement })._icon;
            const pinEl = el?.querySelector(".pz-pin") as HTMLElement | null;
            if (pinEl) { void pinEl.offsetWidth; pinEl.classList.add("pz-pin--active"); }
            // When a parent owns the "selected place" UI (mapa.tsx's SelectedCard),
            // hand off to it directly instead of also opening our own popup - // showing both at once duplicated the same info (see PROJECT_BRIEF.md 1a).
            if (selectRef.current) selectRef.current(p);
          });

          if (variant === "mini") {
            // Preview mode: minimal tooltip, NO nav links so drag/zoom/click can never redirect.
            marker.bindTooltip(
              `<div style="font-family:Fraunces,serif;font-weight:600">${highlightHtml(p.name, query)}</div>
               <div style="font-size:.7rem;color:#555">${highlightHtml(pin.address, query)}</div>`,
              { direction: "top", offset: [0, -22], opacity: 0.98, className: "pz-tooltip" },
            );
          } else if (selectRef.current) {
            // Full map with a parent-owned "selected place" panel (mapa.tsx's
            // SelectedCard): click hands off to it, but hovering did nothing at
            // all before this - give a quick name/cuisine preview on hover too.
            marker.bindTooltip(
              `<div style="font-family:Fraunces,serif;font-weight:600">${highlightHtml(p.name, query)}</div>
               <div style="font-size:.7rem;color:${color};text-transform:uppercase;letter-spacing:.05em;font-weight:700">${highlightHtml(p.cuisine, query)}</div>`,
              { direction: "top", offset: [0, -26], opacity: 0.98, className: "pz-tooltip" },
            );
          }
          if (!selectRef.current) {
            // Only bind the rich popup when there's no parent-owned "selected place"
            // UI - otherwise the marker click handler above hands off to it directly
            // and this would just be a second, duplicate info panel on top of it.
            const subtitle = pin.label
              ? `<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:${color};font-weight:700;margin-bottom:.25rem">${highlightHtml(pin.label, query)}</div>`
              : "";
            const addressLine = `<div style="font-size:.75rem;color:#555;margin-bottom:.5rem">📍 ${highlightHtml(pin.address, query)}</div>`;
            const initials = escapeHtml(
              (p.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?",
            );
            const coverSrc = p.avatar_url ?? p.cover_image_url;
            const coverHtml = coverSrc
              ? `<img src="${escapeHtml(coverSrc)}" alt="" style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex:0 0 auto;border:1px solid #eee" onerror="this.style.display='none'" />`
              : `<div style="width:56px;height:56px;border-radius:12px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.9rem;flex:0 0 auto">${initials}</div>`;
            marker.bindPopup(
              `<div style="min-width:220px">
                <div style="display:flex;gap:.6rem;align-items:flex-start;margin-bottom:.5rem">
                  ${coverHtml}
                  <div style="min-width:0">
                    <div style="font-family:Fraunces,serif;font-size:1.05rem;font-weight:600;line-height:1.15;margin-bottom:.15rem">${highlightHtml(p.name, query)}</div>
                    <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:${color};font-weight:700">${highlightHtml(p.cuisine, query)} · ${(() => { const s = ratings?.get(p.id); return s ? `⭐ ${s.avg.toFixed(1)} (${s.count})` : "Brak ocen"; })()}</div>
                  </div>
                </div>
                ${subtitle}
                ${addressLine}
                <div style="font-size:.85rem;line-height:1.35;margin-bottom:.5rem">${highlightHtml(p.description, query)}</div>
                <a href="/k/${p.id}" data-place-id="${p.id}" style="display:inline-block;text-decoration:none;font-size:.8rem;font-weight:600;background:${color};color:#fff;border:none;border-radius:999px;padding:.4rem .8rem;cursor:pointer">Profil →</a>
                <div style="margin-top:.5rem;display:flex;gap:.35rem;flex-wrap:wrap">
                  <button type="button" data-visit-action="want" data-place-id="${p.id}" style="font-size:.72rem;font-weight:700;background:#fff7ed;color:#b45309;border:1px solid #fcd34d;border-radius:999px;padding:.3rem .6rem;cursor:pointer">🔖 Chcę odwiedzić</button>
                  <button type="button" data-visit-action="visited" data-place-id="${p.id}" style="font-size:.72rem;font-weight:700;background:#ecfdf5;color:#047857;border:1px solid #6ee7b7;border-radius:999px;padding:.3rem .6rem;cursor:pointer">✓ Odwiedziłem</button>
                </div>
              </div>`,
            );
          }
          markersRef.current.push(marker);
          if (pin.main) markerByPlaceRef.current.set(p.id, marker);
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [places, variant, query, ratings, friendCounts]);

  useEffect(() => {
    // Clear pulse from every marker, then apply to the focused one.
    markerByPlaceRef.current.forEach((m) => {
      const el = m?._icon as HTMLElement | undefined;
      el?.querySelector(".pz-pin")?.classList.remove("pz-pin--active");
    });
    if (!focusPlaceId) return;
    const marker = markerByPlaceRef.current.get(focusPlaceId);
    const map = mapRef.current;
    if (!marker || !map) return;
    const latlng = marker.getLatLng();
    const cluster = clusterRef.current;
    const openAndPulse = () => {
      programmaticMoveRef.current = true;
      // flyTo runs 600ms; clear a little after so the trailing moveend that
      // ends the animation is still recognised as ours.
      window.setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 900);
      map.flyTo(latlng, Math.max(map.getZoom(), 15), { duration: 0.6 });
      // Parent owns the "selected place" UI when onSelect is wired (see marker
      // click handler above) - don't also pop our own duplicate info bubble.
      if (!selectRef.current) marker.openPopup();
      const el = marker._icon as HTMLElement | undefined;
      const pin = el?.querySelector(".pz-pin") as HTMLElement | null;
      if (pin) {
        void pin.offsetWidth;
        pin.classList.add("pz-pin--active");
      }
    };
    if (cluster && cluster.hasLayer(marker)) {
      cluster.zoomToShowLayer(marker, openAndPulse);
    } else {
      openAndPulse();
    }
  }, [focusPlaceId, focusTick, places]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      const map = mapRef.current;
      if (youAreHereRef.current) {
        map.removeLayer(youAreHereRef.current);
        youAreHereRef.current = null;
      }
      if (userLocation) {
        const icon = L.divIcon({
          className: "",
          html: '<div class="pz-you-are-here"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const marker = L.marker([userLocation.lat, userLocation.lng], {
          icon,
          zIndexOffset: 1000,
          keyboard: false,
        });
        marker.bindTooltip("Hej, to Ty! 👋", {
          direction: "top",
          offset: [0, -10],
          opacity: 0.98,
          className: "pz-tooltip",
        });
        marker.on("mouseover", () => {
          if (achievementTried.current) return;
          achievementTried.current = true;
          unlockAchievement.mutate("found_yourself", {
            onSuccess: (unlocked) => {
              if (unlocked) {
                trackEvent("achievement_unlocked", { slug: "found_yourself" });
                toast.success("Odznaka odblokowana: „To Ty!”", {
                  description: "Znalazłeś swoją kropkę na mapie.",
                });
              }
            },
          });
        });
        marker.addTo(map);
        youAreHereRef.current = marker;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userLocation, mapReady]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (variant === "mini") {
    return <div ref={containerRef} className="w-full h-full" />;
  }

  // Draws the searched area: a dashed outline plus a veil over everything outside
  // it. Sitting inside the area you only see the border; pan away and the region
  // you are filtering by stays visible, which is the moment the filter otherwise
  // becomes invisible state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      for (const layer of areaLayersRef.current) map.removeLayer(layer);
      areaLayersRef.current = [];
      if (!areaBounds) return;

      const { north, south, east, west } = areaBounds;
      // An outer ring around the whole world with the searched area as a hole:
      // Leaflet renders the gap unfilled, which dims everything except the area.
      const veil = L.polygon(
        [
          [
            [90, -180],
            [90, 180],
            [-90, 180],
            [-90, -180],
          ],
          [
            [north, west],
            [north, east],
            [south, east],
            [south, west],
          ],
        ] as unknown as L.LatLngExpression[][],
        {
          color: "transparent",
          fillColor: "#141c3a",
          fillOpacity: 0.28,
          interactive: false,
        },
      ).addTo(map);

      const outline = L.rectangle(
        [
          [south, west],
          [north, east],
        ],
        {
          // Leaflet writes this as an SVG presentation attribute, and var() does not
          // resolve there - it has to be a literal. This is --tomato at 0.56 lightness.
          color: "#d12e00",
          weight: 2,
          dashArray: "7 5",
          fill: false,
          interactive: false,
        },
      ).addTo(map);

      areaLayersRef.current = [veil, outline];
    })();
    return () => {
      cancelled = true;
    };
  }, [areaBounds, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !autoCenter) return;
    if (autoCenteredRef.current || userMovedRef.current || focusPlaceId) return;
    autoCenteredRef.current = true;
    // Flagged as ours, or the resulting moveend reads as a drag and pops the
    // "search this area" button on a view nobody asked for.
    programmaticMoveRef.current = true;
    map.setView([autoCenter.lat, autoCenter.lng], 14, { animate: false });
    const t = setTimeout(() => {
      programmaticMoveRef.current = false;
    }, 300);
    return () => clearTimeout(t);
  }, [autoCenter, mapReady, focusPlaceId]);

  // Vector tiles are the whole reason the basemap can follow the theme at all:
  // the style is data, so switching it is a URL swap rather than a second set of
  // images. Guarded on mapReady so it never runs before the layer exists.
  useEffect(() => {
    const gl = glLayerRef.current;
    if (!gl || !mapReady) return;
    const m = gl.getMaplibreMap?.();
    if (!m) return;
    m.setStyle(BASEMAP_STYLE[theme]);
  }, [theme, mapReady]);

  return (
    <div
      ref={containerRef}
      className="h-[58dvh] min-h-[380px] max-h-[560px] sm:h-[480px] sm:max-h-none w-full rounded-2xl sm:rounded-3xl overflow-hidden border-2 sm:border-4 border-navy shadow-[0_24px_60px_-30px_rgba(34,30,80,0.5)]"
    />
  );
}

function highlightHtml(text: string, query: string) {
  const q = query.trim();
  if (!q) return escapeHtml(text);
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  let result = "";
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(qLower, i);
    if (idx === -1) {
      result += escapeHtml(text.slice(i));
      break;
    }
    if (idx > i) result += escapeHtml(text.slice(i, idx));
    result += `<mark style="background:#ff8c42;color:#fff;border-radius:2px;padding:0 2px;font-weight:600">${escapeHtml(text.slice(idx, idx + q.length))}</mark>`;
    i = idx + q.length;
  }
  return result;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}
