"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { zglosSzukanie } from "@/lib/zglos-szukanie"

export type SearchableModel = {
  name: string
  slug: string
  brandName?: string
  image?: string
}

type ModelSearchProps = {
  models: SearchableModel[]
  basePath?: string
  placeholder?: string
  emptyLabel?: string
}

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
}

// Wyszukiwarka modeli w nagłówku — filtruje listę po nazwie i marce,
// podpowiedzi otwierają stronę modelu.
export default function ModelSearch({
  models,
  basePath = "/modele",
  placeholder = "Szukaj modelu…",
  emptyLabel = "Brak modeli pasujących do zapytania",
}: ModelSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const needle = normalize(query).trim()
    if (needle.length < 2) return []

    const words = needle.split(/\s+/)

    return models
      .filter((model) => {
        const haystack = normalize(`${model.brandName || ""} ${model.name}`)
        return words.every((word) => haystack.includes(word))
      })
      .slice(0, 8)
  }, [models, query])

  // Statystyka wyszukiwań — co ludzie wpisują i ile im się pokazało.
  // Zgłaszamy dopiero po przerwie w pisaniu, patrz `zglos-szukanie.ts`.
  useEffect(() => {
    zglosSzukanie(query, "lodzie", results.length)
  }, [query, results.length])

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  useEffect(() => {
    setActive(0)
  }, [query])

  function go(slug: string) {
    window.location.href = `${basePath}/${slug}`
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false)
      return
    }

    if (!results.length) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((current) => (current + 1) % results.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      go(results[active].slug)
    }
  }

  const showPanel = open && normalize(query).trim().length >= 2

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-md border border-[#111827]/12 bg-[#f6f5f2] px-4 py-2.5 text-sm outline-none transition focus:border-[#2E64A8] focus:bg-white"
      />

      {showPanel ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-lg">
          {results.length ? (
            results.map((model, index) => (
              <button
                key={model.slug}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(model.slug)}
                className={`flex w-full items-center gap-3 border-t border-[#111827]/8 px-3 py-2.5 text-left transition first:border-t-0 ${
                  index === active ? "bg-[#f6f5f2]" : "bg-white"
                }`}
              >
                <span className="h-10 w-14 shrink-0 overflow-hidden rounded bg-[#ddd7ca]">
                  {model.image ? (
                    <img src={model.image} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{model.name}</span>
                  {model.brandName ? (
                    <span className="block truncate text-xs text-[#111827]/45">
                      {model.brandName}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-[#111827]/45">{emptyLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
