// Zgłoszenie odsłony strony do własnej statystyki.
//
// To nie zastępuje Google Analytics — GA4 mierzy ruch, ścieżki i kampanie.
// Tu chodzi o jedno konkretne pytanie, które sprzedawca zadaje codziennie:
// **które łodzie i które produkty ludzie oglądają najczęściej**. Odpowiedź
// stoi w tych samych narzędziach co wyszukiwania i koszyki, bez logowania
// się do Google i bez wybierania z dwudziestu raportów.
//
// Nie zapisujemy adresu IP, nie stawiamy ciasteczka i nie da się z tego
// odtworzyć ścieżki jednej osoby — liczymy odsłony, nie ludzi.

export type Dzial = "lodzie" | "sklep"

/** Ostatnio zgłoszony adres — Next przy nawigacji potrafi wywołać efekt dwa razy. */
let ostatnia = ""

export function zglosOdslone(sciezka: string, dzial: Dzial) {
  if (typeof window === "undefined") return

  // Narzędzia wewnętrzne i podglądy nie są ruchem klientów.
  if (sciezka.startsWith("/narzedzia-") || sciezka.startsWith("/api/")) return

  if (sciezka === ostatnia) return
  ostatnia = sciezka

  // Skąd przyszedł odwiedzający — sama domena, bez adresu podstrony i bez
  // parametrów. Wejścia z naszej własnej strony to zwykłe klikanie po serwisie
  // i nie mówią niczego, więc je pomijamy.
  let skad = ""
  try {
    const odsylacz = document.referrer
    if (odsylacz) {
      const host = new URL(odsylacz).hostname
      if (host && host !== window.location.hostname) skad = host
    }
  } catch {
    skad = ""
  }

  fetch("/api/odslona", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sciezka,
      gdzie: dzial,
      tytul: document.title,
      jezyk: document.documentElement.lang || "pl",
      skad,
    }),
    keepalive: true,
  }).catch(() => {})
}
