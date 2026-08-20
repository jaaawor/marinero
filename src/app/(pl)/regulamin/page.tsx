import LegalPage, { legalMetadata } from "@/components/LegalPage"

export const revalidate = 300

export function generateMetadata() {
  return legalMetadata("regulamin", "Regulamin")
}

// Polska wersja pod adresem bez prefiksu.
export default function Page() {
  return <LegalPage slug="regulamin" locale="pl" fallbackTitle="Regulamin" />
}
