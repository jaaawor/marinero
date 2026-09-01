import { createHash, randomUUID } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Rozpoznanie powracającego odwiedzającego — na potrzeby liczenia **unikalnych
 * wejść**, a nie śledzenia ludzi.
 *
 * Dwa niezależne sposoby, bo każdy z osobna kłamie:
 *
 * 1. **Ciasteczko** (`marinero_gosc`) — losowy identyfikator, ta sama
 *    przeglądarka rozpoznaje się przez rok. Nie zawiera niczego o osobie, ale
 *    znika po wyczyszczeniu danych i nie ma go w trybie prywatnym.
 * 2. **Odcisk dnia** — skrót z adresu IP i przeglądarki, solony i **zmieniany
 *    co dobę**. Działa bez ciasteczka, ale sklei ze sobą kilka osób siedzących
 *    za jednym łączem w firmie.
 *
 * Adresu IP **nie zapisujemy**. Skrót jest jednokierunkowy i przy zmianie doby
 * przestaje pasować do poprzedniego, więc z zebranych danych nie da się
 * odtworzyć ani adresu, ani ścieżki jednej osoby przez tydzień — a licznik
 * unikalnych wejść wychodzi ten sam. Gdyby kiedyś potrzebny był surowy adres IP
 * (np. do blokowania nadużyć), to osobna decyzja i osobny wpis w polityce
 * prywatności, nie efekt uboczny statystyki.
 */

const CIASTECZKO = "marinero_gosc"
const ROK_W_SEKUNDACH = 365 * 24 * 60 * 60

/** Sól z env. Bez niej odcisk dałoby się odtworzyć, zgadując adresy IP. */
const SOL = process.env.STATYSTYKI_SOL || ""

function adresIp(request: Request): string {
  // Za nginxem prawdziwy adres jest w `x-forwarded-for`; pierwszy wpis to klient.
  const przekazany = request.headers.get("x-forwarded-for") || ""
  return przekazany.split(",")[0].trim() || request.headers.get("x-real-ip") || ""
}

export function odciskDnia(request: Request): string {
  const ip = adresIp(request)
  if (!ip) return ""

  const przegladarka = request.headers.get("user-agent") || ""
  const doba = new Date().toISOString().slice(0, 10)

  return createHash("sha256")
    .update(`${SOL}|${doba}|${ip}|${przegladarka}`)
    .digest("hex")
    .slice(0, 32)
}

/**
 * Identyfikator z ciasteczka; zakłada je, jeśli jeszcze go nie ma.
 *
 * Ciasteczko jest `httpOnly` — do JavaScriptu na stronie nie trafia, więc nie
 * da się go odczytać z zewnątrz ani podłączyć do cudzych skryptów. Jest też
 * pierwszej strony: nikt poza nami go nie widzi.
 */
export async function identyfikatorGoscia(): Promise<string> {
  return (await goscZCiasteczka()).gosc
}

/**
 * To samo, ale mówi jeszcze, **czy przeglądarka odesłała nasze ciasteczko**.
 *
 * Bez tej informacji statystyka kłamała: klient, który ciasteczek nie
 * przechowuje — a tak zachowuje się każdy robot indeksujący — dostawał
 * **nowy identyfikator przy każdej odsłonie** i liczył się za każdym razem
 * jako inna osoba. Na 8976 odsłon wychodziło 8502 „unikalnych" przy zaledwie
 * 1026 różnych odciskach; jeden odcisk miał pod sobą 71 identyfikatorów.
 * Licznik pokazywał więc mniej więcej tyle, ile było odsłon.
 */
export async function goscZCiasteczka(): Promise<{ gosc: string; powracajacy: boolean }> {
  const magazyn = await cookies()
  const istniejacy = magazyn.get(CIASTECZKO)?.value

  if (istniejacy) return { gosc: istniejacy.slice(0, 40), powracajacy: true }

  const nowy = randomUUID()
  try {
    magazyn.set(CIASTECZKO, nowy, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: ROK_W_SEKUNDACH,
    })
  } catch {
    // Ustawienie ciasteczka nie zawsze jest możliwe (np. przy odpowiedzi
    // z pamięci podręcznej) — wtedy zostaje sam odcisk dnia.
  }

  return { gosc: nowy, powracajacy: false }
}

/**
 * Czy to robot.
 *
 * Roboty indeksujące wykonują dziś JavaScript, więc zgłaszają odsłony
 * dokładnie tak jak człowiek — a przy dwóch dobach ruchu robiły większość
 * z 8976 zapisanych odsłon. Rozpoznajemy je po nazwie przeglądarki i **nie
 * zapisujemy ich w ogóle**: statystyka ma odpowiadać na pytanie, co oglądają
 * klienci, a nie ile razy przeszedł tędy Googlebot.
 *
 * Lista jest z natury niepełna i taka zostanie — łapie to, co się przedstawia.
 * Robot podszywający się pod zwykłą przeglądarkę przejdzie, ale takich jest
 * garść, a te z listy to niemal cały ruch maszynowy.
 */
const ROBOTY = [
  "bot", "crawl", "spider", "slurp", "scrap", "curl", "wget", "python-requests",
  "http-client", "headless", "phantomjs", "lighthouse", "pagespeed", "preview",
  "monitor", "uptime", "pingdom", "facebookexternalhit", "embedly", "quora link",
  "whatsapp", "telegram", "skypeuripreview", "vkshare", "semrush", "ahrefs",
  "mj12", "dotbot", "petalbot", "bytespider", "gptbot", "claudebot", "ccbot",
  "perplexity", "applebot", "yandex", "baidu", "sogou", "exabot", "seekport",
  "dataprovider", "serpstat", "screaming frog", "netcraft", "censys", "zgrab",
]

export function toRobot(request: Request): boolean {
  const przegladarka = (request.headers.get("user-agent") || "").toLowerCase()

  // Brak nazwy przeglądarki to nie człowiek: każda prawdziwa ją podaje.
  if (!przegladarka) return true

  return ROBOTY.some((slowo) => przegladarka.includes(slowo))
}

/** Adres IP klienta — do ustalenia kraju. Nigdzie go nie zapisujemy. */
export function adresKlienta(request: Request): string {
  return adresIp(request)
}
