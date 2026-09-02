import PanelShell from "@/components/admin/PanelShell"
import Konta from "@/components/admin/Konta"
import { sesjaPanelu } from "@/lib/admin-auth"
import { dostepZalogowanego } from "@/lib/panel-dostep"

export const metadata = {
  title: "Konta",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function KontaPage() {
  const { token } = await sesjaPanelu()
  const dostep = token ? await dostepZalogowanego(token).catch(() => null) : null

  return (
    <PanelShell
      tytul="Konta"
      szeroko={false}
      lead={
        <p>
          Kto ma wejście do panelu i do których narzędzi. Konto zakłada się tutaj —
          osoba loguje się swoim adresem i hasłem, a zaznaczone narzędzia to wszystko,
          co zobaczy. Konta powstają <strong>bez dostępu do panelu Directusa</strong>,
          więc sprzedawca prowadzący zamówienia nie wchodzi przy okazji w treść strony.
        </p>
      }
    >
      {dostep?.glowny ? (
        <Konta />
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm leading-7">
          Konta zakłada główny administrator. Twoje konto ma dostęp do narzędzi
          zaznaczonych w pasku u góry.
        </p>
      )}
    </PanelShell>
  )
}
