import LocalePage, { generateMetadata as localeMetadata } from "@/app/(intl)/[locale]/sklep/produkt/[handle]/page"

export const revalidate = 300

type Props = {
  params: Promise<{ handle: string }>
}


// Tytuł i opis biorą się z tego samego miejsca co treść — polska wersja
// bez tego dostawała wspólny tytuł z layoutu.
export function generateMetadata({ params }: Props) {
  return localeMetadata({
    params: params.then(({ handle }) => ({ handle, locale: "pl" })),
  } as any)
}

// Polska wersja pod adresem bez prefiksu.
export default async function Page({ params }: Props) {
  const { handle } = await params
  return LocalePage({ params: Promise.resolve({ handle, locale: "pl" }) })
}
