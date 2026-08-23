import PriceListImport from "@/components/admin/PriceListImport"
import { currentUser, getAdminToken } from "@/lib/admin-auth"

// Narzędzie wewnętrzne — nigdy nie ma go w mapie strony ani w wynikach Google.
export const metadata = {
  title: "Cenniki",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function PriceListPage() {
  const token = await getAdminToken()
  const user = token ? await currentUser(token) : null
  const name = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email : null

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[1200px] px-5 py-12 md:px-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Narzędzia
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Aktualizacja cenników
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#111827]/60">
            Wgrywasz cennik od producenta w tej postaci, w jakiej go dostałeś.
            Dopasowuję pozycje do modeli w bazie i pokazuję tabelę: co było, co ma być
            i o ile się zmienia. Nic nie trafia do bazy, dopóki nie klikniesz „Zapisz”.
          </p>
        </div>

        <PriceListImport user={name} />
      </div>
    </main>
  )
}
