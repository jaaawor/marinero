import PanelShell from "@/components/admin/PanelShell"
import ProduktEdytor from "@/components/admin/ProduktEdytor"

export const metadata = {
  title: "Produkt",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ProduktPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <PanelShell
      tytul="Produkt"
      lead={
        <p>
          Nazwa, opis, zdjęcia, kategoria, cena i dostępność. Zapis idzie wprost do
          sklepu — strona produktu pokaże zmiany po najbliższym odświeżeniu.{" "}
          <a href="/narzedzia-8f3a/produkty" className="text-[#2E64A8] hover:underline">
            ← wróć do listy
          </a>
        </p>
      }
    >
      <ProduktEdytor id={id} />
    </PanelShell>
  )
}
