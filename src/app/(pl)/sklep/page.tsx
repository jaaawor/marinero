import LocalePage from "@/app/(intl)/[locale]/sklep/page"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 300

// Polska wersja strony głównej sklepu pod adresem bez prefiksu.
export function generateMetadata() {
  return {
    title: 'Sklep — części, akcesoria i elektronika',
    description: 'Części i akcesoria do łodzi, silniki zaburtowe, elektronika Garmin i Lowrance, oleje i chemia. Wysyłka w 24 h, odbiór osobisty w Gdyni.',
    alternates: localeAlternates("pl", "/sklep"),
  }
}

export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
