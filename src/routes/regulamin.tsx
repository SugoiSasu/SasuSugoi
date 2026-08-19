import { BackButton } from "@/components/BackButton";
import { createFileRoute } from "@tanstack/react-router";
import { TERMS_CONSENT_VERSION } from "@/lib/consent";

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
            Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")} · Wersja:{" "}
            <strong>{TERMS_CONSENT_VERSION}</strong>
          </p>

          <h2>1. Postanowienia ogólne</h2>
          <p>
            Niniejszy Regulamin określa zasady korzystania z serwisu internetowego poŻeramy,
            dostępnego pod adresem pozeramy.live (dalej: „Serwis"). Serwis prowadzony jest przez
            jego administratora, z którym można się skontaktować pod adresem{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>
            .
          </p>
          <p>
            Korzystając z Serwisu — w tym przeglądając mapę i profile lokali bez zakładania konta
            — akceptujesz warunki opisane w niniejszym Regulaminie. Założenie konta wymaga
            wyraźnej akceptacji Regulaminu i{" "}
            <a href="/polityka-prywatnosci" className="text-tomato underline">
              Polityki prywatności
            </a>
            .
          </p>

          <h2>2. Czym jest poŻeramy</h2>
          <p>Serwis umożliwia:</p>
          <ul className="list-disc pl-6">
            <li>przeglądanie mapy i profili restauracji, barów i innych lokali gastronomicznych w Poznaniu,</li>
            <li>dodawanie recenzji, ocen i zdjęć lokali przez zarejestrowanych użytkowników,</li>
            <li>zapisywanie lokali na prywatnych listach („Chcę odwiedzić", „Odwiedzone", „Ulubione"),</li>
            <li>
              funkcje społecznościowe: dodawanie znajomych, przeglądanie ich aktywności
              („Pożeralnia"), ranking punktowy,
            </li>
            <li>system punktów PoŻarcia, odznak (achievementów) i rang — opisany w §5,</li>
            <li>zgłaszanie właścicielom lokali statusu „zweryfikowany właściciel" i samodzielną edycję podstawowych danych lokalu,</li>
            <li>czytanie artykułów blogowych publikowanych przez redakcję Serwisu.</li>
          </ul>

          <h2>3. Konto użytkownika</h2>
          <p>
            Rejestracja konta wymaga podania prawdziwego adresu e-mail i ustawienia hasła (lub
            zalogowania się przez Google/Apple) oraz — przy rejestracji e-mail/hasłem —
            potwierdzenia adresu przez link aktywacyjny. Jedno konto może należeć do jednej
            osoby fizycznej; zabronione jest udostępnianie konta osobom trzecim oraz zakładanie
            wielu kont w celu obejścia limitów lub manipulowania rankingiem punktowym.
          </p>
          <p>
            Z Serwisu mogą korzystać osoby, które ukończyły <strong>16. rok życia</strong>. Osoby
            poniżej tego wieku mogą korzystać z Serwisu wyłącznie za zgodą i pod nadzorem
            rodzica lub opiekuna prawnego.
          </p>
          <p>
            Możesz w każdej chwili trwale usunąć swoje konto samodzielnie — opcja „Usuń konto"
            dostępna jest w Ustawieniach profilu. Usunięcie konta jest nieodwracalne i kasuje
            powiązane z nim recenzje, listy, znajomości i punkty, zgodnie z{" "}
            <a href="/polityka-prywatnosci" className="text-tomato underline">
              Polityką prywatności
            </a>
            .
          </p>

          <h2>4. Zasady publikowania treści</h2>
          <p>
            Publikując recenzje, zdjęcia, komentarze, wiadomości na Pożeralni i inne treści
            (dalej: „Treści"), oświadczasz, że przysługują Ci do nich prawa oraz że nie naruszają
            one prawa, praw osób trzecich, dóbr osobistych ani dobrych obyczajów. W Serwisie
            zabronione jest publikowanie:
          </p>
          <ul className="list-disc pl-6">
            <li>treści obraźliwych, dyskryminujących, nawołujących do nienawiści lub przemocy,</li>
            <li>fałszywych recenzji (w tym recenzji własnego lokalu lub zamówionych u osób trzecich w celu wprowadzenia w błąd),</li>
            <li>spamu, niezamówionych reklam oraz treści niezwiązanych z tematyką Serwisu,</li>
            <li>materiałów naruszających prawa autorskie osób trzecich,</li>
            <li>danych osobowych innych osób bez ich zgody,</li>
            <li>treści niezgodnych z obowiązującym prawem.</li>
          </ul>
          <p>
            Administrator zastrzega sobie prawo do usunięcia Treści naruszających Regulamin oraz
            zawieszenia lub usunięcia konta użytkownika w przypadku rażącego lub powtarzającego
            się naruszenia niniejszych zasad.
          </p>

          <h2>5. Punkty PoŻarcia, odznaki i status VIP</h2>
          <p>
            Punkty PoŻarcia, odznaki (achievementy) i rangi (w tym status VIP) to elementy
            grywalizacji Serwisu — mają charakter wyłącznie kosmetyczny/prestiżowy, nie
            stanowią waluty, punktów lojalnościowych o wartości pieniężnej ani prawa majątkowego
            i nie podlegają wymianie na pieniądze, towary ani usługi. Administrator zastrzega
            sobie prawo do korekty liczby punktów, cofnięcia odznaki lub statusu VIP w przypadku
            stwierdzenia, że zostały uzyskane niezgodnie z Regulaminem (np. przez zakładanie
            wielu kont, fałszywe recenzje lub wykorzystanie błędu w działaniu Serwisu).
          </p>

          <h2>6. Właściciele lokali</h2>
          <p>
            Osoba faktycznie prowadząca lokal gastronomiczny może zgłosić się o status
            „zweryfikowany właściciel" tego lokalu w Serwisie. Po weryfikacji przez
            Administratora właściciel może samodzielnie edytować wybrane dane swojego lokalu
            (m.in. dane kontaktowe, godziny otwarcia, menu). Właściciel odpowiada za zgodność
            wprowadzanych przez siebie danych ze stanem faktycznym. Status właściciela nie daje
            prawa do usuwania, ukrywania ani edytowania recenzji innych użytkowników.
          </p>

          <h2>7. Odpowiedzialność</h2>
          <p>
            Administrator dokłada starań, aby informacje o lokalach (godziny otwarcia, menu,
            dane kontaktowe) były aktualne, jednak w dużej mierze pochodzą one od użytkowników
            i właścicieli lokali — Administrator nie gwarantuje ich pełnej aktualności ani
            poprawności i zaleca każdorazową weryfikację przed wizytą. Administrator nie ponosi
            odpowiedzialności za Treści publikowane przez użytkowników ani za decyzje (w tym
            decyzje konsumenckie) podjęte na ich podstawie, z zastrzeżeniem bezwzględnie
            obowiązujących przepisów prawa.
          </p>

          <h2>8. Prawa autorskie i licencja</h2>
          <p>
            Publikując Treść w Serwisie, udzielasz Administratorowi niewyłącznej, nieodpłatnej,
            obowiązującej przez czas publikacji Treści licencji na jej przechowywanie,
            wyświetlanie i dystrybucję w ramach funkcjonalności Serwisu (w tym w wynikach
            wyszukiwania i podglądach udostępnianych przez narzędzia integracyjne opisane w
            Polityce prywatności). Pozostajesz właścicielem swoich Treści i możesz zażądać ich
            usunięcia w każdej chwili.
          </p>

          <h2>9. Zawieszenie i usunięcie konta przez Administratora</h2>
          <p>
            Administrator może zawiesić lub usunąć konto użytkownika w przypadku rażącego
            naruszenia Regulaminu, prób oszustwa, wielokrotnego naruszania zasad publikowania
            treści (§4) lub działania na szkodę Serwisu lub innych użytkowników — po uprzednim
            wezwaniu do zaprzestania naruszeń, chyba że charakter naruszenia uzasadnia
            natychmiastowe działanie (np. treści niezgodne z prawem).
          </p>

          <h2>10. Reklamacje i kontakt</h2>
          <p>
            Reklamacje dotyczące działania Serwisu oraz pytania kieruj na{" "}
            <a href="mailto:po_zeramy@gmail.com" className="text-tomato underline">
              po_zeramy@gmail.com
            </a>
            , podając login/e-mail konta oraz opis problemu. Odpowiadamy w rozsądnym terminie,
            zwykle do 14 dni roboczych.
          </p>

          <h2>11. Zmiany Regulaminu</h2>
          <p>
            Administrator zastrzega prawo do aktualizacji Regulaminu, w szczególności w związku
            ze zmianą funkcjonalności Serwisu lub przepisów prawa. O istotnych zmianach
            poinformujemy w Serwisie lub mailowo z odpowiednim wyprzedzeniem. Dalsze korzystanie
            z Serwisu po wejściu zmian w życie oznacza ich akceptację; w przypadku braku zgody na
            zmiany możesz usunąć swoje konto zgodnie z §3.
          </p>

          <h2>12. Postanowienia końcowe</h2>
          <p>
            W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają przepisy prawa
            polskiego, w tym Kodeksu cywilnego oraz ustawy o świadczeniu usług drogą
            elektroniczną. Jeżeli jesteś konsumentem, przysługują Ci uprawnienia wynikające z
            bezwzględnie obowiązujących przepisów prawa konsumenckiego niezależnie od
            postanowień niniejszego Regulaminu.
          </p>
        </div>

        <div className="mt-10">
          <BackButton to="/" label="Wróć na stronę główną" />
        </div>
      </main>
    </div>
  );
}
