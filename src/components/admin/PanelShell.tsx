import type { ReactNode } from "react"
import PanelNav from "@/components/admin/PanelNav"
import AdminLogin from "@/components/admin/AdminLogin"
import { currentUser, getAdminToken } from "@/lib/admin-auth"

/**
 * Wspólna rama panelu: pasek z zakładkami, nagłówek strony i ochrona
 * logowaniem w jednym miejscu.
 *
 * Wcześniej każde narzędzie powtarzało ten sam nagłówek u siebie, a przejście
 * z zamówień do cenników wymagało powrotu do spisu — panel wyglądał jak zbiór
 * osobnych stron, bo nim był. Pasek zostaje przyklejony u góry, więc przy
 * długiej liście zamówień nie trzeba przewijać na sam początek, żeby gdzieś
 * przejść.
 *
 * Niezalogowanemu pokazujemy sam formularz, bez zakładek: klikanie po
 * narzędziach, do których i tak nie ma się dostępu, to droga donikąd.
 */
export default async function PanelShell({
  tytul,
  lead,
  szeroko = true,
  children,
}: {
  tytul: string
  lead?: ReactNode
  /** Wąsko (1200 px) dla formularzy, szeroko (1500 px) dla tabel. */
  szeroko?: boolean
  /**
   * Zwykła treść albo funkcja dostająca nazwę zalogowanej osoby — dwa
   * narzędzia (cenniki, wyposażenie) podpisują nią zapis w Directusie.
   * Powłoka i tak pyta Directusa, kto jest zalogowany, więc drugie pytanie
   * o to samo na każdej stronie byłoby marnotrawstwem.
   */
  children: ReactNode | ((kto: string) => ReactNode)
}) {
  const token = await getAdminToken()
  const uzytkownik = token ? await currentUser(token).catch(() => null) : null

  const kto = uzytkownik
    ? [uzytkownik.first_name, uzytkownik.last_name].filter(Boolean).join(" ") ||
      uzytkownik.email ||
      ""
    : ""

  if (!token) {
    return (
      <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
        <div className="mx-auto max-w-[520px] px-5 py-20">
          <div className="mb-8 flex items-center gap-2.5">
            <img src="/logo-marinero.png" alt="" className="h-7 w-auto object-contain" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#111827]/35">
              Panel
            </span>
          </div>
          <AdminLogin />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <PanelNav kto={kto} />

      <div className={`mx-auto ${szeroko ? "max-w-[1500px]" : "max-w-[1200px]"} px-5 py-10 md:px-8`}>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{tytul}</h1>
          {lead ? (
            <div className="mt-3 max-w-3xl text-base leading-7 text-[#111827]/60">{lead}</div>
          ) : null}
        </div>

        {typeof children === "function" ? children(kto) : children}
      </div>
    </main>
  )
}
