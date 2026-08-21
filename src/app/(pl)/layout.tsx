import type { Metadata } from "next";
import Analytics from "@/components/Analytics";
import { getSiteSettings } from "@/lib/directus";
import "../globals.css";


const siteUrl = "https://marinero.150197.pl";

const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Marinero | Łodzie, katamarany i silniki zaburtowe",
    template: "%s | Marinero",
  },

  description:
    "Marinero — sprzedaż, serwis i doradztwo przy wyborze łodzi motorowych, katamaranów i silników zaburtowych.",

  keywords: [
    "Marinero",
    "łodzie motorowe",
    "katamarany",
    "silniki zaburtowe",
    "Nordkapp Boats",
    "Sting Boats",
    "XO Boats",
    "Jeanneau",
    "Aquila",
    "Mercury",
    "Suzuki",
  ],

  authors: [{ name: "Marinero" }],
  creator: "Marinero",
  publisher: "Marinero",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: siteUrl,
    siteName: "Marinero",
    title: "Marinero | Łodzie, katamarany i silniki zaburtowe",
    description:
      "Sprzedaż, serwis i doradztwo przy wyborze łodzi motorowych, katamaranów i silników zaburtowych.",
    images: [
      {
        url: "/logo-marinero.png",
        width: 1200,
        height: 630,
        alt: "Marinero",
      },
    ],
  },

  robots: {
    index: true,
    follow: true,
  },
};

// Odświeżamy co 5 minut, żeby klucze wpisane w Directusie zaczęły działać
// bez przebudowy strony.
export const revalidate = 300;

export default async function PolishRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings().catch(() => null);

  return (
    <html lang="pl">
      <body>
        {children}

        {/* Bez identyfikatorów nic się nie ładuje — patrz `Analytics`. */}
        <Analytics
          ga={settings?.ga_id || process.env.GA_ID}
          ads={settings?.google_ads_id || process.env.GOOGLE_ADS_ID}
        />
      </body>
    </html>
  );
}

// Weryfikacja Search Console / Merchant Center wpisywana w Directusie —
// dzięki temu klient wkleja token w panelu, bez wdrożenia.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => null);
  const token = settings?.google_site_verification || process.env.GOOGLE_SITE_VERIFICATION;

  return token ? { ...baseMetadata, verification: { google: token } } : baseMetadata;
}
