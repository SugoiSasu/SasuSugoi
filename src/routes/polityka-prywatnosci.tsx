import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { COLLAB_CONSENT_VERSION } from "@/lib/consent";

export const Route = createFileRoute("/polityka-prywatnosci")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności — poŻeramy" },
      {
        name: "description",
        content:
          "Informacje o przetwarzaniu danych osobowych w serwisie poŻeramy, w tym dane z formularza współpracy.",
      },
      { property: "og:title", content: "Polityka prywatności — poŻeramy" },
      {
        property: "og:description",
        content:
          "Jak przetwarzamy Twoje dane osobowe w poŻeramy — podstawy prawne, okres przechowywania i Twoje prawa.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://pozeramy.live/polityka-prywatnosci" },
    ],
    links: [{ rel: "canonical", href: "https://pozeramy.live/polityka-prywatnosci" }],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main id="main-content" className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-20">
        <h1 className="font-display text-4xl sm:text-5xl mb-6">
          Polityka prywatności
        </h1>

        <div className="prose text-foreground/90 space-y-4">
          <p className="text-sm text-muted-foreground">
            Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")} ·
            Aktualna wersja klauzuli zgody formularza współpracy:{" "}
            <strong>{COLLAB_CONSENT_VERSION}</strong>
          </p>

          <h2>1. Administrator danych</h2>
          <p>
            Administratorem danych osobowych jest zespół poŻeramy. Kontakt:{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>
            .
          </p>

          <h2>2. Jakie dane zbieramy</h2>
          <p>
            Przez formularz współpracy zbieramy wyłącznie dane, które podasz
            dobrowolnie: nazwę marki lub lokalu, adres e-mail oraz treść
            wiadomości. Dodatkowo automatycznie zapisujemy:
          </p>
          <ul className="list-disc pl-6">
            <li>datę i godzinę wysłania formularza,</li>
            <li>wersję klauzuli zgody, którą zaakceptowałeś/aś,</li>
            <li>dokładny moment akceptacji zgody (znacznik czasu),</li>
            <li>identyfikator przeglądarki (user agent) — wyłącznie w celach bezpieczeństwa i ochrony przed spamem.</li>
          </ul>

          <h2>3. Formularz „Współpraca" — szczegóły</h2>

          <h3>3.1. Cel przetwarzania</h3>
          <ul className="list-disc pl-6">
            <li>odpowiedź na Twoje zapytanie i kontakt zwrotny,</li>
            <li>ewentualne nawiązanie i prowadzenie współpracy biznesowej,</li>
            <li>archiwizacja korespondencji oraz dowodu wyrażenia zgody na potrzeby rozliczalności (art. 7 ust. 1 RODO),</li>
            <li>ochrona przed spamem i nadużyciami (honeypot, walidacja).</li>
          </ul>

          <h3>3.2. Podstawa prawna</h3>
          <ul className="list-disc pl-6">
            <li>
              <strong>Art. 6 ust. 1 lit. a RODO</strong> — Twoja dobrowolna zgoda
              wyrażona przez zaznaczenie odpowiedniego checkboxa. Bez zgody
              formularz nie zostanie zapisany ani wysłany (blokada na poziomie
              aplikacji i bazy danych).
            </li>
            <li>
              <strong>Art. 6 ust. 1 lit. f RODO</strong> — nasz uzasadniony
              interes polegający na archiwizacji korespondencji, dochodzeniu
              lub obronie przed ewentualnymi roszczeniami oraz ochronie usługi
              przed nadużyciami.
            </li>
          </ul>

          <h3>3.3. Okres przechowywania</h3>
          <ul className="list-disc pl-6">
            <li>
              treść zgłoszenia i dane kontaktowe — przez <strong>24 miesiące</strong>{" "}
              od ostatniego kontaktu, a w razie nawiązania współpracy — przez
              czas trwania umowy oraz okres przedawnienia roszczeń,
            </li>
            <li>
              dowód wyrażenia zgody (wersja klauzuli, data i godzina akceptacji)
              — przez okres przedawnienia roszczeń (do <strong>6 lat</strong>),
              zgodnie z obowiązkiem rozliczalności (art. 5 ust. 2 oraz art. 7
              ust. 1 RODO),
            </li>
            <li>
              po upływie tych terminów dane są trwale usuwane.
            </li>
          </ul>

          <h3>3.4. Wycofanie zgody</h3>
          <p>
            W dowolnym momencie możesz wycofać zgodę, wysyłając wiadomość na{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>
            . Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania,
            którego dokonano na podstawie zgody przed jej wycofaniem.
          </p>

          <h2>4. Twoje prawa</h2>
          <p>
            Masz prawo do dostępu do swoich danych, ich sprostowania, usunięcia,
            ograniczenia przetwarzania, wniesienia sprzeciwu, przeniesienia
            danych oraz wniesienia skargi do Prezesa Urzędu Ochrony Danych
            Osobowych.
          </p>

          <h2>5. Udostępnianie danych</h2>
          <p>
            Nie sprzedajemy ani nie udostępniamy Twoich danych osobom trzecim
            poza podmiotami niezbędnymi do obsługi korespondencji (dostawca
            skrzynki e-mail) oraz infrastruktury (hosting bazy danych). Z każdym
            z tych podmiotów wiążą nas umowy powierzenia przetwarzania danych.
          </p>

          <h2>6. Zmiany polityki i wersjonowanie zgody</h2>
          <p>
            Zastrzegamy sobie prawo do aktualizacji niniejszej polityki. Jeśli
            zmienimy treść klauzuli zgody formularza współpracy, podniesiemy jej
            numer wersji — kolejne zgłoszenia będą wymagały ponownej akceptacji.
          </p>
        </div>

        <div className="mt-10">
          <BackButton to="/" label="Wróć na stronę główną" />
        </div>
      </main>
    </div>
  );
}
