import LocalePage from "@/app/(intl)/[locale]/silniki/page"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export function generateMetadata() {
  return {
    title: 'Silniki zaburtowe Suzuki i Mercury',
    description: 'Silniki zaburtowe Suzuki (DF 6A–300AP) i Mercury (F 5–150, Verado 250/300). Autoryzowany dealer i serwis w Gdyni.',
    alternates: localeAlternates("pl", "/silniki"),
  }
}

export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
