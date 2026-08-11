import { getDictionary, normalizeLocale } from "@/lib/i18n"

// Pasek zapowiedzi nad treścią sklepu — jak w nowoczesnych sklepach,
// od razu komunikuje wysyłkę, serwis i odbiór osobisty.
export function ShopAnnouncement({ locale = "pl" }: { locale?: string }) {
  const t = getDictionary(normalizeLocale(locale))

  return (
    <div className="bg-[#111827] text-white">
      <div className="mx-auto max-w-[1500px] px-5 py-2.5 text-center text-xs font-semibold tracking-[0.06em] md:px-8">
        {t.shopAnnouncement}
      </div>
    </div>
  )
}

// Trzy powody zakupu — sekcja zaufania pod listą produktów.
export function ShopTrust({ locale = "pl" }: { locale?: string }) {
  const t = getDictionary(normalizeLocale(locale))

  const items = [
    { title: t.shopTrust1, lead: t.shopTrust1Lead },
    { title: t.shopTrust2, lead: t.shopTrust2Lead },
    { title: t.shopTrust3, lead: t.shopTrust3Lead },
  ]

  return (
    <section className="border-t border-[#111827]/10 bg-white">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-12 md:grid-cols-3 md:px-8">
        {items.map((item, index) => (
          <div key={item.title}>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#2E64A8]">
              0{index + 1}
            </p>
            <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-[#111827]/55">{item.lead}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
