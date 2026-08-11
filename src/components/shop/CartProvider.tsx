"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { MEDUSA_KEY, MEDUSA_URL } from "@/lib/medusa"

const CART_STORAGE_KEY = "marinero_cart_id"
const CART_COUNT_EVENT = "marinero-cart-count"

export type CartLine = {
  id: string
  title: string
  variantTitle: string
  quantity: number
  unitPrice: number
  total: number
  thumbnail: string
  productHandle: string
}

export type Cart = {
  id: string
  lines: CartLine[]
  subtotal: number
  shippingTotal: number
  taxTotal: number
  total: number
  itemCount: number
  currency: string
}

type CartContextValue = {
  cart: Cart | null
  loading: boolean
  addItem: (variantId: string, quantity?: number) => Promise<void>
  updateItem: (lineId: string, quantity: number) => Promise<void>
  removeItem: (lineId: string) => Promise<void>
  refresh: () => Promise<void>
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

async function storeFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${MEDUSA_URL}/store${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": MEDUSA_KEY,
      ...(init.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Medusa ${path}: ${response.status}`)
  }

  return response.json()
}

function mapCart(raw: any): Cart {
  const lines: CartLine[] = (raw?.items || []).map((item: any) => ({
    id: item.id,
    title: item.product_title || item.title || "",
    variantTitle: item.variant_title || "",
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unit_price) || 0,
    total: Number(item.total ?? (item.unit_price || 0) * (item.quantity || 0)),
    thumbnail: item.thumbnail || "",
    productHandle: item.product_handle || item?.variant?.product?.handle || "",
  }))

  return {
    id: raw?.id || "",
    lines,
    subtotal: Number(raw?.item_subtotal ?? raw?.subtotal ?? 0),
    shippingTotal: Number(raw?.shipping_total ?? 0),
    taxTotal: Number(raw?.tax_total ?? 0),
    total: Number(raw?.total ?? 0),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    currency: String(raw?.currency_code || "pln").toUpperCase(),
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(false)

  const loadCart = useCallback(async (cartId: string) => {
    const data = await storeFetch(`/carts/${cartId}`)
    setCart(mapCart(data.cart))
  }, [])

  const ensureCart = useCallback(async (): Promise<string> => {
    const existing = window.localStorage.getItem(CART_STORAGE_KEY)
    if (existing) return existing

    const regions = await storeFetch("/regions")
    const region =
      (regions?.regions || []).find(
        (item: any) => String(item.currency_code).toLowerCase() === "pln"
      ) || regions?.regions?.[0]

    const created = await storeFetch("/carts", {
      method: "POST",
      body: JSON.stringify({ region_id: region?.id }),
    })

    const id = created?.cart?.id
    window.localStorage.setItem(CART_STORAGE_KEY, id)
    return id
  }, [])

  const refresh = useCallback(async () => {
    const id = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!id) {
      setCart(null)
      return
    }

    try {
      await loadCart(id)
    } catch {
      // koszyk mógł wygasnąć po stronie Medusy
      window.localStorage.removeItem(CART_STORAGE_KEY)
      setCart(null)
    }
  }, [loadCart])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Licznik w pasku sklepu żyje poza tym providerem — informujemy go zdarzeniem.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(CART_COUNT_EVENT, { detail: cart?.itemCount || 0 })
    )
  }, [cart])

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      setLoading(true)
      try {
        const id = await ensureCart()
        const data = await storeFetch(`/carts/${id}/line-items`, {
          method: "POST",
          body: JSON.stringify({ variant_id: variantId, quantity }),
        })
        setCart(mapCart(data.cart))
      } finally {
        setLoading(false)
      }
    },
    [ensureCart]
  )

  const updateItem = useCallback(async (lineId: string, quantity: number) => {
    const id = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!id) return

    setLoading(true)
    try {
      const data = await storeFetch(`/carts/${id}/line-items/${lineId}`, {
        method: "POST",
        body: JSON.stringify({ quantity }),
      })
      setCart(mapCart(data.cart))
    } finally {
      setLoading(false)
    }
  }, [])

  const removeItem = useCallback(
    async (lineId: string) => {
      const id = window.localStorage.getItem(CART_STORAGE_KEY)
      if (!id) return

      setLoading(true)
      try {
        await storeFetch(`/carts/${id}/line-items/${lineId}`, { method: "DELETE" })
        await loadCart(id)
      } finally {
        setLoading(false)
      }
    },
    [loadCart]
  )

  const clear = useCallback(() => {
    window.localStorage.removeItem(CART_STORAGE_KEY)
    setCart(null)
  }, [])

  const value = useMemo(
    () => ({ cart, loading, addItem, updateItem, removeItem, refresh, clear }),
    [cart, loading, addItem, updateItem, removeItem, refresh, clear]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart musi być użyty wewnątrz CartProvider")
  }
  return context
}

export { CART_STORAGE_KEY, CART_COUNT_EVENT }
