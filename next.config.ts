import type { NextConfig } from "next";
import { STARE_ADRESY } from "./src/lib/stare-adresy";

const nextConfig: NextConfig = {
  poweredByHeader: false,

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
    ];
  },
};

export default nextConfig;
