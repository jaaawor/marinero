import Statystyki from "@/components/admin/Statystyki"
import AdminLogin from "@/components/admin/AdminLogin"
import { getAdminToken } from "@/lib/admin-auth"

export const metadata = {
  title: "Statystyki",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function StatystykiPage() {
  const token = await getAdminToken()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Narzędzia
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Statystyki</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#111827]/60">
            Które strony ludzie otwierają, czego szukają na stronie z łodziami i w sklepie,
            które konfiguratory przeklikują bez wysłania oferty oraz co mają w tej chwili
            w koszykach. Niczego nie wiążemy z osobami: zapisujemy
            adres strony, frazę i liczbę wyników — bez adresów IP i bez ciasteczek. Liczymy
            odsłony, nie ludzi.
          </p>
        </div>

        {token ? <Statystyki /> : <AdminLogin />}
      </div>
    </main>
  )
}
