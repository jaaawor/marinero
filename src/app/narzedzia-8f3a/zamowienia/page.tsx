import Zamowienia from "@/components/admin/Zamowienia"
import AdminLogin from "@/components/admin/AdminLogin"
import { getAdminToken } from "@/lib/admin-auth"

export const metadata = {
  title: "Zamówienia ze sklepu",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function OrdersPage() {
  const token = await getAdminToken()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Narzędzia
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Zamówienia ze sklepu</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#111827]/60">
            Zamówienia z marinero.pl — z płatnością PayU widoczną obok stanu z Medusy.
            Stan obsługi, numer przesyłki i uwagi zapisują się przy zamówieniu, a stąd
            wyślesz też ponownie potwierdzenie dla klienta.
          </p>
        </div>

        {token ? <Zamowienia /> : <AdminLogin />}
      </div>
    </main>
  )
}
