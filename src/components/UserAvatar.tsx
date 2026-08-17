import { useAvatarUrl } from "@/lib/profile-api";
import { initialsFromName, colorFromKey } from "@/lib/avatar-utils";

interface Props {
  avatarUrl?: string | null;
  avatarSource?: "google" | "upload" | "initials" | null;
  displayName?: string | null;
  username?: string | null;
  size?: number;
  className?: string;
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
}: Props) {
  const isExternal =
    avatarSource === "google" ||
    (avatarUrl?.startsWith("http") ?? false);
  // Sign only when path is in private bucket
  const { data: signed } = useAvatarUrl(isExternal ? null : avatarUrl ?? null);
  const src = isExternal ? avatarUrl : signed;

  if (src) {
    return (
      <img
        src={src}
        alt={displayName || username || ""}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  const initials = initialsFromName(displayName, username);
  const bg = colorFromKey(username || displayName);
  const fontSize = Math.max(10, size * 0.4);
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize,
      }}
      className={`rounded-full grid place-items-center text-white font-bold tracking-tight select-none ${className}`}
    >
      {initials}
    </div>
  );
}
