import ChannelPrices from "@/components/admin/ChannelPrices"
import AdminLogin from "@/components/admin/AdminLogin"
import { getAdminToken } from "@/lib/admin-auth"

export const metadata = {
  title: "Ceny na Allegro",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  const token = await getAdminToken()

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Narzędzia
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Ceny na Allegro</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#111827]/60">
            Ceny pobrane z Allegro obok cen ze sklepu i obok tego, ile wyszłoby z reguł
            w <code className="text-sm">channel-pricing.ts</code>. Ta strona{" "}
            <strong>niczego nie wysyła</strong> — służy do porównania, zanim ustalimy,
            które ceny mają się przeliczać automatycznie.
          </p>
        </div>

        {token ? <ChannelPrices /> : <AdminLogin />}
      </div>
    </main>
  )
}
