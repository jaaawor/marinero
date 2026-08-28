import EquipmentPaste from "@/components/admin/EquipmentPaste"
import { currentUser, getAdminToken } from "@/lib/admin-auth"

// Narzędzie wewnętrzne — nigdy nie ma go w mapie strony ani w wynikach Google.
export const metadata = {
  title: "Wyposażenie",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function EquipmentPage() {
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
            Wyposażenie łodzi
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#111827]/60">
            Wklejasz całą listę naraz — tak, jak przyszła od producenta, z PDF-a,
            Worda albo arkusza. Rozbijam ją na grupy i pozycje, pokazuję podgląd
            do poprawy, a do bazy trafia dopiero po kliknięciu „Zapisz”.
          </p>
        </div>

        <EquipmentPaste user={name} />
      </div>
    </main>
  )
}
