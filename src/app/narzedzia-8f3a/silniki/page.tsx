import PanelShell from "@/components/admin/PanelShell"
import SilnikiCennik from "@/components/admin/SilnikiCennik"

export const metadata = {
  title: "Ceny silników",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function SilnikiPage() {
  return (
    <PanelShell
      modul="silniki"
      tytul="Ceny silników w konfiguratorach"
      szeroko
      lead={
        <p>
          Ten sam silnik stoi przy kilku łodziach i przy każdej ma dziś inną cenę — bo cennik
          producenta wchodził do każdej osobno, w różnych miesiącach. Tutaj podajesz cenę{" "}
          <strong>raz, w złotych brutto</strong>: osobno silnik, osobno zestaw instalacyjny.
          Przeliczam na euro netto po kursie z góry strony i pokazuję, co konkretnie zmieni się
          przy każdej łodzi. Do konfiguratorów nic nie idzie, dopóki nie klikniesz „Przepisz”.
        </p>
      }
    >
      {() => <SilnikiCennik />}
    </PanelShell>
  )
}
