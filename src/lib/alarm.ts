// Powiadomienie do zespołu, gdy coś **przestało działać po cichu**.
//
// Konfigurator uczy nas tego na własnej skórze: przez dobę wszystkie 56 łodzi
// liczyło z zapasowego cennika w repozytorium, bo Directus odbijał zapytanie
// o nieistniejące pole. Strona wyglądała normalnie, kalkulator liczył, oferty
// wychodziły — tylko z niewłaściwych cen. Zauważył to klient, nie my.
//
// Dlatego awaria, po której **strona dalej wygląda dobrze**, ma dojść mailem.
// Nie chodzi o każdy błąd — chodzi o te, które nie mają innego objawu.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require("nodemailer")

/**
 * Kiedy ostatnio poszedł alarm danego rodzaju — **w pamięci procesu**.
 *
 * Nie w Directusie ani w Medusie: alarm dotyczy właśnie tego, że któraś z nich
 * nie odpowiada, więc zapisywanie tam stanu byłoby liczeniem na coś, co się
 * właśnie zepsuło. Po restarcie usługi pamięć znika i pierwszy alarm idzie od
 * nowa — i dobrze, bo świeży proces to nowy stan rzeczy.
 */
const ostatnie = new Map<string, number>()

/** Raz na godzinę na rodzaj awarii. Strona renderuje się setki razy na minutę. */
const ODSTEP_MS = 60 * 60 * 1000

function smtpJest(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

/**
 * Zgłasza awarię, która nie widać na stronie.
 *
 * `klucz` grupuje powtórzenia (np. `konfigurator-zapas`), `tytul` i `tresc`
 * idą do maila. Funkcja **nigdy nie rzuca** — powiadomienie o awarii nie może
 * być następną awarią; przy braku SMTP zostaje sam wpis w `journalctl`.
 */
export async function zglosAwarie(klucz: string, tytul: string, tresc: string): Promise<void> {
  const teraz = Date.now()
  const poprzednio = ostatnie.get(klucz) || 0
  if (teraz - poprzednio < ODSTEP_MS) return
  ostatnie.set(klucz, teraz)

  // Log leci zawsze — nawet gdy poczta nie działa, zostaje ślad w journalctl.
  console.error(`[ALARM ${klucz}] ${tytul} — ${tresc}`)

  const doKogo = process.env.MAIL_ALARM || process.env.MAIL_TO
  if (!smtpJest() || !doKogo) return

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: doKogo,
      subject: `marinero.pl — ${tytul}`,
      text:
        `${tresc}\n\n` +
        `Kiedy: ${new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}\n` +
        `Rodzaj: ${klucz}\n\n` +
        "Ten list wychodzi najwyżej raz na godzinę na jeden rodzaj awarii.\n" +
        "Szczegóły: journalctl -u marinero-frontend --since \"1 hour ago\" | grep ALARM",
    })
  } catch (problem: any) {
    console.error(`[ALARM ${klucz}] nie udało się wysłać maila: ${problem?.message || problem}`)
  }
}
