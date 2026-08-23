import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

// Bez tego pliku serwis nie mówił robotom niczego, a mapa strony była
// nie do znalezienia.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // `/konfigurator/[slug]` istnieje technicznie, ale nie linkujemy do
        // niego — konfigurator siedzi na stronie modelu. Koszyk i zamówienie
        // to strony jednorazowe, nie ma czego indeksować.
        disallow: ["/api/", "/konfigurator/", "/sklep/koszyk", "/sklep/zamowienie"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
