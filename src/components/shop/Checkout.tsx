"use client"

import { FormEvent, useEffect, useState } from "react"
import { useCart } from "@/components/shop/CartProvider"
import { MEDUSA_KEY, MEDUSA_URL, formatPrice } from "@/lib/medusa"
import { shop } from "@/components/shop/theme"
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n"
import { zglosKoszyk } from "@/lib/zglos-koszyk"
import { zglosZakup } from "@/lib/pomiar-zakupu"
import PaczkomatPicker from "@/components/shop/PaczkomatPicker"
import {
  czyKurierWgWagi,
  czyPaczkomatMozliwy,
  nazwaDlaKlienta,
  nazwaOpcjiDlaWagi,
  wagaKoszyka,
  wycenaWysylki,
} from "@/lib/wysylka"

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

export default function Checkout({
  locale = "pl",
  konwersjaAds = "",
}: {
  locale?: string
  /** Etykieta konwersji z Google Ads (`AW-…/…`) — z `site_settings`. */
  konwersjaAds?: string
}) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)
  const { cart, refresh, clear } = useCart()

  const [options, setOptions] = useState<ShippingOption[]>([])
  const [shippingOptionId, setShippingOptionId] = useState("")
  // `null` = jeszcze nie wiemy, `undefined` = wiemy, że się nie da policzyć
  const [wagaKg, setWagaKg] = useState<number | null | undefined>(null)
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const [orderNumber, setOrderNumber] = useState<string | number>("")

  // Płatność online pokazujemy dopiero, gdy serwer potwierdzi, że sklep ma
  // konto PayU. Bez tego zostaje przelew — czyli to, co działa dziś.
  const [paczkomat, setPaczkomat] = useState({ kod: "", opis: "" })
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
    company: "",
    vatId: "",
  })

  // Zalogowanemu podstawiamy dane — ale **tylko w puste pola**. Ktoś mógł
  // zacząć wypełniać formularz, zanim odpowiedź wróciła, i nadpisanie tego,
  // co już wpisał, byłoby gorsze niż brak podpowiedzi.
  useEffect(() => {
    let aktualne = true

    fetch("/api/konto")
      .then((odpowiedz) => odpowiedz.json())
      .then((konto) => {
        if (!aktualne || !konto?.zalogowany) return
        setForm((state) => ({
          ...state,
          email: state.email || konto.email || "",
          firstName: state.firstName || konto.imie || "",
          lastName: state.lastName || konto.nazwisko || "",
          phone: state.phone || konto.telefon || "",
        }))
      })
      .catch(() => undefined)

    return () => {
      aktualne = false
    }
  }, [])

  // Sprzedaż jest brutto (klient prywatny). Firma z UE spoza Polski może kupić
  // bez VAT-u, ale dopiero po potwierdzeniu numeru w rejestrze VIES.
  //
  // Polski NIP niczego z VAT-em nie robi — polska firma płaci tak samo jak
  // osoba prywatna. Przycisk przy tym polu **pobiera dane firmy**: przy NIP-ie
  // z wykazu podatników MF, przy numerze VAT UE z VIES-u (ten przy okazji
  // zdejmuje VAT). Samo sprawdzanie numeru bez żadnego pożytku dla kupującego
  // wyglądało jak kontrola.
  const isPolishCompany = form.country === "pl"
  const canFetchCompany = form.vatId.trim().length > 3

  const [vat, setVat] = useState<{
    state: "idle" | "checking" | "ok" | "invalid" | "error" | "company" | "notfound"
    name?: string
  }>({ state: "idle" })

  /** Polski NIP → wykaz MF: nazwa firmy i adres wskakują do formularza. */
  async function fetchPolishCompany() {
    setVat({ state: "checking" })

    try {
      const response = await fetch("/api/firma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nip: form.vatId.trim() }),
      })
      const data = await response.json()

      if (!data?.found) {
        setVat({ state: data?.error === "unavailable" ? "error" : "notfound" })
        return
      }

      // Adres nadpisujemy tylko tam, gdzie klient jeszcze nic nie wpisał —
      // firma bywa zarejestrowana pod innym adresem, niż chce mieć przesyłkę.
      setForm((state) => ({
        ...state,
        company: data.name || state.company,
        address: state.address || data.street || "",
        postalCode: state.postalCode || data.postalCode || "",
        city: state.city || data.city || "",
      }))

      setVat({ state: "company", name: data.name || "" })
    } catch {
      setVat({ state: "error" })
    }
  }

  /** Numer VAT UE → VIES: potwierdzenie firmy i przejście na sprzedaż bez VAT. */
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

      if (data.name) setForm((state) => ({ ...state, company: state.company || data.name }))

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

  // Kto jest na zamówieniu i z jakim adresem — sprzedawca widzi to w narzędziach
  // pod „Koszyki w tej chwili". E-mail dopisujemy dopiero, gdy klient sam go
  // wpisze; do tego czasu leci sam etap.
  useEffect(() => {
    if (!cart?.id || !cart.lines.length) return
    zglosKoszyk({
      cartId: cart.id,
      pozycje: cart.lines.map((linia) => `${linia.quantity} × ${linia.title}`).join(", "),
      sztuk: cart.itemCount,
      wartosc: cart.total,
      etap: "zamowienie",
      email: form.email.includes("@") ? form.email : undefined,
    })
  }, [cart?.id, cart?.itemCount, cart?.total, form.email])

  // Waga koszyka. Osobne zapytanie, bo zwykła odpowiedź koszyka nie zawiera
  // wagi wariantu — trzeba o nią poprosić wprost.
  useEffect(() => {
    if (!cart?.id) return

    storeFetch(`/carts/${cart.id}?fields=%2Bitems.variant.weight`)
      .then((data) => {
        const pozycje = (data?.cart?.items || []).map((item: any) => ({
          quantity: item.quantity,
          variant: { weight: item?.variant?.weight },
        }))
        setWagaKg(wagaKoszyka(pozycje) ?? undefined)
      })
      .catch(() => setWagaKg(undefined))
  }, [cart?.id, cart?.itemCount])

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
      })
      .catch(() => setOptions([]))
  }, [cart?.id])

  // Z cennika wagowego pokazujemy **jedną** opcję — tę, która pasuje do wagi
  // koszyka. Reszta (odbiór osobisty, wysyłka zagraniczna) leci bez zmian.
  // Cena i tak pochodzi z Medusy; tu tylko decydujemy, co klient widzi.
  const oczekiwana = wagaKg === null ? "" : nazwaOpcjiDlaWagi(wagaKg ?? null)
  const paczkomatMozliwy = czyPaczkomatMozliwy(wagaKg ?? null)
  const widoczneOpcje =
    wagaKg === null
      ? options
      : options.filter((option) => {
          // Paczkomat tylko dla paczek, które się w nim mieszczą.
          if (/paczkomat/i.test(option.name)) return paczkomatMozliwy
          return !czyKurierWgWagi(option.name) || option.name === oczekiwana
        })

  useEffect(() => {
    if (!widoczneOpcje.length) return
    // Jeśli wybrana opcja zniknęła (zmiana zawartości koszyka zmieniła próg),
    // przestawiamy wybór na pierwszą widoczną — inaczej zostałby wybór, którego
    // klient już nie widzi, a zapłaciłby według niego.
    if (!widoczneOpcje.some((option) => option.id === shippingOptionId)) {
      setShippingOptionId(widoczneOpcje[0].id)
    }
  }, [widoczneOpcje, shippingOptionId])

  const wycena = wagaKg === null ? null : wycenaWysylki(wagaKg ?? null)

  // Paczkomat rozpoznajemy po nazwie opcji z Medusy — to sprzedawca zakłada je
  // w panelu i nazwa jest jedynym pewnym śladem, jaki mamy po stronie sklepu.
  const wybranaOpcja = widoczneOpcje.find((option) => option.id === shippingOptionId)
  const doPaczkomatu = /paczkomat/i.test(wybranaOpcja?.name || "")

  // Zmiana sposobu dostawy zdejmuje wybrany automat: kod paczkomatu przy
  // przesyłce kurierskiej trafiłby do zamówienia i mylił przy nadawaniu.
  useEffect(() => {
    if (!doPaczkomatu && paczkomat.kod) setPaczkomat({ kod: "", opis: "" })
  }, [doPaczkomatu, paczkomat.kod])

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

    // Bez wybranego automatu nie ma dokąd nadać przesyłki — a zamówienie
    // złożone „na paczkomat" bez kodu wraca do klienta telefonem.
    if (doPaczkomatu && !paczkomat.kod) {
      setStatus("error")
      setMessage("Wybierz paczkomat, do którego mamy wysłać przesyłkę.")
      return
    }

    setStatus("sending")
    setMessage("")

    try {
      const address = {
        first_name: form.firstName,
        last_name: form.lastName,
        // Medusa ma na to własne pole — dzięki temu nazwa firmy wchodzi na
        // adres w zamówieniu, a nie tylko w metadane.
        company: form.company.trim() || undefined,
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
          ...(form.vatId.trim() || form.company.trim() || paczkomat.kod
            ? {
                metadata: {
                  ...(form.vatId.trim() || form.company.trim()
                    ? {
                        vat_id: form.vatId.trim(),
                        vat_verified: vat.state === "ok",
                        vat_name: vat.name || form.company.trim(),
                      }
                    : {}),
                  // Kod automatu wchodzi w metadane zamówienia — stamtąd bierze
                  // go nadanie przesyłki w Apaczce.
                  ...(paczkomat.kod
                    ? { paczkomat: paczkomat.kod, paczkomat_adres: paczkomat.opis }
                    : {}),
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

        // Google Ads i GA4: bez zdarzenia zakupu kampania optymalizuje się
        // na kliknięcia, a nie na sprzedaż. Wysyłamy przed odjazdem do PayU,
        // bo po nim klient wraca już na inny adres.
        zglosZakup({
          numer: String(order.display_id || order.id || cart.id),
          wartosc: cart.total,
          etykietaAds: konwersjaAds,
        })

        // Koszyk zamknięty — znika z listy „w trakcie zakupów".
        zglosKoszyk({
          cartId: cart.id,
          pozycje: String(order.display_id || order.id || ""),
          sztuk: cart.itemCount,
          wartosc: cart.total,
          etap: "zlozone",
          email: form.email,
        })

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
              t.payOpenError
          )
          return
        }

        // Przelew tradycyjny: nikt się już nie odezwie, więc potwierdzenie
        // dla klienta zamawiamy stąd. Przy PayU wychodzi ono z powiadomienia
        // od nich — dopiero wtedy wiadomo, że pieniądze są.
        fetch("/api/zamowienia/potwierdz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zamowienie: order.id }),
          keepalive: true,
        }).catch(() => {})

        setStatus("done")
      } else {
        throw new Error(completed?.error?.message || t.orderError)
      }
    } catch (error: any) {
      setStatus("error")
      setMessage(error?.message?.slice(0, 300) || t.orderError)
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
              <span className={shop.label}>{t.shopCompanyName}</span>
              <input {...field("company")} className={shop.input} />
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
                  onClick={isPolishCompany ? fetchPolishCompany : checkVatId}
                  disabled={!canFetchCompany || vat.state === "checking"}
                  className="shrink-0 rounded-sm border border-[#0E1A2B]/15 px-4 text-[12px] font-bold uppercase tracking-[0.14em] text-[#0E1A2B]/70 transition hover:border-[#0E1A2B] hover:text-[#0E1A2B] disabled:opacity-40"
                >
                  {vat.state === "checking"
                    ? t.shopCompanyFetching
                    : isPolishCompany
                      ? t.shopCompanyFetch
                      : t.shopVatCheck}
                </button>
              </div>
            </label>
          </div>

          {vat.state === "company" ? (
            <p className="mt-5 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm leading-6 text-[#0E1A2B]/75">
              {t.shopCompanyFound}
              {vat.name ? ` — ${vat.name}` : ""}
            </p>
          ) : vat.state === "notfound" ? (
            <p className="mt-5 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-[#0E1A2B]/75">
              {t.shopCompanyNotFound}
            </p>
          ) : vat.state === "ok" ? (
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
              {isPolishCompany ? t.shopCompanyError : t.shopVatError}
            </p>
          ) : !isPolishCompany && canFetchCompany ? (
            <p className="mt-5 text-sm leading-6 text-[#0E1A2B]/50">{t.shopVatIdHint}</p>
          ) : null}
        </section>

        <section className="bg-white p-6 md:p-9">
          <div className="flex items-baseline gap-4">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#0E1A2B]/25">02</span>
            <h2 className={`${shop.display} text-xl md:text-2xl`}>{t.shopDelivery}</h2>
          </div>

          {/* Przy zwykłej paczce nie tłumaczymy się z wagi — klient widzi jedną
              opcję i jej cenę, reszta to szum. Zostają dwa przypadki, w których
              **musi** wiedzieć, że pokazana kwota nie jest końcowa. */}
          {wycena && wycena.rodzaj === "indywidualnie" ? (
            <p className="mt-4 text-sm leading-7 text-[#0E1A2B]/55">
              {wycena.powod === "za-ciezkie" ? (
                <>
                  Przesyłka waży <strong>{(wagaKg as number).toFixed(2).replace(".", ",")} kg</strong> —
                  więcej, niż obejmuje cennik. Koszt transportu ustalimy z Tobą po złożeniu zamówienia.
                </>
              ) : (
                <>
                  Przy części towaru nie mamy podanej wagi, więc koszt transportu ustalimy z Tobą
                  po złożeniu zamówienia.
                </>
              )}
            </p>
          ) : null}

          <div className="mt-7 space-y-3">
            {widoczneOpcje.map((option) => (
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
                  <span className="font-medium">{nazwaDlaKlienta(option.name)}</span>
                </span>

                <strong className="font-semibold">
                  {option.amount ? formatPrice(option.amount) : t.shopFree}
                </strong>
              </label>
            ))}

            {doPaczkomatu ? (
              <PaczkomatPicker
                wybrany={paczkomat.kod}
                miasto={form.city}
                kodPocztowy={form.postalCode}
                onWybor={(punkt) =>
                  setPaczkomat(
                    punkt
                      ? { kod: punkt.kod, opis: `${punkt.ulica}, ${punkt.kod_pocztowy} ${punkt.miasto}` }
                      : { kod: "", opis: "" }
                  )
                }
              />
            ) : null}

            {!widoczneOpcje.length ? (
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
                  ["payu", t.payOnlineLabel, t.payOnlineLead],
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

          {/* Drugi przycisk, pod wyborem płatności. Pierwszy stoi w podsumowaniu
              po prawej, a na telefonie podsumowanie ląduje pod całym formularzem
              — po wybraniu płatności nie ma wtedy nic, co mówi „to już koniec".
              Ten sam `type="submit"`, więc oba wysyłają ten sam formularz. */}
          <button
            type="submit"
            disabled={status === "sending"}
            className={`${shop.btnPrimary} mt-8 w-full disabled:opacity-60 md:w-auto md:px-12`}
          >
            {status === "sending" ? t.shopOrderSending : t.shopPlaceOrder}
          </button>
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
