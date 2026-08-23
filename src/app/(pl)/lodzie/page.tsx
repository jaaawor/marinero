import LocalePage from "@/app/(intl)/[locale]/lodzie/page"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export function generateMetadata() {
  return {
    title: 'Łodzie motorowe i katamarany',
    description: 'Łodzie motorowe, katamarany i RIB-y w ofercie Marinero: Jeanneau, Nordkapp, Sting, XO Boats i Aquila. Autoryzowany dealer, Gdynia.',
    alternates: localeAlternates("pl", "/lodzie"),
  }
}

export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
