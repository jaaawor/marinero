// Zgłoszenie frazy do statystyki wyszukiwań.
//
// Wywoływane z przeglądarki, po tym jak człowiek **przestanie pisać** — nie po
// każdym znaku. Inaczej „nordkapp" zapisałoby się osiem razy, jako „n", „no",
// „nor" i tak dalej, a w statystyce zostałyby same prefiksy.

const ZWLOKA_MS = 1200

let licznik: ReturnType<typeof setTimeout> | null = null
let ostatnia = ""

export function zglosSzukanie(fraza: string, gdzie: "lodzie" | "sklep", wynikow: number) {
  if (typeof window === "undefined") return

  const tekst = fraza.trim()
  if (tekst.length < 3) return

  if (licznik) clearTimeout(licznik)
  licznik = setTimeout(() => {
    // Ta sama fraza dwa razy pod rząd to zwykle powrót do wyników, nie nowe
    // zapytanie — nie liczymy jej podwójnie.
    if (tekst === ostatnia) return
    ostatnia = tekst

    // `keepalive`, żeby zgłoszenie doszło także wtedy, gdy ktoś kliknie wynik
    // i strona zacznie się przeładowywać.
    fetch("/api/szukane", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fraza: tekst, gdzie, wynikow }),
      keepalive: true,
    }).catch(() => {})
  }, ZWLOKA_MS)
}
