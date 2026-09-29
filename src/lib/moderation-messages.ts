/** Czyste funkcje komunikatow moderacji - bez zaleznosci, wiec testowalne. */

export interface BladBazy {
  message?: string;
  details?: string | null;
}

export function dataBlokady(details: string | null | undefined): string {
  if (!details || details === "permanent") return "Twoje konto ma stałą blokadę pisania.";
  const d = new Date(details);
  return `Masz blokadę pisania do ${d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}.`;
}

/** Komunikat dla bledow moderacji (trigger w bazie), albo null gdy to inny blad. */
export function moderationMessage(err: unknown): string | null {
  const e = err as BladBazy | null;
  const m = e?.message ?? "";
  if (m.startsWith("PZ_PROFANITY"))
    return "Ta treść narusza regulamin (wulgaryzmy lub treści niedozwolone). Zmień ją i spróbuj ponownie.";
  if (m.startsWith("PZ_BANNED")) return dataBlokady(e?.details);
  return null;
}

/** Zamienia blad Supabase na Error z polskim komunikatem, gdy to blad moderacji. */
export function asError(err: unknown): Error {
  const msg = moderationMessage(err);
  if (msg) return Object.assign(new Error(msg), { moderacja: true });
  if (err instanceof Error) return err;
  return new Error((err as BladBazy | null)?.message ?? "Nie udało się zapisać");
}

