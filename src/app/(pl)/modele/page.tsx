import LocalePage from "@/app/(intl)/[locale]/modele/page"
import { localeAlternates } from "@/lib/seo"

export const revalidate = 60

type Props = {
  searchParams?: Promise<{ brand?: string; series?: string }>
}

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export function generateMetadata() {
  return {
    title: 'Wszystkie modele łodzi',
    description: 'Pełna lista modeli łodzi z filtrami po marce i serii — długość, szerokość, liczba kabin i cena bazowa każdego modelu.',
    alternates: localeAlternates("pl", "/modele"),
  }
}

export default async function Page({ searchParams }: Props) {
  return LocalePage({
    params: Promise.resolve({ locale: "pl" }),
    searchParams,
  })
}
