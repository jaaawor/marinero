import LocalePage, { generateMetadata as localeMetadata } from "@/app/(intl)/[locale]/marki/[slug]/page"

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
}


// Tytuł i opis biorą się z tego samego miejsca co treść — polska wersja
// bez tego dostawała wspólny tytuł z layoutu.
export function generateMetadata({ params }: Props) {
  return localeMetadata({
    params: params.then(({ slug }) => ({ slug, locale: "pl" })),
  } as any)
}

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export default async function Page({ params }: Props) {
  const { slug } = await params
  return LocalePage({ params: Promise.resolve({ slug, locale: "pl" }) })
}
