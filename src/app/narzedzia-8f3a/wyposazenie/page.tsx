import PanelShell from "@/components/admin/PanelShell"
import EquipmentPaste from "@/components/admin/EquipmentPaste"

export const metadata = {
  title: "Wyposażenie",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function EquipmentPage() {
  return (
    <PanelShell
      tytul="Wyposażenie łodzi"
      szeroko={false}
      lead={
        <p>
          Wklejasz całą listę naraz — tak, jak przyszła od producenta, z PDF-a, Worda
          albo arkusza. Rozbijam ją na grupy i pozycje, pokazuję podgląd do poprawy,
          a do bazy trafia dopiero po kliknięciu „Zapisz”.
        </p>
      }
    >
      {(kto) => <EquipmentPaste user={kto} />}
    </PanelShell>
  )
}
