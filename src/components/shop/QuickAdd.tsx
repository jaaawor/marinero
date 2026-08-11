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
      className="w-full rounded-md border border-[#111827]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#111827] transition hover:border-[#2E64A8] hover:bg-[#2E64A8] hover:text-white disabled:opacity-60"
    >
      {done ? t.shopAdded : t.shopQuickAdd}
    </button>
  )
}
