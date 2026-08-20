import LegalPage, { legalMetadata } from "@/components/LegalPage"

export const revalidate = 300

export function generateMetadata() {
  return legalMetadata("polityka-prywatnosci", "Polityka prywatności")
}

// Polska wersja pod adresem bez prefiksu.
export default function Page() {
  return <LegalPage slug="polityka-prywatnosci" locale="pl" fallbackTitle="Polityka prywatności" />
}
