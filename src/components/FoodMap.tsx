import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { cuisineMeta } from "@/data/places";
import type { Place } from "@/lib/places-api";
import { trackEvent } from "@/lib/analytics";


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
}

export default function FoodMap({ places, onSelect, focusPlaceId, focusTick, query = "", variant = "full", ratings }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerByPlaceRef = useRef<Map<string, any>>(new Map());

  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current) return;
      const L = (await import("leaflet")).default;
      if (variant === "full") {
        await import("leaflet.markercluster");
      }
      if (cancelled || !containerRef.current) return;


      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          center: [52.4082, 16.9335],
          zoom: 13,
          scrollWheelZoom: false,
          doubleClickZoom: variant === "full",
          zoomControl: variant === "full",
          dragging: true,
          // Leaflet's `tap` handler improves touch responsiveness; typed via any to avoid TS DefinitelyTyped drift.
          ...({ tap: true, tapTolerance: 20 } as Record<string, unknown>),
        });
        mapRef.current = map;
        // Wheel zoom aktywne po kliknięciu / dotknięciu mapy; wyłącza się gdy mysz opuści mapę.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyMap = map as any;
        map.on("click focus", () => anyMap.scrollWheelZoom?.enable?.());
        map.on("mouseout blur", () => anyMap.scrollWheelZoom?.disable?.());
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19,
          },
        ).addTo(map);

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
        pins.forEach((pin) => {
          const icon = L.divIcon({
            className: "",
            html: `<div class="pz-pin" style="background:${color};${pin.main ? "" : "opacity:.85"}"><span class="pz-pin-emoji">${emoji}</span></div>`,
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
            // hand off to it directly instead of also opening our own popup —
            // showing both at once duplicated the same info (see PROJECT_BRIEF.md 1a).
            if (selectRef.current) selectRef.current(p);
          });

          if (variant === "mini") {
            // Preview mode: minimal tooltip, NO nav links so drag/zoom/click can never redirect.
            marker.bindTooltip(
              `<div style="font-family:Fraunces,serif;font-weight:600">${highlightHtml(p.name, query)}</div>
               <div style="font-size:.7rem;color:#555">${highlightHtml(pin.address, query)}</div>`,
              { direction: "top", offset: [0, -22], opacity: 0.98, className: "pz-tooltip" },
            );
          } else if (!selectRef.current) {
            // Only bind the rich popup when there's no parent-owned "selected place"
            // UI — otherwise the marker click handler above hands off to it directly
            // and this would just be a second, duplicate info panel on top of it.
            const subtitle = pin.label
              ? `<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:${color};font-weight:700;margin-bottom:.25rem">${highlightHtml(pin.label, query)}</div>`
              : "";
            const addressLine = `<div style="font-size:.75rem;color:#555;margin-bottom:.5rem">📍 ${highlightHtml(pin.address, query)}</div>`;
            const initials = escapeHtml(
              (p.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?",
            );
            const coverHtml = p.cover_image_url
              ? `<img src="${escapeHtml(p.cover_image_url)}" alt="" style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex:0 0 auto;border:1px solid #eee" onerror="this.style.display='none'" />`
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
  }, [places, variant, query, ratings]);

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
      map.flyTo(latlng, Math.max(map.getZoom(), 15), { duration: 0.6 });
      // Parent owns the "selected place" UI when onSelect is wired (see marker
      // click handler above) — don't also pop our own duplicate info bubble.
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
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (variant === "mini") {
    return <div ref={containerRef} className="w-full h-full" />;
  }

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
