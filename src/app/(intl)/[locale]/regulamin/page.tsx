import LegalPage, { legalMetadata } from "@/components/LegalPage"

export const revalidate = 300

type Props = {
  params: Promise<{ locale: string }>
}

export function generateMetadata() {
  return legalMetadata("regulamin", "Regulamin")
}

export default async function Page({ params }: Props) {
  const { locale } = await params
  return <LegalPage slug="regulamin" locale={locale} fallbackTitle="Regulamin" />
}
