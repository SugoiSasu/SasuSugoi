import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { useActiveAds, trackAdClick, trackAdImpression, DEFAULT_AD_CTA, type Ad } from "@/lib/ads-api";
import { useUser } from "@/lib/use-auth";
import { pickSeeded } from "@/lib/seeded-pick";

/** Sidebar-sized ad card, visually matching RandomPlaceCard's footprint so it
 * reads as part of the same widget stack rather than a bolted-on banner.
 * When several ads are active at once, seeded-picks one per user+day instead
 * of always showing the same (most-recently-created) one to everybody. */
export function SidebarAdCard() {
  const { data: ads } = useActiveAds();
  const { user } = useUser();
  const today = new Date().toISOString().slice(0, 10);
  const ad = pickSeeded(ads ?? [], `sidebar-${user?.id ?? "anon"}-${today}`);
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ad || trackedRef.current === ad.id) return;
    trackedRef.current = ad.id;
    trackAdImpression(ad.id, user?.id);
  }, [ad?.id, user?.id]);

  if (!ad) return null;

  const onClick = () => trackAdClick(ad.id, user?.id);
  const cardClass =
    "pz-fade-in group block overflow-hidden rounded-2xl border-2 border-tomato bg-cream/[0.06] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-cream/10 hover:shadow-lg";

  const content = (
    <>
      <div className="flex items-center justify-center gap-2 px-3 pt-2.5">
        <Megaphone size={13} className="text-tomato-on-dark" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-cream/50">
          Reklama
        </span>
      </div>
      <div className="flex flex-col items-center gap-2 px-3 py-2.5 text-center">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-navy/40 text-xl transition-transform duration-200 ease-out group-hover:scale-105"
          style={{
            backgroundImage: ad.image_url ? `url(${ad.image_url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-cream">{ad.message}</p>
      </div>
      <div className="flex justify-center px-3 pb-3">
        <span className="inline-flex items-center rounded-full bg-tomato px-3 py-1.5 text-[11px] font-semibold text-cream transition-colors group-hover:bg-tomato/90">
          {ad.cta_label || DEFAULT_AD_CTA}
        </span>
      </div>
    </>
  );

  if (ad.place_id) {
    return (
      <Link to="/k/$id" params={{ id: ad.place_id }} onClick={onClick} className={cardClass}>
        {content}
      </Link>
    );
  }
  if (ad.link_url) {
    return (
      <a href={ad.link_url} target="_blank" rel="noreferrer" onClick={onClick} className={cardClass}>
        {content}
      </a>
    );
  }
  return <div className={cardClass}>{content}</div>;
}
