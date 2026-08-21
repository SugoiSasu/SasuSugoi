import { User } from "lucide-react";
import { useAvatarUrl } from "@/lib/profile-api";
import { initialsFromName, colorFromKey } from "@/lib/avatar-utils";
import { avatarRingForLevel } from "@/components/LevelProgress";

const GENDER_AVATAR_BG: Record<"M" | "K", string> = {
  M: "oklch(0.31 0.14 268)",
  K: "oklch(0.72 0.13 25)",
};

interface Props {
  avatarUrl?: string | null;
  avatarSource?: "google" | "upload" | "initials" | null;
  displayName?: string | null;
  username?: string | null;
  size?: number;
  className?: string;
  /** Pass the user's level to show the tier ring (every 5 levels, see
   * LevelProgress.tsx). Omit where the gamification chrome isn't wanted
   * (dense lists, admin panels) - it's opt-in, not automatic. */
  level?: number;
  /** Picks the default-avatar look (blue/pink silhouette) when there's no
   * uploaded photo. Leave unset - or the user picked "wolę nie podawać" - * to keep the existing random-color initials monogram. */
  gender?: "M" | "K" | null;
}

/**
 * Universal avatar:
 * - google/external URL → <img src>
 * - upload (bucket path) → signed URL via useAvatarUrl
 * - initials → gradient circle with two-letter monogram
 */
export function UserAvatar({
  avatarUrl,
  avatarSource,
  displayName,
  username,
  size = 40,
  className = "",
  level,
  gender,
}: Props) {
  const isExternal = avatarSource === "google" || (avatarUrl?.startsWith("http") ?? false);
  // Sign only when path is in private bucket
  const { data: signed } = useAvatarUrl(isExternal ? null : (avatarUrl ?? null));
  const src = isExternal ? avatarUrl : signed;
  const ring = level !== undefined ? avatarRingForLevel(level) : null;

  const inner = src ? (
    <img
      src={src}
      alt={displayName || username || ""}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{ width: size, height: size }}
      className={`rounded-full object-cover ${ring ? "" : className}`}
    />
  ) : gender ? (
    <div
      style={{ width: size, height: size, backgroundColor: GENDER_AVATAR_BG[gender] }}
      className={`grid place-items-center rounded-full text-white ${ring ? "" : className}`}
    >
      <User
        size={Math.round(size * 0.58)}
        strokeWidth={2}
        fill="currentColor"
        className="opacity-90"
      />
    </div>
  ) : (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: colorFromKey(username || displayName),
        fontSize: Math.max(10, size * 0.4),
      }}
      className={`rounded-full grid place-items-center text-white font-bold tracking-tight select-none ${ring ? "" : className}`}
    >
      {initialsFromName(displayName, username)}
    </div>
  );

  if (!ring) return inner;

  const ringPad = Math.max(2, Math.round(size * 0.07));
  return (
    <div
      title={ring.name}
      style={{
        width: size + ringPad * 2,
        height: size + ringPad * 2,
        padding: ringPad,
        background: ring.background,
        backgroundSize: ring.shimmer ? "200% 200%" : undefined,
      }}
      className={`rounded-full ${ring.shimmer ? "animate-[ring-shimmer_3s_linear_infinite]" : ""} ${className}`}
    >
      <div className="h-full w-full overflow-hidden rounded-full bg-background">{inner}</div>
      {ring.shimmer && (
        <style>{`@keyframes ring-shimmer { to { background-position: 200% 50%; } }`}</style>
      )}
    </div>
  );
}
