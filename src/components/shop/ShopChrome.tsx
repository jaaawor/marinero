import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { shop } from "@/components/shop/theme"

// Cienki pasek nad nagłówkiem — jedyny ciemny element sklepu.
export function ShopAnnouncement({ locale = "pl" }: { locale?: string }) {
  const t = getDictionary(normalizeLocale(locale))

  return (
    <div className={shop.dark}>
      <div className="mx-auto max-w-[1500px] px-5 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 md:px-8">
        {t.shopAnnouncement}
      </div>
    </div>
  )
}

// Nagłówek strony wewnętrznej sklepu — jasny, spokojny, z cienką linią.
export function ShopPageHeader({
  locale = "pl",
  title,
  meta,
  backLabel,
  lead,
  image,
}: {
  locale?: string
  title: string
  meta?: string
  backLabel?: string
  lead?: string
  /** Kadr z życia obok tytułu — ten sam język co bloki redakcyjne sklepu. */
  image?: string
}) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const back = (
    <a
      href={localeHref(current, "/sklep")}
      className={`text-[12px] font-bold uppercase tracking-[0.18em] transition ${
        image ? "text-white/70 hover:text-white" : "text-[#0E1A2B]/40 hover:text-[#2E64A8]"
      }`}
    >
      ← {backLabel || t.shopTitle}
    </a>
  )

  // Ze zdjęciem: kadr na całą szerokość z tytułem na nim — panel obok tytułu
  // był wąskim paskiem, który znikał poniżej `lg` i wyglądał jak doklejony.
  if (image) {
    return (
      <section className="relative isolate overflow-hidden border-b border-[#0E1A2B]/10">
        <img
          src={image}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0E1A2B]/85 via-[#0E1A2B]/45 to-[#0E1A2B]/15" />

        <div className={`${shop.container} flex min-h-[240px] flex-col justify-end py-10 md:min-h-[340px] md:py-14`}>
          {back}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
            <h1 className={`${shop.display} text-3xl text-white md:text-5xl`}>{title}</h1>
            {meta ? (
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/60">
                {meta}
              </p>
            ) : null}
          </div>

          {lead ? (
            <p className="mt-5 max-w-xl text-base leading-8 text-white/75">{lead}</p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="border-b border-[#0E1A2B]/10 bg-white">
      <div className={`${shop.container} py-10 md:py-14`}>
        {back}

        <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
          <h1 className={`${shop.display} text-3xl md:text-5xl`}>{title}</h1>
          {meta ? (
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/40">
              {meta}
            </p>
          ) : null}
        </div>

        {lead ? (
          <p className="mt-6 max-w-xl text-base leading-8 text-[#0E1A2B]/55">{lead}</p>
        ) : null}
      </div>
    </section>
  )
}

// Nagłówek koszyka i zamówienia: tytuł z krokami 01–03.
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
    <section className="border-b border-[#0E1A2B]/10 bg-white">
      <div className={`${shop.container} py-10 md:py-14`}>
        <a
          href={localeHref(current, "/sklep")}
          className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/40 transition hover:text-[#2E64A8]"
        >
          ← {t.shopTitle}
        </a>

        <h1 className={`${shop.display} mt-6 text-3xl md:text-5xl`}>{steps[step - 1]}</h1>

        <ol className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          {steps.map((label, index) => (
            <li
              key={label}
              className={`flex items-center gap-3 border-t pt-4 text-[11px] font-bold uppercase tracking-[0.2em] ${
                index + 1 === step
                  ? "border-[#2E64A8] text-[#0E1A2B]"
                  : "border-[#0E1A2B]/10 text-[#0E1A2B]/35"
              }`}
            >
              <span className={index + 1 === step ? "text-[#2E64A8]" : ""}>0{index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// Pas z liczbami — jasny, oddziela sekcje i buduje wiarygodność.
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
    <section className="border-y border-[#0E1A2B]/10 bg-white">
      <div className={`${shop.container} grid gap-10 py-12 md:grid-cols-[1.1fr_1fr] md:py-16`}>
        <div>
          <p className={shop.eyebrow}>{t.shopStatsEyebrow}</p>
          <h2 className={`${shop.display} mt-5 text-3xl md:text-[2.75rem]`}>{t.shopStatsTitle}</h2>
          <p className="mt-6 max-w-lg text-base leading-8 text-[#0E1A2B]/55">{t.shopStatsLead}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 self-center">
          {stats.map((stat) => (
            <div key={stat.label} className="border-t border-[#0E1A2B]/12 pt-5">
              <p className={`${shop.display} text-4xl md:text-5xl`}>{stat.value}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/40">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Trzy powody zakupu. Numery 01–03 nic nie mówiły — teraz każdy powód ma
// ikonę: autoryzacja (odznaka), wysyłka (kurier), doradztwo (serwis).
const TRUST_ICONS = [
  // Odznaka z ptaszkiem — autoryzowany dealer
  <>
    <path d="M12 3 4.5 6v5.2c0 4.4 3.1 8.5 7.5 9.8 4.4-1.3 7.5-5.4 7.5-9.8V6L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </>,
  // Kurier — wysyłka w 24 h
  <>
    <path d="M3 7.5h10.5v9H3z" />
    <path d="M13.5 11H17l3 3v2.5h-6.5z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="16.5" cy="18" r="1.8" />
  </>,
  // Klucz — serwis i doradztwo
  <>
    <path d="M15.5 3.8a5.2 5.2 0 0 0-4.7 7.4L3.8 18.2l2 2 7-7A5.2 5.2 0 1 0 15.5 3.8Z" />
  </>,
]

export function ShopTrust({ locale = "pl" }: { locale?: string }) {
  const t = getDictionary(normalizeLocale(locale))

  const items = [
    { title: t.shopTrust1, lead: t.shopTrust1Lead },
    { title: t.shopTrust2, lead: t.shopTrust2Lead },
    { title: t.shopTrust3, lead: t.shopTrust3Lead },
  ]

  return (
    <section className="border-t border-[#0E1A2B]/10 bg-[#F4F1EC]">
      <div className={`${shop.container} grid gap-10 py-12 md:grid-cols-3 md:py-16`}>
        {items.map((item, index) => (
          <div key={item.title}>
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-8 w-8 text-[#2E64A8]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {TRUST_ICONS[index]}
            </svg>

            <h3 className={`${shop.display} mt-5 text-2xl`}>{item.title}</h3>
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
    <section className="border-t border-[#0E1A2B]/10 bg-white">
      <div
        className={`${shop.container} flex flex-col items-start justify-between gap-8 py-12 md:flex-row md:items-center md:py-16`}
      >
        <div>
          <p className={shop.eyebrow}>{t.shopTrust3}</p>
          <h2 className={`${shop.display} mt-5 max-w-2xl text-3xl md:text-[2.75rem]`}>
            {t.shopContactTitle}
          </h2>
        </div>

        <a href={localeHref(current, "/kontakt")} className={shop.btnPrimary}>
          {t.shopHeroSecondary}
        </a>
      </div>
    </section>
  )
}
