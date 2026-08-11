"use client"

import { useState } from "react"
import { useCart } from "@/components/shop/CartProvider"
import { formatPrice } from "@/lib/medusa"
import type { ShopVariant } from "@/lib/medusa"
import { shop } from "@/components/shop/theme"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type AddToCartProps = {
  variants: ShopVariant[]
  locale?: string
  /** Cena produktu — pokazywana, gdy wariant nie ma własnej ceny. */
  price?: number | null
}

export default function AddToCart({ variants, locale = "pl", price }: AddToCartProps) {
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

  // Cena idzie za wybranym wariantem — inaczej nagłówek kłamie przy wyborze.
  const shownPrice = typeof variant?.price === "number" ? variant.price : price

  return (
    <div className="mt-7">
      {typeof shownPrice === "number" ? (
        <p className="mb-8 text-3xl font-semibold tracking-[-0.03em]">
          {formatPrice(shownPrice)}
        </p>
      ) : null}

      {variants.length > 1 ? (
        <label className="mb-5 block">
          <span className={shop.label}>{t.shopVariant}</span>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            className={shop.input}
          >
            {variants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} {item.price ? `— ${formatPrice(item.price)}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex items-stretch gap-3">
        {/* Licznik sztuk — bez strzałek, w duchu reszty sklepu */}
        <div className="flex items-center rounded-sm border border-[#0E1A2B]/15 bg-white">
          <button
            type="button"
            aria-label="-"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="px-4 py-4 text-lg leading-none text-[#0E1A2B]/45 transition hover:text-[#0E1A2B]"
          >
            −
          </button>

          <input
            type="number"
            min={1}
            value={quantity}
            aria-label={t.shopQuantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            className="w-12 border-0 bg-transparent p-0 text-center text-sm font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />

          <button
            type="button"
            aria-label="+"
            onClick={() => setQuantity((value) => value + 1)}
            className="px-4 py-4 text-lg leading-none text-[#0E1A2B]/45 transition hover:text-[#0E1A2B]"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className={`${shop.btnPrimary} flex-1 disabled:opacity-60`}
        >
          {t.shopAddToCart}
        </button>
      </div>

      {done ? (
        <p className="mt-5 flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[#2E64A8]">
          {t.shopAdded}
          <a
            href={localeHref(current, "/sklep/koszyk")}
            className="underline underline-offset-4 hover:text-[#0E1A2B]"
          >
            {t.shopCart} →
          </a>
        </p>
      ) : null}

      {error ? <p className="mt-5 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
