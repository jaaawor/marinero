import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { shop } from "@/components/shop/theme"

// Cienki pasek nad nagłówkiem — pierwsza rzecz, jaką widać w sklepie.
export function ShopAnnouncement({ locale = "pl" }: { locale?: string }) {
  const t = getDictionary(normalizeLocale(locale))

  return (
    <div className={shop.dark}>
      <div className="mx-auto max-w-[1500px] px-5 py-3 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 md:px-8">
        {t.shopAnnouncement}
      </div>
    </div>
  )
}

// Nagłówek koszyka i zamówienia: ciemny pas z tytułem i krokami 01–03.
export function ShopCheckoutHeader({
  locale = "pl",
  step,
}: {
  locale?: string
  step: 1 | 2 | 3
}) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const steps = [t.shopStepCart, t.shopStepData, t.shopStepDone]

  return (
    <section className={shop.dark}>
      <div className={`${shop.container} py-12 md:py-16`}>
        <a
          href={localeHref(current, "/sklep")}
          className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/45 transition hover:text-white"
        >
          ← {t.shopTitle}
        </a>

        <h1 className={`${shop.display} mt-6 text-3xl md:text-5xl`}>{steps[step - 1]}</h1>

        <ol className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
          {steps.map((label, index) => (
            <li
              key={label}
              className={`flex items-center gap-3 border-t pt-4 text-[11px] font-bold uppercase tracking-[0.2em] ${
                index + 1 === step
                  ? "border-white text-white"
                  : "border-white/15 text-white/35"
              }`}
            >
              <span>0{index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// Ciemny pas z liczbami — oddycha między sekcjami i buduje wiarygodność.
export function ShopStats({
  locale = "pl",
  productCount,
  categoryCount,
}: {
  locale?: string
  productCount: number
  categoryCount: number
}) {
  const t = getDictionary(normalizeLocale(locale))

  const stats = [
    { value: String(productCount), label: t.shopProducts },
    { value: String(categoryCount), label: t.shopCategories },
    { value: "24 h", label: t.shopTrust2 },
    { value: "2", label: t.shopStatsService },
  ]

  return (
    <section className={shop.dark}>
      <div className={`${shop.container} grid gap-10 py-16 md:grid-cols-[1.1fr_1fr] md:py-20`}>
        <div>
          <p className={shop.eyebrowLight}>{t.shopStatsEyebrow}</p>
          <h2 className={`${shop.display} mt-6 text-3xl md:text-5xl`}>{t.shopStatsTitle}</h2>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/55">{t.shopStatsLead}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 self-center">
          {stats.map((stat) => (
            <div key={stat.label} className="border-t border-white/15 pt-5">
              <p className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{stat.value}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Trzy powody zakupu — numerowane, redakcyjne, bez ikon z półki.
export function ShopTrust({ locale = "pl" }: { locale?: string }) {
  const t = getDictionary(normalizeLocale(locale))

  const items = [
    { title: t.shopTrust1, lead: t.shopTrust1Lead },
    { title: t.shopTrust2, lead: t.shopTrust2Lead },
    { title: t.shopTrust3, lead: t.shopTrust3Lead },
  ]

  return (
    <section className="border-t border-[#0E1A2B]/10 bg-white">
      <div className={`${shop.container} grid gap-12 py-16 md:grid-cols-3 md:py-20`}>
        {items.map((item, index) => (
          <div key={item.title}>
            <p className="text-[11px] font-bold tracking-[0.3em] text-[#2E64A8]">
              0{index + 1}
            </p>
            <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em]">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-[#0E1A2B]/55">{item.lead}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// Zamknięcie strony sklepu — zaproszenie do kontaktu z serwisem.
export function ShopContactBand({ locale = "pl" }: { locale?: string }) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  return (
    <section className={shop.dark}>
      <div
        className={`${shop.container} flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center md:py-20`}
      >
        <div>
          <p className={shop.eyebrowLight}>{t.shopTrust3}</p>
          <h2 className={`${shop.display} mt-5 max-w-2xl text-3xl md:text-4xl`}>
            {t.shopContactTitle}
          </h2>
        </div>

        <a href={localeHref(current, "/kontakt")} className={shop.btnLight}>
          {t.shopHeroSecondary}
        </a>
      </div>
    </section>
  )
}
