import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

// Bez tego pliku serwis nie mówił robotom niczego, a mapa strony była
// nie do znalezienia.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Feed do Merchant Center **musi być przepuszczony**, choć siedzi pod
        // `/api/`: Google pobiera go Googlebotem i honoruje robots.txt, więc
        // przy samym `Disallow: /api/` zaplanowane pobranie kończy się błędem
        // „URL zablokowany przez robots.txt", a w panelu Merchanta wygląda to
        // jak zepsuty adres. Reguła bardziej szczegółowa wygrywa z ogólną.
        allow: ["/", "/api/merchant/feed"],
        // `/konfigurator/[slug]` istnieje technicznie, ale nie linkujemy do
        // niego — konfigurator siedzi na stronie modelu. Koszyk i zamówienie
        // to strony jednorazowe, nie ma czego indeksować.
        //
        // **Adresy z filtrami zamykamy przed robotami.** Sześć filtrów
        // wielokrotnego wyboru w ośmiu językach to nie „kilka podstron", tylko
        // przestrzeń kombinacji bez dna, a każdy taki adres jest **dynamiczny**:
        // nie ma go w cache'u ISR, więc każde wejście to pełny render i pobranie
        // całego katalogu z Medusy (cztery strony po sto pozycji). Roboty właśnie
        // to robiły — w logu nginxa stoją zapytania w rodzaju
        // `/fr/sklep/produkty?dostepnosc=…&kolumna=X,S,XX&marki=Dometic,…&moc=…`
        // z pięciu różnych indeksatorów naraz — i pod tym Medusa się położyła
        // (`connect() failed (111: Connection refused)`).
        //
        // Nic przez to nie tracimy w wyszukiwarce: każdy produkt i każda
        // kategoria są w `sitemap.xml` pod własnym, czystym adresem. Filtry są
        // narzędziem dla człowieka, nie treścią do zaindeksowania — a dla Google
        // wyglądały jak tysiące niemal identycznych stron.
        disallow: [
          "/api/",
          "/konfigurator/",
          "/sklep/koszyk",
          "/sklep/zamowienie",
          // Wzorce dopasowują się do adresu **razem z zapytaniem**, więc łapią
          // też wersje językowe (`/fr/sklep/…`) i dowolną kolejność parametrów.
          "/*?*marki=",
          "/*?*marka=",
          "/*?*dostepnosc=",
          "/*?*moc=",
          "/*?*kolumna=",
          "/*?*sterowanie=",
          "/*?*paliwo=",
          "/*?*cena_od=",
          "/*?*cena_do=",
          "/*?*strona=",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
