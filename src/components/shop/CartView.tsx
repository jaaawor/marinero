"use client"

import { useCart } from "@/components/shop/CartProvider"
import { formatPrice } from "@/lib/medusa"
import { shop } from "@/components/shop/theme"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export default function CartView({ locale = "pl" }: { locale?: string }) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const { cart, loading, updateItem, removeItem } = useCart()

  if (!cart || !cart.lines.length) {
    return (
      <div className="bg-white px-6 py-20 text-center">
        <p className={shop.eyebrow}>{t.shopCart}</p>
        <h2 className={`${shop.display} mt-5 text-3xl md:text-4xl`}>{t.shopCartEmpty}</h2>
        <p className="mx-auto mt-5 max-w-md text-base leading-8 text-[#0E1A2B]/55">
          {t.shopCartEmptyLead}
        </p>
        <a href={localeHref(current, "/sklep/produkty")} className={`${shop.btnPrimary} mt-9`}>
          {t.shopContinue}
        </a>
      </div>
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="bg-white">
        {cart.lines.map((line) => (
          <div
            key={line.id}
            className="flex flex-wrap items-center gap-5 border-b border-[#0E1A2B]/8 p-5 last:border-b-0 md:p-7"
          >
            <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-[#F4F1EC] p-2">
              {line.thumbnail ? (
                <img src={line.thumbnail} alt="" className="h-full w-full object-contain" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium leading-6">{line.title}</p>
              {line.variantTitle && line.variantTitle !== line.title ? (
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0E1A2B]/35">
                  {line.variantTitle}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-[#0E1A2B]/50">{formatPrice(line.unitPrice)}</p>

              <button
                type="button"
                onClick={() => removeItem(line.id)}
                disabled={loading}
                className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0E1A2B]/35 underline underline-offset-4 transition hover:text-red-600"
              >
                {t.shopRemove}
              </button>
            </div>

            <div className="flex items-center gap-5">
              <div className="flex items-center rounded-sm border border-[#0E1A2B]/15">
                <button
                  type="button"
                  aria-label="-"
                  disabled={loading}
                  onClick={() => updateItem(line.id, Math.max(1, line.quantity - 1))}
                  className="px-3.5 py-2.5 text-base leading-none text-[#0E1A2B]/45 transition hover:text-[#0E1A2B]"
                >
                  −
                </button>

                <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>

                <button
                  type="button"
                  aria-label="+"
                  disabled={loading}
                  onClick={() => updateItem(line.id, line.quantity + 1)}
                  className="px-3.5 py-2.5 text-base leading-none text-[#0E1A2B]/45 transition hover:text-[#0E1A2B]"
                >
                  +
                </button>
              </div>

              <p className="w-28 text-right text-base font-semibold">{formatPrice(line.total)}</p>
            </div>
          </div>
        ))}
      </div>

      <aside className="h-fit border border-[#0E1A2B]/12 bg-white p-7 md:p-8 lg:sticky lg:top-6">
        <p className={shop.eyebrow}>{t.shopSummary}</p>

        <div className="mt-7 space-y-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#0E1A2B]/50">{t.shopNet}</span>
            <strong className="font-semibold">{formatPrice(cart.subtotal)}</strong>
          </div>

          {cart.taxTotal ? (
            <div className="flex justify-between gap-4">
              <span className="text-[#0E1A2B]/50">{t.shopTax}</span>
              <strong className="font-semibold">{formatPrice(cart.taxTotal)}</strong>
            </div>
          ) : null}

          {cart.shippingTotal ? (
            <div className="flex justify-between gap-4">
              <span className="text-[#0E1A2B]/50">{t.shopShipping}</span>
              <strong className="font-semibold">{formatPrice(cart.shippingTotal)}</strong>
            </div>
          ) : null}

          <div className="flex justify-between gap-4 border-t border-[#0E1A2B]/10 pt-5">
            <span className="text-[#0E1A2B]/50">{t.shopTotal}</span>
            <strong className="text-xl font-semibold tracking-[-0.02em]">
              {formatPrice(cart.total)}
            </strong>
          </div>
        </div>

        <a
          href={localeHref(current, "/sklep/zamowienie")}
          className={`${shop.btnPrimary} mt-8 w-full`}
        >
          {t.shopCheckout}
        </a>

        <a
          href={localeHref(current, "/sklep/produkty")}
          className="mt-5 block text-center text-[12px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B]/45 transition hover:text-[#2E64A8]"
        >
          {t.shopContinue}
        </a>

        <p className="mt-8 border-t border-[#0E1A2B]/10 pt-6 text-sm leading-7 text-[#0E1A2B]/50">
          {t.shopTrust2Lead}
        </p>
      </aside>
    </div>
  )
}
