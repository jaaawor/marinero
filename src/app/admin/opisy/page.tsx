import DescriptionEditor from "@/components/admin/DescriptionEditor"
import AdminLogin from "@/components/admin/AdminLogin"
import { currentUser, getAdminToken } from "@/lib/admin-auth"

export const metadata = {
  title: "Opisy produktów",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function DescriptionsPage() {
  const token = await getAdminToken()
  const user = token ? await currentUser(token) : null
  const name = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
    : null

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#111827]/40">
            Narzędzia
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Opisy produktów
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#111827]/60">
            Po lewej opis, który jest teraz w sklepie, po prawej propozycja —
            do poprawienia na miejscu. Nic nie zmienia się w sklepie, dopóki nie
            klikniesz „Opublikuj”. Możesz też odłożyć tekst jako szkic i wrócić
            do niego później.
          </p>
        </div>

        {name ? <DescriptionEditor /> : <AdminLogin />}
      </div>
    </main>
  )
}
