import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { trackAdClick, trackAdImpression, DEFAULT_AD_CTA, type Ad } from "@/lib/ads-api";
import { useUser } from "@/lib/use-auth";

/** Native ad card sized to match DiscoverCard exactly, so it sits in the
 * horizontal rail like any other place tile - labeled "Reklama" for
 * transparency instead of pretending to be organic content. */
export function SponsoredDiscoverCard({ ad }: { ad: Ad }) {
  const { user } = useUser();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackAdImpression(ad.id, user?.id);
  }, [ad.id, user?.id]);

  const onClick = () => trackAdClick(ad.id, user?.id);

  const content = (
    <>
      <div className="relative aspect-[5/4] overflow-hidden bg-navy">
        <img
          src={ad.image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/45 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 chip bg-tomato text-cream font-bold shadow-sm">
          <Megaphone size={11} /> Reklama
        </span>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 font-display text-lg leading-tight">{ad.message}</p>
        <span className="mt-2 inline-flex items-center rounded-full bg-tomato px-3 py-1.5 text-xs font-semibold text-cream transition-colors group-hover:bg-tomato/90">
          {ad.cta_label || DEFAULT_AD_CTA}
        </span>
      </div>
    </>
  );

  const cardClass =
    "group relative w-[15rem] shrink-0 snap-start overflow-hidden rounded-3xl border-2 border-tomato bg-card card-hover sm:w-[16rem] lg:w-auto lg:shrink block";

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
