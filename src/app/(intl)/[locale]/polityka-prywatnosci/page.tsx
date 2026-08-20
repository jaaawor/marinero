import LegalPage, { legalMetadata } from "@/components/LegalPage"

export const revalidate = 300

type Props = {
  params: Promise<{ locale: string }>
}

export function generateMetadata() {
  return legalMetadata("polityka-prywatnosci", "Polityka prywatności")
}

export default async function Page({ params }: Props) {
  const { locale } = await params
  return <LegalPage slug="polityka-prywatnosci" locale={locale} fallbackTitle="Polityka prywatności" />
}
