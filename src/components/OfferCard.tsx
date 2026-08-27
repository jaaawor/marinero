import PhotoPlaceholder from "@/components/PhotoPlaceholder"
import { getDictionary, type Locale } from "@/lib/i18n"
import { formatOfferPrice, type PublicUsedBoat } from "@/lib/public-site-data"

// Karta egzemplarza na giełdzie. Świadomie inna niż `ModelCard`: tam liczy się
// typ łodzi, tu konkretna sztuka — rocznik, motogodziny i cena decydują
// o zainteresowaniu bardziej niż nazwa modelu.

/**
 * Etykiety stanu — po języku strony, nie po polsku na sztywno. Klucze
 * (`od-reki`, `demo`…) są tym, co siedzi w polu `used_boats.condition`
 * w Directusie, więc zostają niezmienione.
 */
export function conditionLabels(locale?: Locale): Record<string, string> {
  const t = getDictionary(locale)
  return {
    "od-reki": t.conditionInStock,
    "w-produkcji": t.conditionInProduction,
    demo: t.conditionDemo,
    uzywana: t.conditionUsed,
  }
}

// „Od ręki" wyróżniamy kolorem, bo to jedyny stan, w którym klient może
// wyjechać z łodzią w tym sezonie. Krycie 80%: pełny kolor krzyczał na zdjęciu,
// a przezroczysty (10%) był nieczytelny.
const CONDITION_STYLES: Record<string, string> = {
  "od-reki": "bg-[#047857]/80 text-white",
  "w-produkcji": "bg-[#2E64A8]/80 text-white",
  demo: "bg-[#B45309]/80 text-white",
  uzywana: "bg-[#111827]/80 text-white",
}

export default function OfferCard({
  offer,
  href,
  locale,
}: {
  offer: PublicUsedBoat
  href: string
  locale?: Locale
}) {
  const t = getDictionary(locale)
  const labels = conditionLabels(locale)

  const specs = [
    offer.year ? `${t.offerYear} ${offer.year}` : "",
    offer.lengthM ? `${offer.lengthM} m` : "",
    offer.engineHours ? `${offer.engineHours} mth` : "",
  ].filter(Boolean)

  return (
    <a
      href={href}
      className="group flex flex-col overflow-hidden rounded-lg border border-[#111827]/10 bg-white transition hover:border-[#111827]/25"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f6f5f2]">
        {offer.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={offer.image}
            alt={offer.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <PhotoPlaceholder className="h-full w-full" locale={locale} />
        )}

        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold shadow-sm ${
            CONDITION_STYLES[offer.condition] || CONDITION_STYLES.uzywana
          }`}
        >
          {labels[offer.condition] || offer.condition}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {offer.brand ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#111827]/35">
            {offer.brand}
          </p>
        ) : null}

        <h3 className="mt-1.5 text-lg font-semibold leading-6 tracking-tight">{offer.name}</h3>

        {specs.length ? (
          <p className="mt-2 text-sm text-[#111827]/50">{specs.join(" · ")}</p>
        ) : null}

        {offer.location ? (
          <p className="mt-1 text-sm text-[#111827]/40">{offer.location}</p>
        ) : null}

        <div className="mt-auto pt-5">
          {/* Bez ceny nie piszemy „0 zł", tylko wprost, że trzeba zapytać. */}
          <p className="text-lg font-bold text-[#2E64A8]">
            {offer.price ? formatOfferPrice(offer.price, offer.currency) : t.offerPriceOnRequest}
          </p>
          {offer.price && offer.vatStatus ? (
            <p className="mt-0.5 text-xs text-[#111827]/40">{offer.vatStatus}</p>
          ) : null}
        </div>
      </div>
    </a>
  )
}
