import LocalePage from "@/app/(intl)/[locale]/modele/page"

export const revalidate = 60

type Props = {
  searchParams?: Promise<{ brand?: string; series?: string }>
}

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export default async function Page({ searchParams }: Props) {
  return LocalePage({
    params: Promise.resolve({ locale: "pl" }),
    searchParams,
  })
}
