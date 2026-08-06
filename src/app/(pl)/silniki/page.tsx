import LocalePage from "@/app/(intl)/[locale]/silniki/page"

export const revalidate = 60

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
