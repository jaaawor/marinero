"use client"

import { FormEvent, useEffect, useState } from "react"
import { useCart } from "@/components/shop/CartProvider"
import { MEDUSA_KEY, MEDUSA_URL, formatPrice } from "@/lib/medusa"
import { shop } from "@/components/shop/theme"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"

type ShippingOption = { id: string; name: string; amount: number }

// Region bez automatycznego podatku + rabat równy VAT-owi = sprzedaż netto
// dla firmy z UE. Fakturę wystawiacie ręcznie, więc tu liczy się kwota.
const EU_B2B_REGION = "reg_01KZTAHM16JDWT3ENTGPW9HMSW"
const PL_REGION = "reg_01KX19MR45J795FGMA75EXDFYJ"
const VAT_PROMO = "VATUE"

// Kraje dostawy — Polska domyślnie, reszta UE dla wysyłki zagranicznej.
const SHIPPING_COUNTRIES = [
  { code: "pl", label: "Polska" },
  { code: "de", label: "Deutschland" },
  { code: "cz", label: "Česko" },
  { code: "sk", label: "Slovensko" },
  { code: "lt", label: "Lietuva" },
  { code: "lv", label: "Latvija" },
  { code: "ee", label: "Eesti" },
  { code: "se", label: "Sverige" },
  { code: "dk", label: "Danmark" },
  { code: "nl", label: "Nederland" },
  { code: "fr", label: "France" },
  { code: "it", label: "Italia" },
  { code: "es", label: "España" },
]

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

  // Płatność online pokazujemy dopiero, gdy serwer potwierdzi, że sklep ma
  // konto PayU. Bez tego zostaje przelew — czyli to, co działa dziś.
  const [payuOn, setPayuOn] = useState(false)
  const [payMethod, setPayMethod] = useState<"payu" | "przelew">("payu")

  useEffect(() => {
    fetch("/api/payu/start", { method: "GET" })
      .then((response) => response.json())
      .then((body) => setPayuOn(Boolean(body?.wlaczone)))
      .catch(() => setPayuOn(false))
  }, [])

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "pl",
    vatId: "",
  })

  // Sprzedaż jest brutto (klient prywatny). Firma z UE spoza Polski może kupić
  // bez VAT-u, ale dopiero po potwierdzeniu numeru w rejestrze VIES.
  const canAskForVat = form.country !== "pl" && form.vatId.trim().length > 3

  const [vat, setVat] = useState<{
    state: "idle" | "checking" | "ok" | "invalid" | "error"
    name?: string
  }>({ state: "idle" })

  async function checkVatId() {
    setVat({ state: "checking" })

    try {
      const response = await fetch("/api/vat/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vatId: form.vatId.trim() }),
      })
      const data = await response.json()

      if (!data?.valid) {
        setVat({ state: data?.error === "vies_unavailable" ? "error" : "invalid" })
        return
      }

      if (cart?.id) {
        await storeFetch(`/carts/${cart.id}`, {
          method: "POST",
          body: JSON.stringify({ region_id: EU_B2B_REGION, promo_codes: [VAT_PROMO] }),
        })
        await refresh()
      }

      setVat({ state: "ok", name: data.name || "" })
    } catch {
      setVat({ state: "error" })
    }
  }

  // Powrót do sprzedaży z VAT-em, gdy klient wycofa numer albo wróci do Polski
  async function resetVatExemption() {
    setVat({ state: "idle" })
    if (!cart?.id) return

    await storeFetch(`/carts/${cart.id}`, {
      method: "POST",
      body: JSON.stringify({ region_id: PL_REGION, promo_codes: [] }),
    })
    await refresh()
  }

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
        country_code: form.country,
        phone: form.phone,
      }

      await storeFetch(`/carts/${cart.id}`, {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          shipping_address: address,
          billing_address: address,
          ...(form.vatId.trim()
            ? {
                metadata: {
                  vat_id: form.vatId.trim(),
                  vat_verified: vat.state === "ok",
                  vat_name: vat.name || "",
                },
              }
            : {}),
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
        const order = completed?.order || {}
        setOrderNumber(order.display_id || order.id || "")

        // Zamówienie już jest w Medusie — koszyk czyścimy niezależnie od
        // tego, czy płatność dojdzie do skutku. Nieopłacone zamówienie widać
        // w panelu; koszyk, którego nie da się ponownie złożyć, byłby gorszy.
        clear()

        if (payuOn && payMethod === "payu" && order.id) {
          const payment = await fetch("/api/payu/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ zamowienie: order.id }),
          })
            .then((response) => response.json())
            .catch(() => null)

          if (payment?.redirect) {
            window.location.href = payment.redirect
            return
          }

          // Płatność nie wystartowała, ale zamówienie stoi — mówimy o tym
          // wprost, zamiast udawać, że wszystko poszło gładko.
          setStatus("done")
          setMessage(
            payment?.error ||
              "Zamówienie przyjęte, ale nie udało się otworzyć płatności — napiszemy z danymi do przelewu."
          )
          return
        }

        setStatus("done")
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
          {message || t.shopOrderDoneLead}
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

            <label>
              <span className={shop.label}>{t.shopCountry}</span>
              <select
                value={form.country}
                onChange={(event) =>
                  setForm((state) => ({ ...state, country: event.target.value }))
                }
                className={shop.input}
              >
                {SHIPPING_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={shop.label}>{t.shopVatId}</span>
              <div className="flex gap-2">
                <input
                  value={form.vatId}
                  onChange={(event) => {
                    setForm((state) => ({ ...state, vatId: event.target.value }))
                    if (vat.state !== "idle") resetVatExemption()
                  }}
                  placeholder="np. DE123456789"
                  className={shop.input}
                />

                <button
                  type="button"
                  onClick={checkVatId}
                  disabled={!canAskForVat || vat.state === "checking"}
                  className="shrink-0 rounded-sm border border-[#0E1A2B]/15 px-4 text-[12px] font-bold uppercase tracking-[0.14em] text-[#0E1A2B]/70 transition hover:border-[#0E1A2B] hover:text-[#0E1A2B] disabled:opacity-40"
                >
                  {vat.state === "checking" ? t.shopVatChecking : t.shopVatCheck}
                </button>
              </div>
            </label>
          </div>

          {vat.state === "ok" ? (
            <p className="mt-5 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm leading-6 text-[#0E1A2B]/75">
              {t.shopVatOk}
              {vat.name ? ` — ${vat.name}` : ""}
            </p>
          ) : vat.state === "invalid" ? (
            <p className="mt-5 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm leading-6 text-[#0E1A2B]/75">
              {t.shopVatInvalid}
            </p>
          ) : vat.state === "error" ? (
            <p className="mt-5 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-[#0E1A2B]/75">
              {t.shopVatError}
            </p>
          ) : canAskForVat ? (
            <p className="mt-5 text-sm leading-6 text-[#0E1A2B]/50">{t.shopVatIdHint}</p>
          ) : null}
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

          {payuOn ? (
            <div className="mt-6 grid max-w-xl gap-3">
              {(
                [
                  ["payu", "Płatność online", "Karta, BLIK lub szybki przelew — przez PayU."],
                  ["przelew", "Przelew tradycyjny", t.shopPaymentLead],
                ] as const
              ).map(([value, label, lead]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer gap-3 border p-4 transition ${
                    payMethod === value
                      ? "border-[#2E64A8] bg-[#2E64A8]/5"
                      : "border-[#0E1A2B]/12 hover:border-[#0E1A2B]/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="platnosc"
                    className="mt-1"
                    checked={payMethod === value}
                    onChange={() => setPayMethod(value)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#0E1A2B]">{label}</span>
                    <span className="mt-1 block text-sm leading-6 text-[#0E1A2B]/55">{lead}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-6 max-w-xl text-sm leading-7 text-[#0E1A2B]/60">{t.shopPaymentLead}</p>
          )}
        </section>
      </div>

      <aside className="h-fit border border-[#0E1A2B]/12 bg-white p-7 md:p-8 lg:sticky lg:top-6">
        <p className={shop.eyebrow}>{t.shopOrderTitle}</p>

        <div className="mt-7 space-y-3 text-sm">
          {cart.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-4">
              <span className="min-w-0 truncate text-[#0E1A2B]/55">
                {line.quantity} × {line.title}
              </span>
              <strong className="shrink-0 font-semibold">{formatPrice(line.total)}</strong>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4 border-t border-[#0E1A2B]/10 pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#0E1A2B]/50">{t.shopNet}</span>
            <strong className="font-semibold">{formatPrice(cart.subtotal)}</strong>
          </div>

          {cart.discountTotal ? (
            <div className="flex justify-between gap-4">
              <span className="text-[#0E1A2B]/50">{t.shopVatRemoved}</span>
              <strong className="font-semibold text-emerald-700">
                −{formatPrice(cart.discountTotal)}
              </strong>
            </div>
          ) : null}

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

          <div className="flex justify-between gap-4">
            <span className="text-[#0E1A2B]/50">{t.shopTotal}</span>
            <strong className="text-xl font-semibold tracking-[-0.02em]">
              {formatPrice(cart.total)}
            </strong>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className={`${shop.btnPrimary} mt-8 w-full disabled:opacity-60`}
        >
          {status === "sending" ? t.shopOrderSending : t.shopPlaceOrder}
        </button>

        {message ? <p className="mt-5 text-sm text-red-600">{message}</p> : null}

        <a
          href={localeHref(current, "/sklep/koszyk")}
          className="mt-5 block text-center text-[12px] font-bold uppercase tracking-[0.16em] text-[#0E1A2B]/45 transition hover:text-[#2E64A8]"
        >
          ← {t.shopCart}
        </a>
      </aside>
    </form>
  )
}
