"use client"

import { FormEvent, useEffect, useState } from "react"
import { useCart } from "@/components/shop/CartProvider"
import { MEDUSA_KEY, MEDUSA_URL, formatPrice } from "@/lib/medusa"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type ShippingOption = { id: string; name: string; amount: number }

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
    const text = await response.text()
    throw new Error(text || `Medusa ${path}: ${response.status}`)
  }

  return response.json()
}

export default function Checkout({ locale = "pl" }: { locale?: string }) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const { cart, refresh, clear } = useCart()

  const [options, setOptions] = useState<ShippingOption[]>([])
  const [shippingOptionId, setShippingOptionId] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const [orderNumber, setOrderNumber] = useState<string | number>("")

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  })

  useEffect(() => {
    if (!cart?.id) return

    storeFetch(`/shipping-options?cart_id=${cart.id}`)
      .then((data) => {
        const list: ShippingOption[] = (data?.shipping_options || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          amount: Number(item.amount) || 0,
        }))
        setOptions(list)
        setShippingOptionId((currentId) => currentId || list[0]?.id || "")
      })
      .catch(() => setOptions([]))
  }, [cart?.id])

  function field(name: keyof typeof form) {
    return {
      value: form[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setForm((state) => ({ ...state, [name]: event.target.value })),
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!cart?.id) return

    setStatus("sending")
    setMessage("")

    try {
      const address = {
        first_name: form.firstName,
        last_name: form.lastName,
        address_1: form.address,
        city: form.city,
        postal_code: form.postalCode,
        country_code: "pl",
        phone: form.phone,
      }

      await storeFetch(`/carts/${cart.id}`, {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          shipping_address: address,
          billing_address: address,
        }),
      })

      if (shippingOptionId) {
        await storeFetch(`/carts/${cart.id}/shipping-methods`, {
          method: "POST",
          body: JSON.stringify({ option_id: shippingOptionId }),
        })
      }

      await storeFetch("/payment-collections", {
        method: "POST",
        body: JSON.stringify({ cart_id: cart.id }),
      }).then((data) =>
        storeFetch(`/payment-collections/${data.payment_collection.id}/payment-sessions`, {
          method: "POST",
          body: JSON.stringify({ provider_id: "pp_system_default" }),
        })
      )

      const completed = await storeFetch(`/carts/${cart.id}/complete`, { method: "POST" })

      if (completed?.type === "order" || completed?.order) {
        setOrderNumber(completed?.order?.display_id || completed?.order?.id || "")
        setStatus("done")
        clear()
      } else {
        throw new Error(completed?.error?.message || "Nie udało się złożyć zamówienia.")
      }
    } catch (error: any) {
      setStatus("error")
      setMessage(error?.message?.slice(0, 300) || "Nie udało się złożyć zamówienia.")
      refresh()
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-[#111827]/10 bg-white p-10 text-center shadow-sm">
        <h2 className="text-2xl font-semibold">{t.shopOrderDone}</h2>
        {orderNumber ? (
          <p className="mt-3 text-lg font-bold text-[#2E64A8]">#{orderNumber}</p>
        ) : null}
        <p className="mt-3 text-[#111827]/55">{t.shopOrderDoneLead}</p>
        <a
          href={localeHref(current, "/sklep")}
          className="mt-6 inline-flex rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
        >
          {t.shopBackToShop}
        </a>
      </div>
    )
  }

  if (!cart || !cart.lines.length) {
    return (
      <div className="rounded-lg border border-[#111827]/10 bg-white p-10 text-center shadow-sm">
        <h2 className="text-2xl font-semibold">{t.shopCartEmpty}</h2>
        <a
          href={localeHref(current, "/sklep")}
          className="mt-6 inline-flex rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F]"
        >
          {t.shopContinue}
        </a>
      </div>
    )
  }

  const inputClass =
    "w-full rounded-md border border-[#111827]/15 px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-semibold">{t.shopCustomer}</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input {...field("firstName")} required placeholder={t.shopFirstName} className={inputClass} />
            <input {...field("lastName")} required placeholder={t.shopLastName} className={inputClass} />
            <input {...field("email")} required type="email" placeholder={t.cfgEmail} className={inputClass} />
            <input {...field("phone")} placeholder={t.cfgPhone} className={inputClass} />
            <input {...field("address")} required placeholder={t.shopAddress} className={`${inputClass} md:col-span-2`} />
            <input {...field("postalCode")} required placeholder={t.shopPostal} className={inputClass} />
            <input {...field("city")} required placeholder={t.shopCity} className={inputClass} />
          </div>
        </section>

        <section className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-semibold">{t.shopDelivery}</h2>

          <div className="mt-5 space-y-2">
            {options.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm transition ${
                  option.id === shippingOptionId
                    ? "border-[#2E64A8] bg-[#2E64A8]/5"
                    : "border-[#111827]/12 hover:border-[#2E64A8]/40"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shipping"
                    checked={option.id === shippingOptionId}
                    onChange={() => setShippingOptionId(option.id)}
                  />
                  <span className="font-medium">{option.name}</span>
                </span>
                <strong>{option.amount ? formatPrice(option.amount) : "0,00 zł"}</strong>
              </label>
            ))}

            {!options.length ? (
              <p className="text-sm text-[#111827]/45">—</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-semibold">{t.shopPayment}</h2>
          <p className="mt-3 text-sm leading-7 text-[#111827]/60">{t.shopPaymentLead}</p>
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm lg:sticky lg:top-6">
        <h2 className="text-xl font-semibold">{t.shopOrderTitle}</h2>

        <div className="mt-5 space-y-2 text-sm">
          {cart.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-[#111827]/60">
                {line.quantity} × {line.title}
              </span>
              <strong className="shrink-0">{formatPrice(line.total)}</strong>
            </div>
          ))}

          <div className="flex justify-between gap-4 border-t border-[#111827]/10 pt-3">
            <span className="text-[#111827]/55">{t.shopSubtotal}</span>
            <strong>{formatPrice(cart.subtotal)}</strong>
          </div>

          <div className="flex justify-between gap-4 text-base">
            <span className="text-[#111827]/55">{t.shopTotal}</span>
            <strong>{formatPrice(cart.total)}</strong>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-6 inline-flex w-full justify-center rounded-md bg-[#2E64A8] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#28588F] disabled:opacity-60"
        >
          {status === "sending" ? t.shopOrderSending : t.shopPlaceOrder}
        </button>

        {message ? <p className="mt-4 text-sm text-red-600">{message}</p> : null}
      </aside>
    </form>
  )
}
