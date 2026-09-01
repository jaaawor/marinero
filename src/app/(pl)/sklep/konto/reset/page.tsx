import LocalePage from "@/app/(intl)/[locale]/sklep/konto/reset/page"

// Polska wersja pod adresem bez prefiksu.
export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
