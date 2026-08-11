"use client"

import { FormEvent, useEffect, useState } from "react"
import { useCart } from "@/components/shop/CartProvider"
import { MEDUSA_KEY, MEDUSA_URL, formatPrice } from "@/lib/medusa"
import { shop } from "@/components/shop/theme"
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

  // Kolejność wywołań jest zweryfikowana na żywym API Medusy — nie zmieniać bez testu.
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
      <div className="bg-white px-6 py-20 text-center">
        <p className={shop.eyebrow}>{t.shopStepDone}</p>
        <h2 className={`${shop.display} mt-5 text-3xl md:text-4xl`}>{t.shopOrderDone}</h2>

        {orderNumber ? (
          <p className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-[#2E64A8]">
            #{orderNumber}
          </p>
        ) : null}

        <p className="mx-auto mt-5 max-w-md text-base leading-8 text-[#0E1A2B]/55">
          {t.shopOrderDoneLead}
        </p>

        <a href={localeHref(current, "/sklep")} className={`${shop.btnPrimary} mt-9`}>
          {t.shopBackToShop}
        </a>
      </div>
    )
  }

  if (!cart || !cart.lines.length) {
    return (
      <div className="bg-white px-6 py-20 text-center">
        <p className={shop.eyebrow}>{t.shopCart}</p>
        <h2 className={`${shop.display} mt-5 text-3xl md:text-4xl`}>{t.shopCartEmpty}</h2>
        <a href={localeHref(current, "/sklep/produkty")} className={`${shop.btnPrimary} mt-9`}>
          {t.shopContinue}
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-px bg-[#0E1A2B]/10">
        <section className="bg-white p-6 md:p-9">
          <div className="flex items-baseline gap-4">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#0E1A2B]/25">01</span>
            <h2 className={`${shop.display} text-xl md:text-2xl`}>{t.shopCustomer}</h2>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <label>
              <span className={shop.label}>{t.shopFirstName}</span>
              <input {...field("firstName")} required className={shop.input} />
            </label>

            <label>
              <span className={shop.label}>{t.shopLastName}</span>
              <input {...field("lastName")} required className={shop.input} />
            </label>

            <label>
              <span className={shop.label}>{t.cfgEmail}</span>
              <input {...field("email")} required type="email" className={shop.input} />
            </label>

            <label>
              <span className={shop.label}>{t.cfgPhone}</span>
              <input {...field("phone")} className={shop.input} />
            </label>

            <label className="md:col-span-2">
              <span className={shop.label}>{t.shopAddress}</span>
              <input {...field("address")} required className={shop.input} />
            </label>

            <label>
              <span className={shop.label}>{t.shopPostal}</span>
              <input {...field("postalCode")} required className={shop.input} />
            </label>

            <label>
              <span className={shop.label}>{t.shopCity}</span>
              <input {...field("city")} required className={shop.input} />
            </label>
          </div>
        </section>

        <section className="bg-white p-6 md:p-9">
          <div className="flex items-baseline gap-4">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#0E1A2B]/25">02</span>
            <h2 className={`${shop.display} text-xl md:text-2xl`}>{t.shopDelivery}</h2>
          </div>

          <div className="mt-7 space-y-3">
            {options.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center justify-between gap-4 rounded-sm border px-5 py-4 text-sm transition ${
                  option.id === shippingOptionId
                    ? "border-[#0E1A2B] bg-[#0E1A2B]/[0.03]"
                    : "border-[#0E1A2B]/12 hover:border-[#0E1A2B]/40"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shipping"
                    className="accent-[#0E1A2B]"
                    checked={option.id === shippingOptionId}
                    onChange={() => setShippingOptionId(option.id)}
                  />
                  <span className="font-medium">{option.name}</span>
                </span>

                <strong className="font-semibold">
                  {option.amount ? formatPrice(option.amount) : t.shopFree}
                </strong>
              </label>
            ))}

            {!options.length ? (
              <p className="text-sm text-[#0E1A2B]/45">{t.shopTrust2Lead}</p>
            ) : null}
          </div>
        </section>

        <section className="bg-white p-6 md:p-9">
          <div className="flex items-baseline gap-4">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#0E1A2B]/25">03</span>
            <h2 className={`${shop.display} text-xl md:text-2xl`}>{t.shopPayment}</h2>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#0E1A2B]/60">{t.shopPaymentLead}</p>
        </section>
      </div>

      <aside className={`h-fit p-7 md:p-8 lg:sticky lg:top-6 ${shop.dark}`}>
        <p className={shop.eyebrowLight}>{t.shopOrderTitle}</p>

        <div className="mt-7 space-y-3 text-sm">
          {cart.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-4">
              <span className="min-w-0 truncate text-white/55">
                {line.quantity} × {line.title}
              </span>
              <strong className="shrink-0 font-semibold">{formatPrice(line.total)}</strong>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4 border-t border-white/15 pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-white/50">{t.shopSubtotal}</span>
            <strong className="font-semibold">{formatPrice(cart.subtotal)}</strong>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-white/50">{t.shopTotal}</span>
            <strong className="text-xl font-semibold tracking-[-0.02em]">
              {formatPrice(cart.total)}
            </strong>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className={`${shop.btnOnDark} mt-8 w-full disabled:opacity-60`}
        >
          {status === "sending" ? t.shopOrderSending : t.shopPlaceOrder}
        </button>

        {message ? <p className="mt-5 text-sm text-red-300">{message}</p> : null}

        <a
          href={localeHref(current, "/sklep/koszyk")}
          className="mt-5 block text-center text-[12px] font-bold uppercase tracking-[0.16em] text-white/45 transition hover:text-white"
        >
          ← {t.shopCart}
        </a>
      </aside>
    </form>
  )
}
