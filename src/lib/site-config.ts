/**
 * Single source of truth for the project's public URLs.
 * Use these constants everywhere (sitemap, emails, OG metadata,
 * auth callbacks, share links) so the production domain never drifts.
 */
export const SITE_NAME = "poŻeramy";
export const ROOT_DOMAIN = "pozeramy.live";
export const APP_URL = `https://${ROOT_DOMAIN}`;
export const BASE_URL = APP_URL;

// Email sender (delegated subdomain verified for outbound mail).
export const SENDER_DOMAIN = `notify.${ROOT_DOMAIN}`;
export const FROM_DOMAIN = ROOT_DOMAIN;

// Legacy domains that must NEVER appear in built assets / emails / sitemap.
export const FORBIDDEN_DOMAINS = [
  "pozeramy.lovable.app",
  "id-preview--69a907e9-12b9-4311-a050-0bcead17962f.lovable.app",
];
