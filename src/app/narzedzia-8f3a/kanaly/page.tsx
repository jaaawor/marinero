import PanelShell from "@/components/admin/PanelShell"
import ChannelPrices from "@/components/admin/ChannelPrices"

export const metadata = {
  title: "Ceny na Allegro",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  return (
    <PanelShell
      tytul="Ceny na Allegro"
      lead={
        <p>
          Ceny pobrane z Allegro obok cen ze sklepu i obok tego, ile wyszłoby z reguł
          w <code className="text-sm">channel-pricing.ts</code>. Ta strona{" "}
          <strong>niczego nie wysyła</strong> — służy do porównania, zanim ustalimy,
          które ceny mają się przeliczać automatycznie.
        </p>
      }
    >
      <ChannelPrices />
    </PanelShell>
  )
}
