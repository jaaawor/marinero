import AdminLogin from "@/components/admin/AdminLogin"
import AllegroOrders from "@/components/admin/AllegroOrders"
import { getAdminToken } from "@/lib/admin-auth"

export const metadata = {
  title: "Zamówienia z Allegro",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AllegroOrdersPage() {
  const token = await getAdminToken()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[1200px] px-5 py-12 md:px-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Narzędzia
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Zamówienia z Allegro
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#111827]/60">
            Przyjęcie do realizacji, numer przesyłki i oznaczenie jako wysłane — bez
            przełączania się na portal. Zmiany idą wprost do Allegro i kupujący widzi
            je u siebie. Płatności i zwroty zostają po stronie Allegro.
          </p>
        </div>

        {token ? <AllegroOrders /> : <AdminLogin />}
      </div>
    </main>
  )
}
