import PanelShell from "@/components/admin/PanelShell"
import PriceTools from "@/components/admin/PriceTools"

// Narzędzie wewnętrzne — nigdy nie ma go w mapie strony ani w wynikach Google.
export const metadata = {
  title: "Cenniki",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function PriceListPage() {
  return (
    <PanelShell
      modul="cenniki"
      tytul="Aktualizacja cenników"
      szeroko={false}
      lead={
        <p>
          Wgrywasz cennik od producenta w tej postaci, w jakiej go dostałeś — zbiorczy
          dla marki albo osobny dla jednej łodzi. Dopasowuję pozycje do bazy i pokazuję
          tabelę: co było, co ma być i o ile się zmienia. Nic nie trafia do bazy, dopóki
          nie klikniesz „Zapisz”.
        </p>
      }
    >
      {(kto) => <PriceTools user={kto} />}
    </PanelShell>
  )
}
