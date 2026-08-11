import LocalePage from "@/app/(intl)/[locale]/sklep/page"

export const revalidate = 300

// Polska wersja strony głównej sklepu pod adresem bez prefiksu.
export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
