"use client"

import { useState } from "react"
import { useCart } from "@/components/shop/CartProvider"
import { getDictionary, normalizeLocale } from "@/lib/i18n"

type QuickAddProps = {
  variantId: string
  locale?: string
}

// Dodawanie do koszyka wprost z kafelka na liście produktów.
export default function QuickAdd({ variantId, locale = "pl" }: QuickAddProps) {
  const t = getDictionary(normalizeLocale(locale))
  const { addItem, loading } = useCart()
  const [done, setDone] = useState(false)

  async function add() {
    try {
      await addItem(variantId, 1)
      setDone(true)
      window.setTimeout(() => setDone(false), 2500)
    } catch {
      setDone(false)
    }
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={loading}
      className="w-full rounded-sm bg-[#0E1A2B] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg transition hover:bg-[#2E64A8] disabled:opacity-60"
    >
      {done ? t.shopAdded : t.shopQuickAdd}
    </button>
  )
}
