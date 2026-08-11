import LocalePage from "@/app/(intl)/[locale]/sklep/kategoria/[handle]/page"

export const revalidate = 300

type Props = {
  params: Promise<{ handle: string }>
  searchParams?: Promise<{ strona?: string }>
}

// Polska wersja pod adresem bez prefiksu.
export default async function Page({ params, searchParams }: Props) {
  const { handle } = await params
  return LocalePage({ params: Promise.resolve({ handle, locale: "pl" }), searchParams })
}
