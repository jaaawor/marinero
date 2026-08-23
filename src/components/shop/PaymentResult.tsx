import Footer from "@/components/Footer"
import ShopHeader from "@/components/shop/ShopHeader"
import { ShopAnnouncement, ShopCheckoutHeader, ShopContactBand } from "@/components/shop/ShopChrome"
import { shop } from "@/components/shop/theme"
import { getShopCategories } from "@/lib/medusa"
import { hasAdminToken, medusaAdmin } from "@/lib/medusa-admin"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

// Ekran po powrocie z PayU.
//
// Status czytamy **z Medusy**, nie z adresu. PayU odsyła klienta na
// `continueUrl` niezależnie od wyniku, a parametr w adresie każdy może sobie
// dopisać — gdybyśmy mu wierzyli, „zapłacone" pokazywałoby się każdemu.
// Prawdę zna tylko powiadomienie z podpisem, które zapisało metadane.

export const dynamic = "force-dynamic"

type Props = { orderId: string; locale?: string }

const LABELS: Record<string, { title: string; lead: string }> = {
  COMPLETED: {
    title: "Płatność przyjęta",
    lead: "Dziękujemy. Zamówienie jest opłacone — potwierdzenie wysyłamy mailem.",
  },
  PENDING: {
    title: "Czekamy na potwierdzenie",
    lead:
      "PayU nie potwierdziło jeszcze płatności. Przy przelewie potrafi to potrwać. " +
      "Zamówienie jest przyjęte — damy znać mailem, gdy pieniądze dojdą.",
  },
  WAITING_FOR_CONFIRMATION: {
    title: "Czekamy na potwierdzenie",
    lead: "Płatność jest w trakcie księgowania. Damy znać mailem, gdy się potwierdzi.",
  },
  CANCELED: {
    title: "Płatność anulowana",
    lead: "Zamówienie zostało przyjęte, ale nie jest opłacone. Napisz do nas, a ustalimy przelew.",
  },
  AMOUNT_MISMATCH: {
    title: "Sprawdzamy płatność",
    lead: "Kwota płatności nie zgadza się z zamówieniem. Zajmiemy się tym ręcznie i odezwiemy się.",
  },
}

export default async function PaymentResult({ orderId, locale = "pl" }: Props) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const categories = await getShopCategories()

  let status = ""
  let displayId: string | number = ""

  if (orderId && hasAdminToken() && /^order_[A-Za-z0-9]+$/.test(orderId)) {
    try {
      const body = await medusaAdmin(`/admin/orders/${orderId}?fields=id,display_id,metadata`)
      status = String(body?.order?.metadata?.payu_status || "")
      displayId = body?.order?.display_id ?? ""
    } catch {
      status = ""
    }
  }

  const label = LABELS[status] || {
    title: "Zamówienie przyjęte",
    lead: "Nie mamy jeszcze informacji o płatności. Potwierdzenie wyślemy mailem.",
  }

  return (
    <main className={shop.page}>
      <ShopAnnouncement locale={current} />
      <ShopHeader locale={current} categories={categories} />
      <ShopCheckoutHeader locale={current} step={3} />

      <section className={`${shop.container} py-12 md:py-16`}>
        <div className="bg-white px-6 py-20 text-center">
          <p className={shop.eyebrow}>{t.shopStepDone}</p>
          <h2 className={`${shop.display} mt-5 text-3xl md:text-4xl`}>{label.title}</h2>

          {displayId ? (
            <p className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-[#2E64A8]">
              #{displayId}
            </p>
          ) : null}

          <p className="mx-auto mt-5 max-w-md text-base leading-8 text-[#0E1A2B]/55">
            {label.lead}
          </p>

          <a href={localeHref(current, "/sklep")} className={`${shop.btnPrimary} mt-9`}>
            {t.shopBackToShop}
          </a>
        </div>
      </section>

      <ShopContactBand locale={current} />
      <Footer locale={current} />
    </main>
  )
}
