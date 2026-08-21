import { BackButton } from "@/components/BackButton";
import { createFileRoute } from "@tanstack/react-router";
import { COLLAB_CONSENT_VERSION, TERMS_CONSENT_VERSION } from "@/lib/consent";

export const Route = createFileRoute("/polityka-prywatnosci")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności - poŻeramy" },
      {
        name: "description",
        content:
          "Informacje o przetwarzaniu danych osobowych w serwisie poŻeramy - konto, recenzje, cookies i formularz współpracy.",
      },
      { property: "og:title", content: "Polityka prywatności - poŻeramy" },
      {
        property: "og:description",
        content:
          "Jak przetwarzamy Twoje dane osobowe w poŻeramy - podstawy prawne, okres przechowywania i Twoje prawa.",
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
            Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")} · Wersja
            regulaminu/polityki: <strong>{TERMS_CONSENT_VERSION}</strong> · Wersja klauzuli zgody
            formularza współpracy: <strong>{COLLAB_CONSENT_VERSION}</strong>
          </p>

          <h2>1. Administrator danych</h2>
          <p>
            Administratorem danych osobowych jest zespół poŻeramy. Kontakt we wszystkich
            sprawach dotyczących danych osobowych:{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>
            .
          </p>

          <h2>2. Jakie dane zbieramy</h2>
          <p>
            Zakres zbieranych danych zależy od tego, jak korzystasz z Serwisu. Przeglądanie mapy
            i profili lokali nie wymaga podania żadnych danych. Poniżej opisujemy dane zbierane
            w poszczególnych sytuacjach.
          </p>

          <h3>2.1. Założenie i prowadzenie konta</h3>
          <ul className="list-disc pl-6">
            <li>adres e-mail i hasło (zapisywane w postaci zaszyfrowanej) - przy rejestracji e-mail/hasłem,</li>
            <li>imię, adres e-mail i zdjęcie profilowe udostępnione przez Google lub Apple - przy logowaniu przez te serwisy (§5),</li>
            <li>nick, wyświetlana nazwa, bio, dzielnica, ulubione kuchnie - dane, które sam/a uzupełniasz w profilu,</li>
            <li>zdjęcie profilowe, które wgrasz samodzielnie,</li>
            <li>opcjonalne linki do Twoich profili społecznościowych (Instagram, TikTok, YouTube, Facebook, X),</li>
            <li>data założenia konta i data ostatniej aktywności.</li>
          </ul>

          <h3>2.2. Treści, które publikujesz</h3>
          <ul className="list-disc pl-6">
            <li>recenzje, oceny i zdjęcia dodawane do profili lokali,</li>
            <li>komentarze pod recenzjami, wpisami blogowymi i na Pożeralni,</li>
            <li>listy zapisanych lokali („Chcę odwiedzić", „Odwiedzone", „Ulubione"),</li>
            <li>relacje ze znajomymi (zaproszenia, lista znajomych, blokady).</li>
          </ul>
          <p>
            Treści publiczne (recenzje, zdjęcia, profil publiczny) są domyślnie widoczne dla
            innych użytkowników i odwiedzających Serwis - możesz ograniczyć widoczność profilu w
            Ustawieniach („Profil publiczny").
          </p>

          <h3>2.3. Aktywność w Serwisie</h3>
          <ul className="list-disc pl-6">
            <li>punkty PoŻarcia, odznaki i rangi przyznawane automatycznie za aktywność,</li>
            <li>powiadomienia o aktywności znajomych,</li>
            <li>historia interakcji niezbędna do działania funkcji społecznościowych (np. kto kogo zaprosił).</li>
          </ul>

          <h3>2.4. Dane techniczne i cookies</h3>
          <ul className="list-disc pl-6">
            <li>
              pliki cookie i podobne technologie - szczegóły w §7. Zbierane wyłącznie za Twoją
              zgodą wyrażoną w banerze cookies (poza plikami niezbędnymi do działania Serwisu),
            </li>
            <li>
              anonimowe statystyki odwiedzin przez Google Analytics 4 - tylko po wyrażeniu
              zgody na kategorię „Analityka”,
            </li>
            <li>
              adres IP i standardowe logi serwera (data, godzina, adres URL) - przetwarzane
              automatycznie przez naszych dostawców infrastruktury w celach bezpieczeństwa,
            </li>
            <li>
              lokalizacja geograficzna (współrzędne GPS) - wyłącznie za Twoją zgodą wydaną
              przeglądarce, używana lokalnie do liczenia odległości do lokali i{" "}
              <strong>nigdy nie jest zapisywana na naszych serwerach</strong>.
            </li>
          </ul>

          <h2>3. Cele i podstawy prawne przetwarzania</h2>
          <ul className="list-disc pl-6">
            <li>
              <strong>Świadczenie usługi</strong> (założenie i prowadzenie konta, publikowanie
              treści, funkcje społecznościowe, system punktów) - {" "}
              <strong>art. 6 ust. 1 lit. b RODO</strong> (wykonanie umowy, którą zawierasz
              akceptując Regulamin przy rejestracji).
            </li>
            <li>
              <strong>Analityka i statystyki odwiedzin (Google Analytics 4)</strong> - {" "}
              <strong>art. 6 ust. 1 lit. a RODO</strong> (Twoja zgoda wyrażona w banerze
              cookies, w każdej chwili odwołalna).
            </li>
            <li>
              <strong>Bezpieczeństwo, przeciwdziałanie nadużyciom i dochodzenie roszczeń</strong>{" "}
              (m.in. blokowanie spamu, logi serwera, moderacja treści) - {" "}
              <strong>art. 6 ust. 1 lit. f RODO</strong> (nasz uzasadniony interes).
            </li>
            <li>
              <strong>Formularz „Współpraca"</strong> - jak opisano szczegółowo w §4 poniżej.
            </li>
          </ul>

          <h2>4. Formularz „Współpraca" - szczegóły</h2>

          <h3>4.1. Jakie dane zbieramy</h3>
          <p>
            Przez formularz współpracy zbieramy dane, które podasz dobrowolnie: nazwę marki lub
            lokalu, adres e-mail oraz treść wiadomości. Dodatkowo automatycznie zapisujemy datę i
            godzinę wysłania formularza, wersję zaakceptowanej klauzuli zgody, dokładny moment
            akceptacji oraz identyfikator przeglądarki (user agent) - wyłącznie w celach
            bezpieczeństwa i ochrony przed spamem.
          </p>

          <h3>4.2. Cel przetwarzania</h3>
          <ul className="list-disc pl-6">
            <li>odpowiedź na Twoje zapytanie i kontakt zwrotny,</li>
            <li>ewentualne nawiązanie i prowadzenie współpracy biznesowej,</li>
            <li>archiwizacja korespondencji oraz dowodu wyrażenia zgody na potrzeby rozliczalności (art. 7 ust. 1 RODO),</li>
            <li>ochrona przed spamem i nadużyciami (honeypot, walidacja czasu wypełnienia formularza).</li>
          </ul>

          <h3>4.3. Podstawa prawna</h3>
          <ul className="list-disc pl-6">
            <li>
              <strong>Art. 6 ust. 1 lit. a RODO</strong> - Twoja dobrowolna zgoda wyrażona przez
              zaznaczenie checkboxa. Bez zgody formularz nie zostanie zapisany ani wysłany
              (blokada na poziomie aplikacji i bazy danych).
            </li>
            <li>
              <strong>Art. 6 ust. 1 lit. f RODO</strong> - nasz uzasadniony interes polegający na
              archiwizacji korespondencji, dochodzeniu lub obronie przed ewentualnymi
              roszczeniami oraz ochronie usługi przed nadużyciami.
            </li>
          </ul>

          <h3>4.4. Okres przechowywania</h3>
          <ul className="list-disc pl-6">
            <li>
              treść zgłoszenia i dane kontaktowe - przez <strong>24 miesiące</strong> od
              ostatniego kontaktu, a w razie nawiązania współpracy - przez czas trwania umowy
              oraz okres przedawnienia roszczeń,
            </li>
            <li>
              dowód wyrażenia zgody (wersja klauzuli, data i godzina akceptacji) - przez okres
              przedawnienia roszczeń (do <strong>6 lat</strong>), zgodnie z obowiązkiem
              rozliczalności (art. 5 ust. 2 oraz art. 7 ust. 1 RODO),
            </li>
            <li>po upływie tych terminów dane są trwale usuwane.</li>
          </ul>

          <h3>4.5. Wycofanie zgody</h3>
          <p>
            W dowolnym momencie możesz wycofać zgodę, wysyłając wiadomość na{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>
            . Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania, którego dokonano na
            podstawie zgody przed jej wycofaniem.
          </p>

          <h2>5. Logowanie przez Google i Apple</h2>
          <p>
            Możesz założyć konto lub zalogować się przy użyciu konta Google lub Apple. W takim
            przypadku otrzymujemy od tych dostawców Twój adres e-mail, imię i (opcjonalnie)
            zdjęcie profilowe - wyłącznie w zakresie, na jaki wyrazisz zgodę w oknie logowania
            danego dostawcy. Google i Apple działają wtedy jako odrębni administratorzy danych w
            zakresie logowania; korzystanie z ich usług podlega również ich własnym politykom
            prywatności.
          </p>

          <h2>6. Komu udostępniamy dane (podmioty przetwarzające)</h2>
          <p>
            Nie sprzedajemy Twoich danych. Korzystamy z poniższych dostawców, którzy przetwarzają
            dane w naszym imieniu na podstawie zawartych z nimi umów powierzenia przetwarzania
            danych (art. 28 RODO):
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Supabase Inc.</strong> - baza danych, uwierzytelnianie kont i przechowywanie
              zdjęć (serwery w regionie UE - Irlandia).
            </li>
            <li>
              <strong>Vercel Inc.</strong> - hosting i serwowanie Serwisu.
            </li>
            <li>
              <strong>Resend</strong> - wysyłka wiadomości e-mail (potwierdzenie rejestracji,
              powiadomienia, korespondencja).
            </li>
            <li>
              <strong>Google LLC</strong> - logowanie przez konto Google (§5) oraz, po Twojej
              zgodzie, Google Analytics 4 (statystyki odwiedzin).
            </li>
            <li>
              <strong>Apple Inc.</strong> - logowanie przez konto Apple (§5).
            </li>
          </ul>
          <p>
            Część z tych podmiotów (Google, Apple) ma siedzibę poza Europejskim Obszarem
            Gospodarczym. Przekazanie danych odbywa się w oparciu o mechanizmy zapewniające
            odpowiedni poziom ochrony przewidziane w RODO, w tym standardowe klauzule umowne
            zatwierdzone przez Komisję Europejską.
          </p>
          <p>
            Dane możemy również udostępnić organom publicznym, jeśli wynika to z obowiązujących
            przepisów prawa.
          </p>

          <h2>7. Pliki cookies</h2>
          <p>
            Przy pierwszej wizycie w Serwisie wyświetlamy baner, w którym decydujesz, na jakie
            kategorie plików cookie się zgadzasz. Zgodnie z Google Consent Mode v2, domyślnie - zanim podejmiesz decyzję - wszystkie pliki niewymagane do działania Serwisu są
            wyłączone.
          </p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Niezbędne</strong> - zawsze aktywne, odpowiadają za logowanie i
              bezpieczeństwo sesji; bez nich Serwis nie działa poprawnie.
            </li>
            <li>
              <strong>Analityczne</strong> - Google Analytics 4, włączane wyłącznie po Twojej
              zgodzie; pomagają nam zrozumieć, jak używany jest Serwis.
            </li>
            <li>
              <strong>Marketingowe</strong> - sygnały zgody Google (ad_storage, ad_user_data,
              ad_personalization); Serwis nie wyświetla obecnie reklam firm trzecich - banery
              promocyjne widoczne w aplikacji to własne ogłoszenia poŻeramy, niepowiązane z
              zewnętrznymi sieciami reklamowymi.
            </li>
          </ul>
          <p>
            Swoją decyzję możesz zmienić w każdej chwili w ustawieniach cookies dostępnych w
            stopce Serwisu. Zapisujemy Twój wybór lokalnie w przeglądarce oraz - w formie
            zanonimizowanej, bez powiązania z Twoim kontem - w naszej bazie danych, jako dowód
            udzielonej zgody.
          </p>

          <h2>8. Okres przechowywania danych konta</h2>
          <p>
            Dane konta przechowujemy przez cały czas jego istnienia. Możesz samodzielnie i
            trwale usunąć konto w Ustawieniach profilu - usuwa to konto oraz powiązane z nim
            recenzje, listy, znajomości, powiadomienia i punkty. Jeśli konto pozostaje nieaktywne
            (bez logowania) przez ponad 3 lata, zastrzegamy sobie prawo do jego usunięcia po
            uprzednim powiadomieniu e-mailowym.
          </p>

          <h2>9. Twoje prawa</h2>
          <p>
            W związku z przetwarzaniem Twoich danych osobowych przysługuje Ci prawo do:
          </p>
          <ul className="list-disc pl-6">
            <li>dostępu do swoich danych,</li>
            <li>sprostowania (poprawienia) danych,</li>
            <li>usunięcia danych („prawo do bycia zapomnianym"),</li>
            <li>ograniczenia przetwarzania,</li>
            <li>wniesienia sprzeciwu wobec przetwarzania,</li>
            <li>przenoszenia danych,</li>
            <li>wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.</li>
          </ul>
          <p>
            Dane profilu możesz podejrzeć i poprawić samodzielnie w Ustawieniach. Konto wraz ze
            wszystkimi powiązanymi danymi możesz usunąć samodzielnie w Ustawieniach profilu
            (przycisk „Usuń konto") - to najszybszy sposób realizacji prawa do usunięcia danych.
            W sprawie pozostałych żądań (np. eksportu danych w formacie do odczytu maszynowego)
            napisz na{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>{" "} - odpowiadamy w terminie do 30 dni.
          </p>

          <h2>10. Bezpieczeństwo danych</h2>
          <p>
            Hasła do kont są przechowywane wyłącznie w postaci zaszyfrowanej. Komunikacja
            z Serwisem odbywa się przez szyfrowane połączenie HTTPS. Dostęp do danych w bazie
            ograniczony jest regułami bezpieczeństwa na poziomie wierszy (Row Level Security),
            tak aby użytkownicy mieli dostęp wyłącznie do danych, do których są uprawnieni.
          </p>

          <h2>11. Zmiany polityki i wersjonowanie zgody</h2>
          <p>
            Zastrzegamy sobie prawo do aktualizacji niniejszej polityki, w szczególności w
            związku ze zmianą funkcjonalności Serwisu, wykorzystywanych dostawców lub przepisów
            prawa. Jeśli zmienimy treść klauzuli zgody formularza współpracy lub regulaminu,
            podniesiemy numer ich wersji - kolejne zgłoszenia i rejestracje będą wymagały
            ponownej akceptacji. O istotnych zmianach poinformujemy w Serwisie.
          </p>
        </div>

        <div className="mt-10">
          <BackButton to="/" label="Wróć na stronę główną" />
        </div>
      </main>
    </div>
  );
}
