// Kto ma dostęp do których narzędzi w panelu.
//
// Dotąd panel miał jedno wejście: konto z Directusa i wszystko widoczne dla
// każdego, kto się zalogował. Przy jednej osobie to działało; przy sprzedawcy,
// który ma prowadzić zamówienia, ale nie ma powodu wchodzić w cenniki łodzi
// ani w statystyki — już nie.
//
// Konta zakładamy w Directusie (rola „Panel", bez wstępu do samego CMS-a),
// a **wybór modułów siedzi w `panel_ustawienia`**. Nie robimy z tego uprawnień
// Directusa: moduły panelu nie pokrywają się z kolekcjami (jedna zakładka
// czyta Medusę, druga Allegro, trzecia nic nie zapisuje), więc mapowanie
// jednego na drugie byłoby kłamstwem.
//
// **Administrator Directusa ma wszystko.** Tak jest dzisiaj i tak zostaje —
// gdyby główne konto mogło samo sobie odebrać dostęp do zakładki „Konta",
// nie byłoby jak go przywrócić inaczej niż przez bazę.

import { DIRECTUS_URL, currentUser } from "@/lib/admin-auth"
import { pobierzUstawienie, zapiszUstawienie } from "@/lib/panel-ustawienia"
import { KLUCZE_MODULOW } from "@/lib/panel-moduly"

// Lista modułów siedzi w `panel-moduly.ts` — czyta ją też panel w przeglądarce.
export { MODULY, KLUCZE_MODULOW } from "@/lib/panel-moduly"
export type { Modul } from "@/lib/panel-moduly"

export const KLUCZ_DOSTEPU = "dostep-do-modulow"



export type Dostep = {
  id: string
  kto: string
  email: string
  /** Administrator Directusa — widzi wszystko i zakłada konta. */
  glowny: boolean
  moduly: string[]
}

type ZapisDostepu = Record<string, string[]>

/**
 * Czy rola ma uprawnienia administratora.
 *
 * Pytamy **tokenem serwera**, nie tokenem zalogowanego: konto z rolą „Panel"
 * nie ma prawa czytać ról ani polityk, więc samo o siebie zapytać nie może.
 * Wynik trzymamy chwilę w pamięci — role zmieniają się raz na rok, a to
 * pytanie idzie przy każdym wejściu na stronę panelu.
 */
const roleAdmina = new Map<string, { kiedy: number; admin: boolean }>()

async function rolaJestAdminem(rola: string): Promise<boolean> {
  if (!rola) return false

  const zapis = roleAdmina.get(rola)
  if (zapis && Date.now() - zapis.kiedy < 300_000) return zapis.admin

  const token = process.env.DIRECTUS_ADMIN_TOKEN || ""

  // Gdy nie mamy jak sprawdzić roli — brak tokenu serwera albo milczący
  // Directus — **przepuszczamy wszystko**, czyli wracamy do zachowania sprzed
  // podziału na moduły. Pomyłka w drugą stronę zamknęłaby właściciela przed
  // własnym panelem, razem z jedyną zakładką, z której da się to odkręcić,
  // i odratować dałoby się to tylko wpisem w bazie. Podział na moduły jest
  // wygodą w zespole, a nie zaporą przed obcymi — do panelu i tak wchodzi się
  // kontem z Directusa.
  if (!token) return true

  try {
    const odpowiedz = await fetch(
      `${DIRECTUS_URL}/roles/${rola}?fields=policies.policy.admin_access`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    )
    if (!odpowiedz.ok) return true

    const polityki = (await odpowiedz.json())?.data?.policies || []
    const admin = polityki.some((wpis: any) => wpis?.policy?.admin_access)

    roleAdmina.set(rola, { kiedy: Date.now(), admin })
    return admin
  } catch {
    return true
  }
}

/** Kto jest zalogowany i co wolno mu otworzyć. */
export async function dostepZalogowanego(token: string): Promise<Dostep | null> {
  const uzytkownik = await currentUser(token).catch(() => null)
  if (!uzytkownik?.id) return null

  const kto =
    [uzytkownik.first_name, uzytkownik.last_name].filter(Boolean).join(" ") ||
    uzytkownik.email ||
    ""

  const glowny = await rolaJestAdminem(String(uzytkownik.role || ""))
  if (glowny) {
    return { id: uzytkownik.id, kto, email: uzytkownik.email || "", glowny: true, moduly: KLUCZE_MODULOW }
  }

  const zapis = (await pobierzUstawienie<ZapisDostepu>(KLUCZ_DOSTEPU)) || {}
  const przypisane = Array.isArray(zapis[uzytkownik.id]) ? zapis[uzytkownik.id] : []

  return {
    id: uzytkownik.id,
    kto,
    email: uzytkownik.email || "",
    glowny: false,
    moduly: przypisane.filter((klucz) => KLUCZE_MODULOW.includes(klucz)),
  }
}

export async function pobierzPrzypisania(): Promise<ZapisDostepu> {
  return (await pobierzUstawienie<ZapisDostepu>(KLUCZ_DOSTEPU)) || {}
}

export async function zapiszPrzypisania(zapis: ZapisDostepu): Promise<boolean> {
  const czysty: ZapisDostepu = {}
  for (const [id, moduly] of Object.entries(zapis)) {
    czysty[id] = (Array.isArray(moduly) ? moduly : []).filter((klucz) =>
      KLUCZE_MODULOW.includes(klucz)
    )
  }
  return zapiszUstawienie(KLUCZ_DOSTEPU, czysty)
}
