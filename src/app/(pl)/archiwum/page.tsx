import LocalePage from "@/app/(intl)/[locale]/archiwum/page"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export function generateMetadata() {
  return {
    title: 'Archiwum modeli',
    description: 'Modele wycofane z produkcji — dane techniczne i zdjęcia zostają dla właścicieli i kupujących na rynku wtórnym.',
    alternates: localeAlternates("pl", "/archiwum"),
  }
}

export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
