// Migawka koszyka dla podglądu w narzędziach.
//
// Wysyłana po przerwie w klikaniu, nie po każdej zmianie ilości — inaczej
// przy przytrzymanym „+" poszłoby dwadzieścia zapytań.

const ZWLOKA_MS = 2000

let licznik: ReturnType<typeof setTimeout> | null = null
let ostatniOdcisk = ""

type Migawka = {
  cartId: string
  pozycje: string
  sztuk: number
  wartosc: number
  etap?: "koszyk" | "zamowienie" | "zlozone"
  email?: string
}

function wyslij(migawka: Migawka) {
  fetch("/api/koszyk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(migawka),
    keepalive: true,
  }).catch(() => {})
}

export function zglosKoszyk(migawka: Migawka) {
  if (typeof window === "undefined" || !migawka.cartId) return

  const odcisk = JSON.stringify(migawka)
  if (odcisk === ostatniOdcisk) return

  if (licznik) clearTimeout(licznik)

  // Złożone zamówienie idzie od razu: zaraz po nim przeglądarka odjeżdża do
  // PayU albo na stronę podziękowania i odliczanie by nie doszło do końca.
  if (migawka.etap === "zlozone") {
    ostatniOdcisk = odcisk
    wyslij(migawka)
    return
  }

  licznik = setTimeout(() => {
    ostatniOdcisk = odcisk
    wyslij(migawka)
  }, ZWLOKA_MS)
}
