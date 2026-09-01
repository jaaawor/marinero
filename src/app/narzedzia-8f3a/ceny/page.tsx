import PanelShell from "@/components/admin/PanelShell"
import Ceny from "@/components/admin/Ceny"

export const metadata = {
  title: "Ceny",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function CenyPage() {
  return (
    <PanelShell
      tytul="Ceny"
      lead={
        <p>
          Cena w sklepie i cena na Allegro obok siebie, obie do poprawienia na miejscu.
          Możesz też pobrać arkusz, poprawić go w Excelu i wgrać z powrotem — wgranie
          wypełnia pola, a do sklepu i na Allegro nic nie idzie, dopóki nie klikniesz
          „Zapisz ceny”.
        </p>
      }
    >
      <Ceny />
    </PanelShell>
  )
}
