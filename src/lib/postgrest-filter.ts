/** Strips characters meaningful to PostgREST's filter grammar (`,` separates
 * conditions, `()` nest groups, `%` is the ilike wildcard) before a raw
 * search term is interpolated into an `.or(...)`/`.ilike(...)` string - * otherwise a crafted search term can break out of the intended condition.
 * Leaves `_` alone (single-char ilike wildcard) since usernames commonly
 * contain it and the structural-injection risk is what actually matters. */
export function sanitizeIlikeTerm(term: string): string {
  return term.replace(/[%,()]/g, " ").trim();
}
