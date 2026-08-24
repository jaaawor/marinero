import LocalePage, { generateMetadata as intlMetadata } from "@/app/(intl)/[locale]/przyczepy/page"

export const generateMetadata = () => intlMetadata({ params: Promise.resolve({ locale: "pl" }) })

export default async function Page() {
  return LocalePage({ params: Promise.resolve({ locale: "pl" }) })
}
