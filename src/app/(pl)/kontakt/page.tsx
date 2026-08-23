import LocalePage, { generateMetadata as localeMetadata } from "@/app/(intl)/[locale]/kontakt/page"

export const revalidate = 60

export function generateMetadata() {
  return localeMetadata({ params: Promise.resolve({ locale: "pl" }) })
}

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
