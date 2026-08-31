import PanelShell from "@/components/admin/PanelShell"
import DescriptionEditor from "@/components/admin/DescriptionEditor"

export const metadata = {
  title: "Opisy produktów",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function DescriptionsPage() {
  return (
    <PanelShell
      tytul="Opisy produktów"
      lead={
        <p>
          Po lewej opis, który jest teraz w sklepie, po prawej propozycja — do
          poprawienia na miejscu. Nic nie zmienia się w sklepie, dopóki nie klikniesz
          „Opublikuj”. Możesz też odłożyć tekst jako szkic i wrócić do niego później.
        </p>
      }
    >
      <DescriptionEditor />
    </PanelShell>
  )
}
