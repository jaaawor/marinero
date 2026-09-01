import PanelShell from "@/components/admin/PanelShell"
import Ceny from "@/components/admin/Ceny"

export const metadata = {
  title: "Ceny i stany",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function CenyPage() {
  return (
    <PanelShell
      modul="ceny"
      tytul="Ceny i stany"
      lead={
        <p>
          Cena i liczba sztuk — w sklepie i na Allegro, obok siebie i wszystko do
          poprawienia na miejscu. Możesz też pobrać arkusz, poprawić go w Excelu
          i wgrać z powrotem: wgranie wypełnia pola, a do sklepu i na Allegro nic
          nie idzie, dopóki nie klikniesz „Zapisz zmiany”.
        </p>
      }
    >
      <Ceny />
    </PanelShell>
  )
}
