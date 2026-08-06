import type { Metadata } from "next";
import "../globals.css";
import { LOCALES, normalizeLocale } from "@/lib/i18n";

const siteUrl = "https://marinero.150197.pl";

export const metadata: Metadata = {
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

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  return (
    <html lang={normalizeLocale(locale)}>
      <body>{children}</body>
    </html>
  );
}
