import LocalePage from "@/app/(intl)/[locale]/sklep/page"

export const revalidate = 300

type Props = {
  searchParams?: Promise<{ q?: string; sort?: string; strona?: string }>
}

// Polska wersja pod adresem bez prefiksu.
export default async function Page({ searchParams }: Props) {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }), searchParams })
}
