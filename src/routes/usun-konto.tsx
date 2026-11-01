import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/usun-konto")({
  head: () => ({
    meta: [
      { title: "Usuwanie konta - poŻeramy" },
      {
        name: "description",
        content: "Jak trwale usunąć konto w poŻeramy i jakie dane są wtedy kasowane.",
      },
      { property: "og:title", content: "Usuwanie konta - poŻeramy" },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://pozeramy.live/usun-konto" },
    ],
    links: [{ rel: "canonical", href: "https://pozeramy.live/usun-konto" }],
  }),
  component: DeleteAccountInfoPage,
});

function DeleteAccountInfoPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main id="main-content" className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-20">
        <BackButton to="/" label="Strona główna" />
        <h1 className="font-display text-4xl sm:text-5xl mb-6">Usuwanie konta</h1>

        <div className="prose text-foreground/90 space-y-4">
          <h2>Samodzielnie, w aplikacji</h2>
          <ol>
            <li>Zaloguj się do poŻeramy (w aplikacji lub na pozeramy.live).</li>
            <li>
              Wejdź w <Link to="/profile" className="text-tomato underline">Profil</Link> i przejdź
              na sam dół do sekcji <strong>Usuń konto</strong>.
            </li>
            <li>Potwierdź przyciskiem „Usuń konto na zawsze”.</li>
          </ol>
          <p>Konto znika od razu i nie da się go przywrócić.</p>

          <h2>Co jest usuwane</h2>
          <p>
            Profil, zdjęcie, opinie, oceny, listy, ulubione, znajomi, wpisy i komentarze oraz
            powiadomienia powiązane z kontem.
          </p>

          <h2>Bez dostępu do aplikacji</h2>
          <p>
            Jeśli nie możesz się zalogować, napisz z adresu e-mail przypisanego do konta na{" "}
            <a href="mailto:po.zeramy@gmail.com" className="text-tomato underline">
              po.zeramy@gmail.com
            </a>{" "}
            z tematem „Usuń konto”. Usuniemy je w ciągu 30 dni.
          </p>

          <p className="text-sm text-muted-foreground">
            Więcej o danych:{" "}
            <Link to="/polityka-prywatnosci" className="text-tomato underline">
              Polityka prywatności
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
