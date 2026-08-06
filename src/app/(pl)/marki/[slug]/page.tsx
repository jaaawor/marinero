import LocalePage from "@/app/(intl)/[locale]/marki/[slug]/page"

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
}

// Polska wersja pod adresem bez prefiksu — renderuje ten sam komponent z locale "pl".
export default async function Page({ params }: Props) {
  const { slug } = await params
  return LocalePage({ params: Promise.resolve({ slug, locale: "pl" }) })
}
