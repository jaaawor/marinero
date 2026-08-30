"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_PLN_RATES } from "@/lib/configurator-data"
import { getDictionary, normalizeLocale } from "@/lib/i18n"
import OptionPreview from "@/components/OptionPreview"
import type { BoatConfiguratorData, ConfiguratorOption } from "@/lib/configurator-data"
import type { StandardEquipmentGroup } from "@/lib/standard-equipment-data"
import { nowaSesjaKonfiguratora, zglosKonfigurator } from "@/lib/zglos-konfigurator"

type OfferContact = {
  id: string | number
  name: string
}

type BoatConfiguratorProps = {
  modelName: string
  slug: string
  brandName?: string
  config?: BoatConfiguratorData | null
  standardEquipment?: StandardEquipmentGroup[]
  offerContacts?: OfferContact[]
  locale?: string
}

function formatNumber(value: number) {
  const rounded = Math.round(Number(value || 0))
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function formatPln(value: number) {
  return `${formatNumber(value)} PLN`
}

// Osoby podpisujące ofertę pochodzą z kolekcji `team` w panelu admina —
// tutaj tylko awaryjna lista, gdyby Directus nic nie zwrócił.
const FALLBACK_CONTACTS: OfferContact[] = [
  { id: "michal", name: "Michał Jaworski" },
  { id: "marek", name: "Marek Moszczyński" },
]

function collectDefaultSelected(config: BoatConfiguratorData | null | undefined) {
  const selected: Record<string, string[]> = {}

  if (!config) return selected

  for (const group of config.groups) {
    const defaults = group.options.filter((option) => option.selected).map((option) => option.id)
    selected[group.id] = group.type === "radio" ? defaults.slice(0, 1) : defaults
  }

  return selected
}

/**
 * Co z czego się składa.
 *
 * Pakiet wyposażenia (np. Highline) niesie kilkanaście pozycji taniej, niż
 * kosztowałyby z osobna. Żeby nikt nie zapłacił za to samo dwa razy, wiążemy
 * pakiet z jego zawartością po **kodach katalogowych** producenta.
 */
function buildPackages(config: BoatConfiguratorData | null | undefined) {
  /** Pozycja pakietu → gdzie leżą jej składniki. */
  const contents = new Map<string, { groupId: string; optionId: string }[]>()
  /**
   * Składnik → pakiety, które go niosą. Lista, nie pojedyncza wartość: ta sama
   * pozycja bywa i w Highline, i w Highline+, a liczy się ten pakiet, który
   * jest właśnie wybrany.
   */
  const coveredBy = new Map<string, string[]>()
  /** Pakiet → grupa, w której stoi. */
  const groupOfPackage = new Map<string, string>()
  /** Grupa pakietów → pozycja „bez pakietu", do której wracamy. */
  const noPackage = new Map<string, string>()

  if (!config) return { contents, coveredBy, groupOfPackage, noPackage }

  const byCode = new Map<string, { groupId: string; optionId: string }>()
  for (const group of config.groups) {
    for (const option of group.options) {
      if (option.code) byCode.set(option.code, { groupId: group.id, optionId: option.id })
    }
  }

  for (const group of config.groups) {
    for (const option of group.options) {
      if (!option.includes?.length) continue
      groupOfPackage.set(option.id, group.id)
      const items = option.includes
        .map((code) => byCode.get(code))
        .filter(Boolean) as { groupId: string; optionId: string }[]
      contents.set(option.id, items)
      for (const item of items) {
        coveredBy.set(item.optionId, [...(coveredBy.get(item.optionId) || []), option.id])
      }
    }

    // „Tylko wyposażenie standardowe" — pozycja bez składu i bez dopłaty.
    if (group.options.some((option) => option.includes?.length)) {
      const wolna = group.options.find((option) => !option.includes?.length && !option.price)
      if (wolna) noPackage.set(group.id, wolna.id)
    }
  }

  return { contents, coveredBy, groupOfPackage, noPackage }
}

export default function BoatConfigurator({
  modelName,
  slug,
  brandName,
  config,
  standardEquipment = [],
  offerContacts,
  locale = "pl",
}: BoatConfiguratorProps) {
  const t = getDictionary(normalizeLocale(locale))
  const contactOptions = offerContacts?.length ? offerContacts : FALLBACK_CONTACTS
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>(
    collectDefaultSelected(config)
  )
  const currency = config?.currency || "USD"
  const defaultRate = config?.defaultUsdToPln ?? DEFAULT_PLN_RATES[currency] ?? 4.3

  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [preparedBy, setPreparedBy] = useState("")
  const [rateInput, setRateInput] = useState(String(defaultRate))
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [submitMessage, setSubmitMessage] = useState("")

  // Identyfikator tej jednej sesji konfigurowania. Zakładamy go dopiero przy
  // **pierwszej zmianie** opcji, nie przy wejściu na stronę: samo przewinięcie
  // strony modelu obok konfiguratora nie jest jeszcze konfigurowaniem i zalałoby
  // statystykę wierszami bez treści.
  const sesja = useRef("")

  const formatMoney = (value: number) => `${formatNumber(value)} ${currency}`

  const packages = useMemo(() => buildPackages(config), [config])

  /**
   * Wybrany silnik i to, ile go jest.
   *
   * Od tego zależą grupy przypisane do marki silnika (kolor Mercury'ego,
   * kolor Suzuki): pokazują się dopiero po wybraniu silnika i mnożą dopłatę
   * przez liczbę jednostek — przy „2x Mercury…" kolor kosztuje dwa razy tyle.
   * Sama kwota to pokazuje; dopisku „(2 ×)" przy cenie już nie piszemy,
   * bo czytał się jak druga pozycja w ofercie.
   */
  const silnik = useMemo(() => {
    if (!config) return { nazwa: "", sztuk: 1 }

    for (const group of config.groups) {
      if (group.engineBrand || !/silnik/i.test(group.title)) continue
      const wybrane = selectedByGroup[group.id] || []
      const option = group.options.find((item) => wybrane.includes(item.id))
      if (!option) continue
      // „Pre-rigg, Mercury Verado…" i „bez silnika" to przygotowanie pod silnik,
      // a nie silnik — nie ma tam czego malować.
      if (/^\s*(pre-?rigg?|bez\s+silnik)/i.test(option.name)) continue
      const sztuk = /(^|\s)(2\s*[x×]|dwa|twin)/i.test(option.name) ? 2 : 1
      return { nazwa: option.name.toLowerCase(), sztuk }
    }

    return { nazwa: "", sztuk: 1 }
  }, [config, selectedByGroup])

  /** Grupa jest widoczna, jeśli nie zależy od silnika albo silnik się zgadza. */
  const widocznaGrupa = (group: { engineBrand?: string }) =>
    !group.engineBrand || silnik.nazwa.includes(group.engineBrand)

  /** Ile razy liczyć dopłatę w tej grupie. */
  const mnoznik = (group: { engineBrand?: string }) => (group.engineBrand ? silnik.sztuk : 1)

  /** Pozycje, które niesie aktualnie wybrany pakiet — nie liczymy ich osobno. */
  const covered = useMemo(() => {
    const set = new Set<string>()
    for (const [packageId, items] of packages.contents) {
      const groupId = packages.groupOfPackage.get(packageId)
      if (!groupId || !(selectedByGroup[groupId] || []).includes(packageId)) continue
      for (const item of items) set.add(item.optionId)
    }
    return set
  }, [packages, selectedByGroup])

  const selectedOptions = useMemo(() => {
    if (!config) return []

    // `inPackage` idzie do PDF-a: pozycja z pakietu ma tam „w pakiecie"
    // zamiast kwoty, bo w cenie pakietu jest już opłacona.
    const result: (ConfiguratorOption & { inPackage?: boolean })[] = []

    for (const group of config.groups) {
      // Kolor silnika, którego nikt nie wybrał, nie może wejść do wyceny.
      if (!widocznaGrupa(group)) continue
      const selectedIds = selectedByGroup[group.id] || []
      const razy = mnoznik(group)
      for (const option of group.options) {
        if (!selectedIds.includes(option.id)) continue
        if (covered.has(option.id)) result.push({ ...option, price: 0, inPackage: true })
        else if (razy !== 1) result.push({ ...option, price: option.price * razy })
        else result.push(option)
      }
    }

    return result
  }, [config, selectedByGroup, covered, silnik])

  const optionsTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0)
  const netTotal = (config?.basePrice || 0) + optionsTotal
  const rate = Number(String(rateInput).replace(",", ".")) || defaultRate
  const vatRate = config?.vatRate ?? 0.23
  const grossPln = netTotal * (1 + vatRate) * rate

  // Wybory zgłaszamy dopiero, gdy ktoś sam czegoś dotknie — i tylko wtedy,
  // gdy naprawdę coś wybrał. Domyślne zaznaczenia (najtańszy silnik przy
  // łodziach z ceną bazową 0) nie są niczyją decyzją.
  useEffect(() => {
    if (!sesja.current || !config) return

    zglosKonfigurator({
      sesja: sesja.current,
      modelSlug: slug,
      modelName,
      etap: clientEmail.includes("@") || clientName.trim() ? "dane" : "klikanie",
      opcji: selectedOptions.length,
      wartosc: netTotal,
      waluta: currency,
      // Dane z formularza zapisujemy też wtedy, gdy ktoś ich nie wyśle —
      // służą wyłącznie statystyce (ile osób dochodzi do formularza i na czym
      // się zatrzymuje). Nikt na ich podstawie nie jest zaczepiany; podstawa
      // i okres przechowywania stoją w polityce prywatności.
      klientImie: clientName.trim(),
      klientEmail: clientEmail.trim(),
      klientTelefon: clientPhone.trim(),
      uwagi: notes.trim(),
    })
  }, [
    config,
    slug,
    modelName,
    selectedOptions.length,
    netTotal,
    currency,
    clientEmail,
    clientName,
    clientPhone,
    notes,
  ])

  function toggleOption(groupId: string, optionId: string, type: "checkbox" | "radio") {
    if (!sesja.current) sesja.current = nowaSesjaKonfiguratora()

    setSelectedByGroup((current) => {
      const next: Record<string, string[]> = { ...current }
      const currentGroup = current[groupId] || []
      const wasSelected = currentGroup.includes(optionId)

      const dolozZawartosc = (packageId: string) => {
        for (const item of packages.contents.get(packageId) || []) {
          const lista = next[item.groupId] || []
          if (!lista.includes(item.optionId)) next[item.groupId] = [...lista, item.optionId]
        }
      }

      const zdejmijZawartosc = (packageId: string) => {
        for (const item of packages.contents.get(packageId) || []) {
          next[item.groupId] = (next[item.groupId] || []).filter((id) => id !== item.optionId)
        }
      }

      // Ktoś ręcznie odznacza pozycję, którą niósł pakiet. Pakiet przestaje
      // obowiązywać — kalkulacja wraca do stanu bez pakietu, a pozostałe
      // pozycje zostają zaznaczone i liczą się normalnie.
      const czynnyPakiet = wasSelected
        ? (packages.coveredBy.get(optionId) || []).find((id) => {
            const grupa = packages.groupOfPackage.get(id)
            return grupa ? (current[grupa] || []).includes(id) : false
          })
        : undefined
      const packageGroupId = czynnyPakiet ? packages.groupOfPackage.get(czynnyPakiet) : undefined
      if (czynnyPakiet && packageGroupId) {
        const bezPakietu = packages.noPackage.get(packageGroupId)
        next[packageGroupId] = bezPakietu ? [bezPakietu] : []
        next[groupId] = (next[groupId] || []).filter((id) => id !== optionId)
        return next
      }

      if (type === "radio") {
        next[groupId] = wasSelected ? [] : [optionId]
      } else {
        next[groupId] = wasSelected
          ? currentGroup.filter((id) => id !== optionId)
          : [...currentGroup, optionId]
      }

      // Zmiana pakietu: zdejmij zawartość poprzedniego, dołóż nowego.
      for (const previous of currentGroup) {
        if (previous !== optionId && packages.contents.has(previous)) zdejmijZawartosc(previous)
      }
      if (packages.contents.has(optionId)) {
        if ((next[groupId] || []).includes(optionId)) dolozZawartosc(optionId)
        else zdejmijZawartosc(optionId)
      }

      return next
    })
  }

  async function submitOffer(event: FormEvent) {
    event.preventDefault()

    if (!clientEmail.trim()) {
      setSubmitStatus("error")
      setSubmitMessage(t.cfgMissingEmail)
      return
    }

    setSubmitStatus("sending")
    setSubmitMessage(t.cfgSending)

    const preparedByLabel = contactOptions.find(
      (contact) => String(contact.id) === preparedBy
    )?.name

    const summary = [
      `Model: ${modelName}`,
      brandName ? `Marka: ${brandName}` : "",
      preparedByLabel ? `Ofertę przygotowuje: ${preparedByLabel}` : "",
      `Cena bazowa netto: ${formatMoney(config?.basePrice || 0)}`,
      `Wyposażenie dodatkowe netto: ${formatMoney(optionsTotal)}`,
      `Razem netto: ${formatMoney(netTotal)}`,
      `Razem brutto PLN (VAT 23%): ${formatPln(grossPln)}`,
      selectedOptions.length
        ? `Wybrane opcje:\n${selectedOptions
            .map(
              (option) =>
                `- ${option.name}: ${
                  covered.has(option.id) ? "w pakiecie" : formatMoney(option.price)
                }`
            )
            .join("\n")}`
        : "Wybrane opcje: brak",
    ]
      .filter(Boolean)
      .join("\n")

    try {
      const response = await fetch("/api/configurator/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelSlug: slug,
          modelName,
          brandName,
          clientName,
          clientEmail,
          clientPhone,
          notes,
          preparedBy,
          currency,
          basePrice: config?.basePrice || 0,
          optionsTotal,
          netTotal,
          grossPln,
          usdToPln: rate,
          vatRate,
          selectedOptions,
          standardEquipment,
          summary,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error || t.quoteSendError)
      }

      setSubmitStatus("sent")

      // Domykamy sesję: ta konfiguracja doszła do końca i nie jest porzucona.
      zglosKonfigurator({
        sesja: sesja.current,
        modelSlug: slug,
        modelName,
        etap: "wyslana",
        opcji: selectedOptions.length,
        wartosc: netTotal,
        waluta: currency,
        klientImie: clientName.trim(),
        klientEmail: clientEmail.trim(),
        klientTelefon: clientPhone.trim(),
        uwagi: notes.trim(),
      })

      if (result.emailStatus === "email_skipped_no_smtp") {
        setSubmitMessage(t.cfgSavedNoSmtp)
      } else {
        setSubmitMessage(t.cfgSavedSent)
      }
    } catch (error: any) {
      setSubmitStatus("error")
      setSubmitMessage(error?.message || t.quoteSendError)
    }
  }

  if (!config) {
    return (
      <div className="rounded-lg bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold">{t.cfgUnavailable}</h2>
        <p className="mt-3 text-[#111827]/55">
          {t.cfgUnavailableLead}
        </p>
      </div>
    )
  }

  const showsBaseIncludes = Boolean(config.showBaseIncludes && config.basePackageName)

  return (
    <form onSubmit={submitOffer} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
      <div className="rounded-lg bg-white shadow-sm">
        {/* Cała sekcja tylko wtedy, gdy jest w niej cokolwiek — bez tego
            przy wyłączonym opisie i pustym wyposażeniu zostawał sam pasek
            marginesu z kreską. */}
        {showsBaseIncludes || standardEquipment.length ? (
        <section className="border-b border-[#111827]/10 p-5 md:p-6">
          {/* Przy większości łodzi ten opis mówił tylko „wyposażenie
              standardowe wymienione poniżej" — czyli powtarzał sekcję stojącą
              tuż pod nim. Pokazujemy go tam, gdzie naprawdę coś wnosi. */}
          {showsBaseIncludes ? (
            <div className="rounded-lg border border-[#111827]/10 bg-[#fafafa] p-5">
              <h2 className="text-xl font-semibold tracking-tight">
                {t.cfgBaseIncludes}
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#111827]/60">
                {config.basePackageName}
              </p>
            </div>
          ) : null}

          {standardEquipment.length ? (
            <details
              open
              className={`group rounded-lg border border-[#111827]/10 bg-white ${
                showsBaseIncludes ? "mt-4" : ""
              }`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold">
                <span>{t.cfgStandardEquipment}</span>
                <span className="text-sm font-semibold text-[#2E64A8]">
                  <span className="hidden group-open:inline">{t.cfgCollapse}</span>
                  <span className="inline group-open:hidden">{t.cfgExpand}</span>
                </span>
              </summary>

              <div className="border-t border-[#111827]/10 px-5 py-5">
                {/* Kolumny CSS, nie siatka: sekcje mają bardzo różną długość
                    („Kokpit" dwie pozycje, „Sterówka" siedemnaście), a w siatce
                    każdy rząd jest wysoki jak najwyższa komórka — obok krótkiej
                    sekcji zostawała pusta połowa ekranu. `break-inside-avoid`
                    pilnuje, żeby sekcja nie pękła w połowie na granicy kolumn. */}
                <div className="xl:columns-2 xl:gap-10">
                  {standardEquipment.map((group) => (
                    <div key={group.title} className="mb-6 break-inside-avoid last:mb-0">
                      <h3 className="mb-3 text-sm font-semibold text-[#111827]/80">
                        {group.title}
                      </h3>

                      <ul className="space-y-2 text-sm leading-6 text-[#111827]/60">
                        {group.items.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="text-[#2E64A8]">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ) : null}
        </section>
        ) : null}

        <section className="p-6 md:p-8">
          <h2 className="mb-7 text-2xl font-semibold tracking-tight">
            {t.cfgExtraOptions}
          </h2>

          <div className="space-y-9">
            {config.groups.map((group) => {
              if (!widocznaGrupa(group)) return null
              const selectedCount = (selectedByGroup[group.id] || []).length
              const razy = mnoznik(group)

              return (
                <section key={group.id} className="border-t border-[#111827]/10 pt-6 first:border-t-0 first:pt-0">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-xl font-semibold tracking-tight">
                      {group.title}
                    </h3>

                    {selectedCount ? (
                      <span className="w-fit rounded-full bg-[#2E64A8]/10 px-3 py-1 text-xs font-semibold text-[#2E64A8]">
                        {selectedCount} {t.cfgSelected}
                      </span>
                    ) : null}
                  </div>

                  {group.layout === "kafelki" || group.layout === "kafelki-szer" ||
                   group.layout === "kafelki-pion" ? (
                    // Kafelki tam, gdzie liczy się wygląd — kolory kadłuba
                    // i tapicerki. Trzy w rzędzie, nie cztery: kadr jest
                    // poziomy, więc węższa kolumna spłaszczyłaby zdjęcie
                    // do paska.
                    //
                    // Trzy proporcje, bo trzy różne rzeczy pokazujemy:
                    // render całej łodzi jest bardzo szeroki (927 × 406 px
                    // u XO), próbka tapicerki prawie kwadratowa, a silnik
                    // wyższy niż szerszy. W jednym kadrze 16/9 renderowi
                    // ucinało dziób i rufę.
                    <div
                      className={`grid gap-3 ${
                        group.layout === "kafelki-pion"
                          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                          : group.layout === "kafelki-szer"
                            ? "sm:grid-cols-2"
                            : "sm:grid-cols-2 lg:grid-cols-3"
                      }`}
                    >
                      {group.options.map((option) => {
                        const selected = (selectedByGroup[group.id] || []).includes(option.id)

                        return (
                          <label
                            key={option.id}
                            className={`group/tile cursor-pointer overflow-hidden rounded-lg border transition ${
                              selected
                                ? "border-[#2E64A8] ring-1 ring-[#2E64A8]"
                                : "border-[#111827]/10 hover:border-[#111827]/30"
                            }`}
                          >
                            <input
                              type={group.type}
                              name={group.id}
                              checked={selected}
                              onChange={() => toggleOption(group.id, option.id, group.type)}
                              className="sr-only"
                            />

                            {option.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={option.image}
                                alt={option.name}
                                loading="lazy"
                                // Silniki to pakshoty na białym tle: `contain`,
                                // żeby kadr pionowy nie ucinał stopy ani pokrywy.
                                className={`w-full ${
                                  group.layout === "kafelki-pion"
                                    ? "aspect-[3/4] bg-white object-contain p-2"
                                    : group.layout === "kafelki-szer"
                                      ? "aspect-[21/9] bg-black object-contain"
                                      : "aspect-[16/9] object-cover"
                                }`}
                              />
                            ) : (
                              // Producent nie dosyła renderu do każdego wariantu
                              // (XO Grey nie ma go w żadnym skoroszycie), a sama
                              // próbka koloru obok dwóch zdjęć łodzi wygląda jak
                              // dziura w rzędzie. Podpis mówi, że tak ma być.
                              <div
                                className={`flex w-full items-end justify-center ${
                                  group.layout === "kafelki-pion"
                                    ? "aspect-[3/4]"
                                    : group.layout === "kafelki-szer"
                                      ? "aspect-[21/9]"
                                      : "aspect-[16/9]"
                                }`}
                                style={{ backgroundColor: option.color || "#f6f5f2" }}
                              >
                                <span
                                  className="mb-2 rounded-full bg-white/85 px-2.5 py-1 text-[11px]
                                             font-medium text-[#111827]/70"
                                >
                                  {t.cfgSwatchOnly}
                                </span>
                              </div>
                            )}

                            {/* Cena POD nazwą, nie obok. Nazwy kolorów bywają
                                zdaniem („XO Classic (Kadłub oklejony czarną
                                folią karbonową…)"), a przy cenie z boku
                                spadały do wąskiej kolumny na osiem wierszy. */}
                            <div className="bg-white px-3 py-2.5">
                              <span
                                title={option.name}
                                className={`block text-xs font-medium leading-5 text-[#111827]/85 ${
                                  group.layout === "kafelki-pion"
                                    ? "line-clamp-2"
                                    : "line-clamp-3 min-h-[3.75rem]"
                                }`}
                              >
                                {option.name}
                              </span>
                              <span className="mt-1 block text-xs font-bold text-[#2E64A8]">
                                {covered.has(option.id)
                                  ? t.cfgInPackage
                                  : `+ ${formatMoney(option.price * razy)}`}
                              </span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                  <div className="overflow-hidden rounded-lg border border-[#111827]/10">
                    {group.options.map((option, index) => {
                      const selected = (selectedByGroup[group.id] || []).includes(option.id)

                      return (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer items-start gap-4 border-t border-[#111827]/10 px-4 py-3 transition first:border-t-0 md:px-5 ${
                            selected
                              ? "bg-[#2E64A8]/6"
                              : index % 2 === 0
                                ? "bg-white hover:bg-[#f6f5f2]"
                                : "bg-[#fbfaf8] hover:bg-[#f6f5f2]"
                          }`}
                        >
                          <input
                            type={group.type}
                            name={group.id}
                            checked={selected}
                            onChange={() => toggleOption(group.id, option.id, group.type)}
                            className="mt-1 shrink-0"
                          />

                          <OptionPreview
                            name={option.name}
                            color={option.color}
                            image={option.image}
                            description={option.description}
                          />

                          <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_140px] md:items-start">
                            <p className="text-sm font-medium leading-6 text-[#111827]/85">
                              {option.name}
                            </p>

                            {/* Pozycja z pakietu ma cenę w pakiecie, nie obok —
                                pokazanie dopłaty sugerowałoby, że dolicza się
                                drugi raz. */}
                            <p className="text-left text-sm font-bold md:text-right">
                              {covered.has(option.id) ? (
                                <span className="text-[#047857]">{t.cfgInPackage}</span>
                              ) : (
                                <span className="text-[#2E64A8]">
                                  + {formatMoney(option.price * razy)}
                                </span>
                              )}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  )}
                </section>
              )
            })}
          </div>
        </section>

        <section className="border-t border-[#111827]/10 p-6 md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t.cfgContactData}
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder={t.cfgName}
              className="rounded-md border border-[#111827]/15 px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"
            />

            <input
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              placeholder={t.cfgEmail}
              className="rounded-md border border-[#111827]/15 px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"
            />

            <input
              value={clientPhone}
              onChange={(event) => setClientPhone(event.target.value)}
              placeholder={t.cfgPhone}
              className="rounded-md border border-[#111827]/15 px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"
            />

            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t.cfgNotes}
              className="rounded-md border border-[#111827]/15 px-4 py-3 text-sm outline-none focus:border-[#2E64A8]"
            />
          </div>

          {/* Opcja dealerska — docelowo widoczna tylko po zalogowaniu.
              Dane osób edytuje się w panelu admina (kolekcja „team"). */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#111827]/10 pt-5 text-xs text-[#111827]/40">
            <label htmlFor="prepared-by" className="font-semibold uppercase tracking-[0.18em]">
              {t.cfgPreparedBy}
            </label>

            <select
              id="prepared-by"
              value={preparedBy}
              onChange={(event) => setPreparedBy(event.target.value)}
              className="rounded-md border border-[#111827]/12 bg-white px-3 py-2 text-xs text-[#111827]/60 outline-none focus:border-[#2E64A8]"
            >
              <option value="">{t.cfgTeam}</option>
              {contactOptions.map((contact) => (
                <option key={contact.id} value={String(contact.id)}>
                  {contact.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-lg bg-white p-5 shadow-sm md:p-6 lg:sticky lg:top-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t.cfgCalculator}
        </h2>

        <p className="mt-1 text-sm text-[#111827]/45">{modelName}</p>

        <div className="mt-5 space-y-3 text-sm">
          {config.basePrice ? (
            <div className="flex justify-between gap-4 rounded-lg bg-[#f6f5f2] p-3">
              <span className="text-[#111827]/50">{t.cfgBasePrice}</span>
              <strong>{formatMoney(config.basePrice)}</strong>
            </div>
          ) : null}

          <div className="flex justify-between gap-4 rounded-lg bg-[#f6f5f2] p-3">
            <span className="text-[#111827]/50">{t.cfgOptions}</span>
            <strong>{formatMoney(optionsTotal)}</strong>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg bg-[#f6f5f2] p-3">
            <span className="text-[#111827]/50">{t.cfgNetTotal}</span>
            <strong className="text-base">{formatMoney(netTotal)}</strong>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f6f5f2] p-3">
            <label className="shrink-0 text-[#111827]/50">{t.cfgRate} {currency}/PLN</label>
            <input
              value={rateInput}
              onChange={(event) => setRateInput(event.target.value)}
              className="w-24 rounded-md border border-[#111827]/15 px-3 py-2 text-right text-sm outline-none focus:border-[#2E64A8]"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg bg-[#f6f5f2] p-3">
            <span className="text-[#111827]/50">{t.cfgGrossPln}</span>
            <strong className="text-base">{formatPln(grossPln)}</strong>
          </div>

          <div className="rounded-lg bg-[#f6f5f2] p-3">
            <p className="text-[#111827]/50">{t.cfgChosenOptions}</p>

            {selectedOptions.length ? (
              <ul className="mt-3 max-h-[190px] space-y-2 overflow-auto pr-1 text-xs leading-5">
                {selectedOptions.map((option) => (
                  <li key={option.id}>
                    • {option.name} <strong>+ {formatMoney(option.price)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 font-semibold">{t.cfgNoOptions}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitStatus === "sending"}
          className="mt-5 inline-flex w-full justify-center rounded-md bg-[#2E64A8] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitStatus === "sending" ? t.cfgSending : t.cfgSubmit}
        </button>

        {submitMessage ? (
          <p
            className={`mt-4 text-sm leading-5 ${
              submitStatus === "error" ? "text-red-600" : "text-[#111827]/55"
            }`}
          >
            {submitMessage}
          </p>
        ) : null}
      </aside>
    </form>
  )
}
