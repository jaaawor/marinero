"use client"

import { FormEvent, useMemo, useState } from "react"
import { DEFAULT_PLN_RATES } from "@/lib/configurator-data"
import { getDictionary, normalizeLocale } from "@/lib/i18n"
import type { BoatConfiguratorData, ConfiguratorOption } from "@/lib/configurator-data"
import type { StandardEquipmentGroup } from "@/lib/standard-equipment-data"

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

  const formatMoney = (value: number) => `${formatNumber(value)} ${currency}`

  const selectedOptions = useMemo(() => {
    if (!config) return []

    const result: ConfiguratorOption[] = []

    for (const group of config.groups) {
      const selectedIds = selectedByGroup[group.id] || []
      for (const option of group.options) {
        if (selectedIds.includes(option.id)) {
          result.push(option)
        }
      }
    }

    return result
  }, [config, selectedByGroup])

  const optionsTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0)
  const netTotal = (config?.basePrice || 0) + optionsTotal
  const rate = Number(String(rateInput).replace(",", ".")) || defaultRate
  const vatRate = config?.vatRate ?? 0.23
  const grossPln = netTotal * (1 + vatRate) * rate

  function toggleOption(groupId: string, optionId: string, type: "checkbox" | "radio") {
    setSelectedByGroup((current) => {
      const currentGroup = current[groupId] || []

      if (type === "radio") {
        return {
          ...current,
          [groupId]: currentGroup.includes(optionId) ? [] : [optionId],
        }
      }

      return {
        ...current,
        [groupId]: currentGroup.includes(optionId)
          ? currentGroup.filter((id) => id !== optionId)
          : [...currentGroup, optionId],
      }
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
            .map((option) => `- ${option.name}: ${formatMoney(option.price)}`)
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
        throw new Error(result.error || "Nie udało się wysłać zapytania.")
      }

      setSubmitStatus("sent")

      if (result.emailStatus === "email_skipped_no_smtp") {
        setSubmitMessage(t.cfgSavedNoSmtp)
      } else {
        setSubmitMessage(t.cfgSavedSent)
      }
    } catch (error: any) {
      setSubmitStatus("error")
      setSubmitMessage(error?.message || "Wystąpił błąd wysyłki.")
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

  return (
    <form onSubmit={submitOffer} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
      <div className="rounded-lg bg-white shadow-sm">
        <section className="border-b border-[#111827]/10 p-5 md:p-6">
          <div className="rounded-lg border border-[#111827]/10 bg-[#fafafa] p-5">
            <h2 className="text-xl font-semibold tracking-tight">
              {t.cfgBaseIncludes}
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#111827]/60">
              {config.basePackageName}
            </p>
          </div>

          {standardEquipment.length ? (
            <details open className="group mt-4 rounded-lg border border-[#111827]/10 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold">
                <span>{t.cfgStandardEquipment}</span>
                <span className="text-sm font-semibold text-[#2E64A8]">
                  <span className="hidden group-open:inline">{t.cfgCollapse}</span>
                  <span className="inline group-open:hidden">{t.cfgExpand}</span>
                </span>
              </summary>

              <div className="border-t border-[#111827]/10 px-5 py-5">
                <div className="grid gap-6 xl:grid-cols-2">
                  {standardEquipment.map((group) => (
                    <div key={group.title}>
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

        <section className="p-6 md:p-8">
          <h2 className="mb-7 text-2xl font-semibold tracking-tight">
            {t.cfgExtraOptions}
          </h2>

          <div className="space-y-9">
            {config.groups.map((group) => {
              const selectedCount = (selectedByGroup[group.id] || []).length

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

                          <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_140px] md:items-start">
                            <p className="text-sm font-medium leading-6 text-[#111827]/85">
                              {option.name}
                            </p>

                            <p className="text-left text-sm font-bold text-[#2E64A8] md:text-right">
                              + {formatMoney(option.price)}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
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
