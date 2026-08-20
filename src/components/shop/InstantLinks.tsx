"use client"

import { useTransition } from "react"
import type { MouseEvent, ReactNode } from "react"
import { useRouter } from "next/navigation"

type InstantLinksProps = {
  children: ReactNode
  className?: string
  /** Dodatkowe klasy na czas ładowania — np. przygaszenie panelu. */
  pendingClassName?: string
}

// Odnośniki filtrów są zwykłymi `<a href>` — działają bez JS i każdy stan
// filtrów ma własny adres. Ten wrapper przejmuje kliknięcia, gdy JS jest
// dostępny, i przechodzi przez router: lista odświeża się w miejscu, strona
// nie skacze na górę, a panel filtrów nie znika na czas przeładowania.
export default function InstantLinks({
  children,
  className,
  pendingClassName = "opacity-60",
}: InstantLinksProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function go(url: string) {
    startTransition(() => router.push(url, { scroll: false }))
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    // Modyfikatory zostawiamy przeglądarce — otwieranie w nowej karcie ma działać.
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    const anchor = (event.target as HTMLElement | null)?.closest?.(
      "a[href]"
    ) as HTMLAnchorElement | null
    if (!anchor) return

    const href = anchor.getAttribute("href")
    if (!href || href.startsWith("http") || href.startsWith("#") || anchor.target === "_blank") {
      return
    }

    event.preventDefault()
    go(href)
  }

  function onSubmit(event: React.FormEvent<HTMLDivElement>) {
    const form = event.target as HTMLFormElement
    if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() === "post") return

    event.preventDefault()

    const query = new URLSearchParams()
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string" && value.trim()) query.set(key, value.trim())
    })

    const action = form.getAttribute("action") || ""
    const search = query.toString()
    go(search ? `${action}?${search}` : action)
  }

  return (
    <div
      onClickCapture={onClick}
      onSubmitCapture={onSubmit}
      className={`${className || ""} ${pending ? pendingClassName : ""}`.trim()}
    >
      {children}
    </div>
  )
}
