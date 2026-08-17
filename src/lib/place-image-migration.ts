export const HOTLINK_HOSTS = [
  "instagram.com",
  "cdninstagram.com",
  "fbcdn.net",
  "facebook.com",
  "imgur.com",
];

export const PLACE_IMAGE_FIELDS = ["cover_image_url", "avatar_url", "menu_image_url"] as const;
export type MigratableField = (typeof PLACE_IMAGE_FIELDS)[number];

export type MigrationResult =
  | { status: "skipped"; reason: string }
  | { status: "migrated"; url: string };

export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** True gdy host URL-a należy do znanych hotlinkowanych CDN-ów (także subdomeny, np. scontent-xyz.fbcdn.net). */
export function isHotlinkedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return HOTLINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
