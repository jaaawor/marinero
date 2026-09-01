import PanelShell from "@/components/admin/PanelShell"
import ProduktEdytor from "@/components/admin/ProduktEdytor"

export const metadata = {
  title: "Nowy produkt",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function NowyProduktPage() {
  return (
    <PanelShell
      modul="produkty"
      tytul="Nowy produkt"
      lead={
        <p>
          Nazwa, cena i zdjęcie wystarczą na start — resztę uzupełnisz później. Produkt
          zakłada się jako <strong>szkic</strong>, więc nie pojawi się w sklepie, dopóki
          go nie opublikujesz.
        </p>
      }
    >
      <ProduktEdytor />
    </PanelShell>
  )
}
