/**
 * One place that decides how a person is named in the UI.
 *
 * `profiles.username` is nullable and NO signup path sets it (handle_new_user
 * only copies display_name/avatar from OAuth metadata; the email signup form
 * never asks for a nick). So every brand-new account has username = NULL until
 * the user types one in Settings. Call sites that interpolated it directly
 * rendered a literal "@null", and ones that gated on it labelled real,
 * named people "Anonim".
 */

type NameSource =
  | { display_name?: string | null; username?: string | null }
  | null
  | undefined;

/** "@nick", or null when the person hasn't picked a nick yet. */
export function handleOf(p: NameSource): string | null {
  const u = p?.username?.trim();
  return u ? `@${u}` : null;
}

/** Display name, then "@nick", then the context-specific fallback. */
export function displayNameOf(p: NameSource, fallback = "Użytkownik"): string {
  const d = p?.display_name?.trim();
  if (d) return d;
  return handleOf(p) ?? fallback;
}

/**
 * The secondary "@nick" line under a name - only worth showing when it adds
 * something, i.e. the primary line is a display name rather than the handle
 * itself.
 */
export function secondaryHandleOf(p: NameSource): string | null {
  return p?.display_name?.trim() ? handleOf(p) : null;
}

/** Route param for /u/$username - that route resolves UUIDs too. */
export function profileParamOf(p: { username?: string | null; id: string }): string {
  return p.username?.trim() || p.id;
}
