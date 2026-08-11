"use client"

import { useState } from "react"
import { useCart } from "@/components/shop/CartProvider"
import { formatPrice } from "@/lib/medusa"
import type { ShopVariant } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type AddToCartProps = {
  variants: ShopVariant[]
  locale?: string
}

export default function AddToCart({ variants, locale = "pl" }: AddToCartProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const { addItem, loading } = useCart()

  const [variantId, setVariantId] = useState(variants[0]?.id || "")
  const [quantity, setQuantity] = useState(1)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const variant = variants.find((item) => item.id === variantId) || variants[0]

  async function submit() {
    if (!variant) return

    setError("")
    setDone(false)

    try {
      await addItem(variant.id, quantity)
      setDone(true)
    } catch {
      setError("Nie udało się dodać produktu do koszyka.")
    }
  }

  if (!variants.length) return null

  return (
    <div className="mt-8 rounded-lg border border-[#111827]/10 bg-[#fafafa] p-5">
      {variants.length > 1 ? (
        <label className="mb-4 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#111827]/45">
            Wariant
          </span>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            className="w-full rounded-md border border-[#111827]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"
          >
            {variants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} {item.price ? `— ${formatPrice(item.price)}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-28">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#111827]/45">
            {t.shopQuantity}
          </span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            className="w-full rounded-md border border-[#111827]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"
          />
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="flex-1 rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F] disabled:opacity-60"
        >
          {t.shopAddToCart}
        </button>
      </div>

      {done ? (
        <p className="mt-4 text-sm font-semibold text-[#2E64A8]">
          {t.shopAdded} —{" "}
          <a href={localeHref(current, "/sklep/koszyk")} className="underline">
            {t.shopCart}
          </a>
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
