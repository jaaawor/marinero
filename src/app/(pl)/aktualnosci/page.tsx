import LocalePage from "@/app/(intl)/[locale]/aktualnosci/page"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export function generateMetadata() {
  return {
    title: 'Aktualności',
    description: 'Nowości, testy łodzi, relacje z targów i porady serwisowe od zespołu Marinero.',
    alternates: localeAlternates("pl", "/aktualnosci"),
  }
}

export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
