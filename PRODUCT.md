# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Foodies discovering restaurants in Poznań. Current real users are Mateusz (the builder) and his friend circle (early testers with real accounts, e.g. @sasu, @gentle_menel, @zuzel) — small, known audience today, but the product is not designed to stay friend-circle-only (see Positioning/Operating Context below).

## Product Purpose

poŻeramy helps people in Poznań decide where to eat and turns that decision into something social and game-like — browsing, rating, and revisiting restaurants with friends — rather than a plain search-and-review utility.

## Positioning

Two equally important pillars, confirmed by the user as a deliberate combination (neither is secondary):

1. **Gamification + social layer**: Punkty PoŻarcia (points), achievements, ranks, VIP status, a friend system with invite links that reward points (capped + cooldown to keep the economy healthy), an activity feed ("Pożeralnia"), and a Tinder-style swipe deck ("Karty") for discovering new places with friends watching what they react to.
2. **Local curation**: every listed place is real and manually verified by the admin — not scraped or crowd-submitted en masse. Real Instagram Reels are embedded per place (official oEmbed, not a scrape) so visitors can vibe-check a place before going. Restaurant owners can claim and manage their own listing.

This combination is the thing a generic map/review app (Google Maps, TripAdvisor) could not truthfully copy: it is neither "just a curated list" nor "just a social game" — it is both at once.

## Operating Context

- Mobile-first (bottom tab bar + FAB for the primary flows) with a full desktop layout (sidebar nav) — both are real, maintained surfaces, not one primary and one afterthought.
- An admin panel curates/moderates places, reviews, users, ads, points rules, and social accounts — the manual-verification promise in Positioning is enforced by real admin workflow, not just a claim.
- A separate owner panel lets a verified restaurant owner manage their own place's listing (hours, menu, contact info) without full admin access.
- Currently pre-public-launch: real seed data exists (58 places in the database, 9 currently published/live — the rest are drafts awaiting admin review before going public).

## Capabilities and Constraints

- Map + list browsing with cuisine/rating/open-now filters, reviews and ratings, three personal place lists (want to visit / visited / favorite).
- Friend system: requests, groups, blocking, an invite-link system with a capped, cooldown-based points reward (deliberately tuned to be "economically irrelevant" to abuse rather than fully un-exploitable).
- Achievements, ranks, VIP progression, a swipe-card discovery mode ("Karty").
- Instagram Reel embeds via the official oEmbed endpoint (token-free since Meta's June 2026 policy change) rather than scraping.
- Auth via email and Google/Apple OAuth.
- Ads system (ad_events tracking, admin ads panel) — confirmed as a real monetization plan, not just scaffolding (see Product Principles).
- Backend: Supabase (Postgres + Auth + Storage) with Row Level Security as the primary access-control layer; deploy target is Vercel (Nitro preset).
- Legal docs (regulamin, polityka prywatności) are already written to match actual current app scope, not placeholders.

## Brand Commitments

- Name: **poŻeramy** (wordplay on "pożeram" — "I devour/eat up"). Tagline used in metadata: "foodie z Poznania".
- Palette: navy, tomato, cream, blush (tokens in `src/styles.css`). Display font Fraunces, body Bricolage Grotesque/Manrope. A recurring "terrazzo" dot-pattern texture on navy surfaces.
- Custom brand illustration exists for at least the 404 state (sad pizza); cuisine categories have their own cover art.

## Evidence on Hand

- Real Poznań restaurant data: 58 places in the database (9 published), including real addresses, real Instagram post URLs for reels, real cover photos for some places.
- Real early users actively testing with real accounts and real activity (friendships, reviews, points, invites).
- Written, scope-matched legal documents (regulamin, polityka prywatności) already live in the codebase.
- No public marketing copy, testimonials, or press exist yet — do not fabricate any for future work.

## Product Principles

1. **Every listed place is real and verified.** Curation is a stated pillar, not a placeholder — never treat scraped or bulk-imported data as equivalent to admin-verified data.
2. **Discovery should feel like play.** Points, achievements, ranks, and the swipe deck are core mechanics of the product, not decorative gamification bolted onto a search tool.
3. **Owners are participants, not just listings.** A verified restaurant owner can manage their own presence in the product.
4. **Poznań is the proving ground, not the ceiling.** The user confirmed ambition beyond one city — avoid hard-coding assumptions (copy, data model, city-specific logic) that would block future cities without need.
5. **Monetization must not erode trust in curation.** Ads are a confirmed, real revenue plan; they should not compromise the manual-verification promise that is half of the product's positioning.

## Accessibility & Inclusion

No formal accessibility standard has been established by the user. Recent work has followed WCAG AA-ish practices (aria-labels, focus states, contrast-aware tokens) as general good practice, not as a confirmed product requirement — treat this section as open until the user sets one.
