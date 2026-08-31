import PanelShell from "@/components/admin/PanelShell"
import Produkty from "@/components/admin/Produkty"

export const metadata = {
  title: "Produkty i ceny",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ProduktyPage() {
  return (
    <PanelShell
      tytul="Produkty i ceny"
      lead={
        <p>
          Cena, dostępność, liczba sztuk i EAN — wszystko w jednej tabeli, do
          poprawienia na miejscu. Zmienione wiersze się podświetlają, a do Medusy nic
          nie idzie, dopóki nie klikniesz „Zapisz zmiany”. Puste pole dostępności
          znaczy, że sklep zgaduje termin po marce.
        </p>
      }
    >
      <Produkty />
    </PanelShell>
  )
}
