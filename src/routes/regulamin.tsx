import { BackButton } from "@/components/BackButton";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/regulamin")({
  head: () => ({
    meta: [
      { title: "Regulamin — poŻeramy" },
      {
        name: "description",
        content:
          "Regulamin korzystania z serwisu poŻeramy — zasady, prawa i obowiązki użytkowników.",
      },
      { property: "og:title", content: "Regulamin — poŻeramy" },
      {
        property: "og:description",
        content: "Zasady korzystania z serwisu poŻeramy.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://pozeramy.live/regulamin" },
    ],
    links: [{ rel: "canonical", href: "https://pozeramy.live/regulamin" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main id="main-content" className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-20">
        <h1 className="font-display text-4xl sm:text-5xl mb-6">Regulamin</h1>

        <div className="prose text-foreground/90 space-y-4">
          <p className="text-sm text-muted-foreground">
            Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
          </p>

          <p className="italic text-muted-foreground">
            To wstępna, robocza wersja regulaminu. Ostateczna treść zostanie
            opublikowana wkrótce. W razie pytań pisz na{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>
            .
          </p>

          <h2>1. Postanowienia ogólne</h2>
          <p>
            Niniejszy Regulamin określa zasady korzystania z serwisu poŻeramy
            dostępnego pod adresem pozeramy.live. Korzystając z serwisu,
            akceptujesz warunki opisane poniżej.
          </p>

          <h2>2. Konto użytkownika</h2>
          <p>
            Rejestracja konta wymaga podania prawdziwych danych oraz potwierdzenia
            adresu e-mail przez link aktywacyjny. Jedno konto może należeć do
            jednej osoby. Zabronione jest udostępnianie konta osobom trzecim.
          </p>

          <h2>3. Zasady publikowania treści</h2>
          <p>
            Publikując recenzje, zdjęcia, komentarze i inne treści, oświadczasz,
            że masz do nich prawa oraz że nie naruszają one prawa, dóbr osobistych
            ani zasad współżycia społecznego. Zabronione są treści obraźliwe,
            spam, reklamy oraz materiały niezgodne z prawem.
          </p>

          <h2>4. Odpowiedzialność</h2>
          <p>
            poŻeramy dokłada starań, aby informacje o lokalach były aktualne,
            jednak nie ponosi odpowiedzialności za treści publikowane przez
            użytkowników ani za decyzje podjęte na ich podstawie.
          </p>

          <h2>5. Prawa autorskie</h2>
          <p>
            Publikując treść, udzielasz serwisowi niewyłącznej, nieodpłatnej
            licencji na jej wyświetlanie w ramach serwisu. Pozostajesz właścicielem
            swoich treści.
          </p>

          <h2>6. Reklamacje i kontakt</h2>
          <p>
            Reklamacje oraz pytania kieruj na{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>
            . Odpowiadamy w rozsądnym terminie, zwykle do 14 dni.
          </p>

          <h2>7. Zmiany Regulaminu</h2>
          <p>
            Zastrzegamy prawo do aktualizacji Regulaminu. O istotnych zmianach
            poinformujemy w serwisie lub mailowo. Dalsze korzystanie z serwisu po
            wejściu zmian w życie oznacza ich akceptację.
          </p>
        </div>

        <div className="mt-10">
          <BackButton to="/" label="Wróć na stronę główną" />
        </div>
      </main>
    </div>
  );
}
