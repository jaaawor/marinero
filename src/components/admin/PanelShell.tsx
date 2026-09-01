import type { ReactNode } from "react"
import PanelNav from "@/components/admin/PanelNav"
import AdminLogin from "@/components/admin/AdminLogin"
import { getAdminToken } from "@/lib/admin-auth"
import { dostepZalogowanego } from "@/lib/panel-dostep"

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
 *
 * Ta sama zasada dotyczy modułów: kto ma przypisane tylko zamówienia, ten
 * widzi w pasku jedną zakładkę, a wejście z adresu w cudzy moduł kończy się
 * czytelnym „nie masz dostępu", nie połową działającej strony.
 */
export default async function PanelShell({
  tytul,
  lead,
  modul,
  szeroko = true,
  children,
}: {
  tytul: string
  lead?: ReactNode
  /** Moduł, którego dotyczy strona — patrz `MODULY` w `panel-dostep.ts`. */
  modul?: string
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
  const dostep = token ? await dostepZalogowanego(token).catch(() => null) : null
  const kto = dostep?.kto || ""

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

  const wolno = !modul || Boolean(dostep?.moduly.includes(modul))

  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#111827]">
      <PanelNav kto={kto} moduly={dostep?.moduly || []} glowny={Boolean(dostep?.glowny)} />

      <div className={`mx-auto ${szeroko ? "max-w-[1500px]" : "max-w-[1200px]"} px-5 py-10 md:px-8`}>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{tytul}</h1>
          {lead ? (
            <div className="mt-3 max-w-3xl text-base leading-7 text-[#111827]/60">{lead}</div>
          ) : null}
        </div>

        {wolno ? (
          typeof children === "function" ? (
            children(kto)
          ) : (
            children
          )
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm leading-7">
            <p className="font-semibold">Nie masz dostępu do tego narzędzia.</p>
            <p className="mt-1 text-[#111827]/70">
              {dostep?.moduly.length
                ? "Otwarte dla Ciebie są tylko zakładki widoczne w pasku u góry."
                : "Twoje konto nie ma jeszcze przypisanego żadnego narzędzia."}{" "}
              O dostęp poproś osobę prowadzącą konta.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
