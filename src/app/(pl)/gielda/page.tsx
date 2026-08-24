import LocalePage, { generateMetadata as intlMetadata } from "@/app/(intl)/[locale]/gielda/page"

// Wersja polska pod adresem bez prefiksu. `generateMetadata` MUSI być
// przekazane z wersji `(intl)` — inaczej strona dostaje wspólny tytuł z layoutu.
export const generateMetadata = () => intlMetadata({ params: Promise.resolve({ locale: "pl" }) })

export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
