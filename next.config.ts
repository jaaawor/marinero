import type { NextConfig } from "next";
import { STARE_ADRESY } from "./src/lib/stare-adresy";
import { STARY_SKLEP } from "./src/lib/stary-sklep";

// Stary sklep zostaje pod własną subdomeną tylko po to, żeby przekierować
// ruch i pozycje w wyszukiwarce. Warunek `has: host` pilnuje, żeby te reguły
// nie ruszyły niczego na `marinero.pl` — tam `/produkt/...` w ogóle nie istnieje.
const NA_SUBDOMENIE_SKLEPU = [{ type: "host" as const, value: "sklep.marinero.pl" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Wdrożenie buduje do osobnego katalogu (`NEXT_DIST_DIR=.next-build`)
  // i dopiero gotowy podmienia pod `.next`. Budowanie wprost do katalogu,
  // z którego serwer w tej chwili serwuje stronę, każe go najpierw zatrzymać
  // — a wtedy marinero.pl leży przez cały czas budowania. Bez zmiennej nic
  // się nie zmienia: lokalnie i przy `npm run build` dalej jest `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  async redirects() {
    return [
      // Lista modeli przeniosła się na `/lodzie` pod kafelki marek — dwie
      // bliźniacze strony to dwa miejsca do poprawiania i podział w wyszukiwarce.
      // Strony pojedynczych modeli (`/modele/<slug>`) zostają nietknięte.
      { source: "/modele", destination: "/lodzie#modele", permanent: true },
      { source: "/:locale(en|de|fr|ru|uk|it|es)/modele", destination: "/:locale/lodzie#modele", permanent: true },

      // Adresy ze starej strony marinero.pl — tabela w `src/lib/stare-adresy.ts`.
      // Jawne `statusCode: 301`, nie `permanent: true`: Next wystawia wtedy 308,
      // a część starszych narzędzi i katalogów branżowych rozumie tylko 301.
      ...Object.entries(STARE_ADRESY).map(([source, destination]) => ({
        source,
        destination,
        statusCode: 301 as const,
      })),

      // Produkty ze starego sklepu — tabela w `src/lib/stary-sklep.ts`.
      ...Object.entries(STARY_SKLEP).map(([source, destination]) => ({
        source,
        has: NA_SUBDOMENIE_SKLEPU,
        destination: `https://marinero.pl${destination}`,
        statusCode: 301 as const,
      })),

      // Reszta starego sklepu (koszyk, konto, wpisy z danych przykładowych
      // WooCommerce, produkty zdjęte ze sprzedaży) → strona sklepu. Ta reguła
      // musi stać **po** tabeli produktów, bo Next dopasowuje po kolei.
      {
        source: "/:sciezka*",
        has: NA_SUBDOMENIE_SKLEPU,
        destination: "https://marinero.pl/sklep",
        statusCode: 301 as const,
      },
    ];
  },
};

export default nextConfig;
