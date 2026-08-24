import LocalePage, { generateMetadata as intlMetadata } from "@/app/(intl)/[locale]/przyczepy/[slug]/page"

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) =>
  params.then(({ slug }) => intlMetadata({ params: Promise.resolve({ locale: "pl", slug }) }))

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return LocalePage({ params: Promise.resolve({ locale: "pl", slug }) })
}
