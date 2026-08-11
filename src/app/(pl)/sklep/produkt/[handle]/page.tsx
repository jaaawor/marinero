import LocalePage from "@/app/(intl)/[locale]/sklep/produkt/[handle]/page"

export const revalidate = 300

type Props = {
  params: Promise<{ handle: string }>
}

// Polska wersja pod adresem bez prefiksu.
export default async function Page({ params }: Props) {
  const { handle } = await params
  return LocalePage({ params: Promise.resolve({ handle, locale: "pl" }) })
}
