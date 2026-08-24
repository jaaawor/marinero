import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async redirects() {
    return [
      // Lista modeli przeniosła się na `/lodzie` pod kafelki marek — dwie
      // bliźniacze strony to dwa miejsca do poprawiania i podział w wyszukiwarce.
      // Strony pojedynczych modeli (`/modele/<slug>`) zostają nietknięte.
      { source: "/modele", destination: "/lodzie#modele", permanent: true },
      { source: "/:locale(en|de|fr|ru|uk|it|es)/modele", destination: "/:locale/lodzie#modele", permanent: true },
    ];
  },
};

export default nextConfig;
