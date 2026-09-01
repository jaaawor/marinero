import PanelShell from "@/components/admin/PanelShell"
import Zamowienia from "@/components/admin/Zamowienia"

export const metadata = {
  title: "Zamówienia ze sklepu",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function OrdersPage() {
  return (
    <PanelShell
      modul="zamowienia"
      tytul="Zamówienia ze sklepu"
      lead={
        <p>
          Zamówienia z marinero.pl — z płatnością PayU widoczną obok stanu z Medusy.
          Stan obsługi, numer przesyłki i uwagi zapisują się przy zamówieniu, a stąd
          wyślesz też ponownie potwierdzenie dla klienta.
        </p>
      }
    >
      <Zamowienia />
    </PanelShell>
  )
}
