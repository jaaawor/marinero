import PanelShell from "@/components/admin/PanelShell"
import Statystyki from "@/components/admin/Statystyki"

export const metadata = {
  title: "Statystyki",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function StatystykiPage() {
  return (
    <PanelShell
      tytul="Statystyki"
      lead={
        <p>
          Które strony ludzie otwierają, czego szukają na stronie z łodziami i w sklepie,
          które konfiguratory przeklikują bez wysłania oferty oraz co mają w tej chwili
          w koszykach.
        </p>
      }
    >
      <Statystyki />
    </PanelShell>
  )
}
