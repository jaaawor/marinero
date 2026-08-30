// Ślad po pracy w konfiguratorze — po to, żeby wiedzieć, które łodzie ludzie
// składają, a potem porzucają.
//
// Sama liczba wysłanych ofert tego nie powie: oferta, która nie doszła do
// wysyłki, nie zostawia po sobie nic, a to właśnie ona jest ciekawa. Ktoś
// spędził kwadrans na konfiguracji Nordkappa 830 i się rozmyślił — do takiego
// modelu warto zadzwonić, poprawić opis albo sprawdzić, czy cena nie odstaje.
//
// Zapisujemy losowy identyfikator sesji, model i to, co wybrano. Bez adresu IP,
// bez ciasteczka i bez niczego, co wskazuje na osobę.

const ZWLOKA_MS = 2500

let licznik: ReturnType<typeof setTimeout> | null = null
let ostatniOdcisk = ""

/** Identyfikator sesji żyje tyle, co otwarta karta — nie zostaje po nim ślad. */
export function nowaSesjaKonfiguratora(): string {
  if (typeof window === "undefined") return ""
  try {
    return crypto.randomUUID()
  } catch {
    return `s${Date.now()}${Math.random().toString(36).slice(2, 10)}`
  }
}

export type SladKonfiguratora = {
  sesja: string
  modelSlug: string
  modelName: string
  etap: "klikanie" | "dane" | "wyslana"
  opcji: number
  wartosc: number
  waluta: string
}

export function zglosKonfigurator(slad: SladKonfiguratora) {
  if (typeof window === "undefined" || !slad.sesja) return

  const odcisk = JSON.stringify(slad)
  if (odcisk === ostatniOdcisk) return

  if (licznik) clearTimeout(licznik)

  // Zwłoka, bo przy przeklikiwaniu opcji zmiana leci co sekundę. Wysłanie
  // oferty idzie od razu — zaraz po nim strona pokazuje podziękowanie
  // i odliczanie mogłoby nie dojść do końca.
  const natychmiast = slad.etap === "wyslana"

  const wyslij = () => {
    ostatniOdcisk = odcisk
    fetch("/api/konfigurator-slad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slad),
      keepalive: true,
    }).catch(() => {})
  }

  if (natychmiast) {
    wyslij()
    return
  }

  licznik = setTimeout(wyslij, ZWLOKA_MS)
}
