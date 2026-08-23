import type { Metadata } from "next"
import PaymentResult from "@/components/shop/PaymentResult"

export const metadata: Metadata = {
  title: "Płatność — Marinero",
  // Strona wyniku płatności nie ma czego szukać w wyszukiwarce.
  robots: { index: false, follow: false },
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ zamowienie?: string }>
}) {
  const params = await searchParams
  return <PaymentResult orderId={params?.zamowienie || ""} locale="pl" />
}
