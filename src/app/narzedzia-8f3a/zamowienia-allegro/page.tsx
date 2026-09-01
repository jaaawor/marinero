import PanelShell from "@/components/admin/PanelShell"
import AllegroOrders from "@/components/admin/AllegroOrders"

export const metadata = {
  title: "Zamówienia z Allegro",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AllegroOrdersPage() {
  return (
    <PanelShell
      modul="allegro-zamowienia"
      tytul="Zamówienia z Allegro"
      szeroko={false}
      lead={
        <p>
          Przyjęcie do realizacji, numer przesyłki i oznaczenie jako wysłane — bez
          przełączania się na portal. Zmiany idą wprost do Allegro i kupujący widzi je
          u siebie. Płatności i zwroty zostają po stronie Allegro. Zakładki
          odpowiadają stanom realizacji z panelu Allegro, a zamówienia przychodzą
          ze wszystkich rynków naraz — z listy obok da się zawęzić do jednego kraju.
        </p>
      }
    >
      <AllegroOrders />
    </PanelShell>
  )
}
