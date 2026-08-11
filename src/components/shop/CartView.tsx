"use client"

import { useCart } from "@/components/shop/CartProvider"
import { formatPrice } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

export default function CartView({ locale = "pl" }: { locale?: string }) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const { cart, loading, updateItem, removeItem } = useCart()

  if (!cart || !cart.lines.length) {
    return (
      <div className="rounded-lg border border-[#111827]/10 bg-white p-10 text-center shadow-sm">
        <h2 className="text-2xl font-semibold">{t.shopCartEmpty}</h2>
        <p className="mt-3 text-[#111827]/55">{t.shopCartEmptyLead}</p>
        <a
          href={localeHref(current, "/sklep")}
          className="mt-6 inline-flex rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
        >
          {t.shopContinue}
        </a>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm">
        {cart.lines.map((line) => (
          <div
            key={line.id}
            className="flex flex-wrap items-center gap-4 border-b border-[#111827]/8 p-4 last:border-b-0 md:p-5"
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-[#f6f5f2]">
              {line.thumbnail ? (
                <img src={line.thumbnail} alt="" className="h-full w-full object-contain" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-6">{line.title}</p>
              {line.variantTitle && line.variantTitle !== line.title ? (
                <p className="text-sm text-[#111827]/45">{line.variantTitle}</p>
              ) : null}
              <p className="mt-1 text-sm text-[#111827]/55">{formatPrice(line.unitPrice)}</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={line.quantity}
                disabled={loading}
                onChange={(event) =>
                  updateItem(line.id, Math.max(1, Number(event.target.value) || 1))
                }
                aria-label={t.shopQuantity}
                className="w-20 rounded-md border border-[#111827]/15 px-3 py-2 text-sm outline-none focus:border-[#2E64A8]"
              />

              <p className="w-28 text-right font-bold">{formatPrice(line.total)}</p>

              <button
                type="button"
                onClick={() => removeItem(line.id)}
                disabled={loading}
                className="text-sm font-semibold text-[#111827]/40 transition hover:text-red-600"
              >
                {t.shopRemove}
              </button>
            </div>
          </div>
        ))}
      </div>

      <aside className="h-fit rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm lg:sticky lg:top-6">
        <h2 className="text-xl font-semibold">{t.shopCart}</h2>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#111827]/55">{t.shopSubtotal}</span>
            <strong>{formatPrice(cart.subtotal)}</strong>
          </div>

          <div className="flex justify-between gap-4 border-t border-[#111827]/10 pt-3 text-base">
            <span className="text-[#111827]/55">{t.shopTotal}</span>
            <strong>{formatPrice(cart.total)}</strong>
          </div>
        </div>

        <a
          href={localeHref(current, "/sklep/zamowienie")}
          className="mt-6 inline-flex w-full justify-center rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
        >
          {t.shopCheckout}
        </a>

        <a
          href={localeHref(current, "/sklep")}
          className="mt-3 inline-flex w-full justify-center rounded-md border border-[#111827]/15 px-6 py-3 text-sm font-bold text-[#111827]/65 transition hover:border-[#2E64A8] hover:text-[#2E64A8]"
        >
          {t.shopContinue}
        </a>
      </aside>
    </div>
  )
}
