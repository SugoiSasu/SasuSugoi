import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NATIVE_SCHEME } from "@/lib/native-auth";

export const Route = createFileRoute("/auth/app-callback")({
  head: () => ({ meta: [{ title: "Wracamy do aplikacji - poŻeramy" }, { name: "robots", content: "noindex" }] }),
  component: AppCallbackPage,
});

/**
 * Strona, na ktora Supabase odsyla po logowaniu Google/Apple zaczetym w aplikacji. Dziala w
 * przegladarce systemowej i przekazuje wynik do aplikacji linkiem pl.pozeramy.app://auth.
 * Nie dotyka sesji: kod logowania nic nie daje bez klucza, ktory ma tylko aplikacja (PKCE).
 */
function AppCallbackPage() {
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const out = new URLSearchParams();
    for (const k of ["code", "error", "error_description"]) {
      const v = q.get(k);
      if (v) out.set(k, v);
    }
    const target = `${NATIVE_SCHEME}://auth?${out.toString()}`;
    setLink(target);
    window.location.replace(target);
  }, []);

  return (
    <main id="main-content" className="min-h-dvh bg-background text-foreground grid place-items-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-3xl mb-3">Wracamy do aplikacji</h1>
        <p className="text-muted-foreground mb-6">Jeśli aplikacja nie otworzyła się sama, dotknij przycisku.</p>
        {link && (
          <a href={link} className="inline-flex min-h-12 items-center rounded-full bg-tomato px-6 font-bold text-cream">
            Otwórz poŻeramy
          </a>
        )}
      </div>
    </main>
  );
}
