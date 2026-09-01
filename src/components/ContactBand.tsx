import { getTeamPublic } from "@/lib/public-site-data"
import { getDictionary, normalizeLocale, type Dict } from "@/lib/i18n"

// Kolejność działów w banerze. Kto do którego należy, ustawia się
// w Directusie (`team.department`); brak wpisu = sprzedaż.
function departments(t: Dict) {
  return [
    { key: "sprzedaz", label: t.deptSales },
    { key: "sklep", label: t.deptShop },
    { key: "serwis", label: t.deptService },
  ]
}

type ContactBandProps = {
  settings?: any
  locale?: string
  /** Bez ramek dookoła — w stopce sekcje rozdzielają linie samej stopki. */
  bare?: boolean
}

/**
 * Facebook + mapa + kontakty do ludzi. Ten sam blok stoi w stopce i na stronie
 * kontaktu — wcześniej „kontakt" miał trzy puste kafelki i ani jednego numeru,
 * a wszystkie telefony były dopiero na samym dole strony.
 */
export default async function ContactBand({ settings, locale = "pl", bare }: ContactBandProps) {
  const current = normalizeLocale(locale)
  const t = getDictionary(current)

  const facebookUrl = settings?.facebook_url || "https://www.facebook.com/marineropl"
  const mapQuery = settings?.map_query || settings?.address || ""

  // Cały zespół, nie tylko osoby przygotowujące oferty — ma tu być też
  // sklep i serwis.
  const contacts = await getTeamPublic(false).catch(() => [])

  const wrap = (children: React.ReactNode, key: string) =>
    bare ? (
      <div key={key} className="border-b border-[#111827]/10">
        <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8">{children}</div>
      </div>
    ) : (
      <div key={key} className="mb-4 rounded-lg border border-[#111827]/10 bg-white p-6 shadow-sm md:p-8">
        {children}
      </div>
    )

  return (
    <>
      {wrap(
        <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-12">
          <div>
            <h3 className="font-semibold">{t.footerFollow}</h3>

            {/* Wtyczka Facebooka renderuje się w stałej szerokości podanej
                w adresie — bez `max-w` ramka na telefonie zostawiała pustą
                kolumnę obok wpisów. Nagłówek kompaktowy, bez okładki,
                inaczej samo zdjęcie w tle zjadało całą wysokość ramki.

                **`sandbox` bez `allow-top-navigation` jest tu konieczny.**
                Wtyczka Facebooka linkuje z `target="_top"`, czyli kliknięcie
                w nią przenosi **całą kartę** na facebook.com, a nie otwiera
                nowej. Stopka stoi pod każdą stroną, więc przy krótkich —
                logowanie, zakładanie konta — widżet ląduje tuż pod przyciskiem
                i wystarczyło chybić palcem, żeby zamiast konta zobaczyć
                Facebooka. Z piaskownicą kliknięcie otwiera nową kartę
                (`allow-popups`), a nasza zostaje na miejscu. */}
            <div className="mt-4 w-full max-w-[300px] overflow-hidden rounded-lg border border-[#111827]/10">
              <iframe
                src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(
                  facebookUrl
                )}&tabs=timeline&width=300&height=300&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=false`}
                width="300"
                height="300"
                title="Facebook"
                loading="lazy"
                className="block h-[300px] w-full border-0"
                scrolling="no"
                allow="encrypted-media"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          </div>

          <div>
            <h3 className="font-semibold">{t.footerFindUs}</h3>

            <p className="mt-2 text-sm leading-6 text-[#111827]/55">
              {settings?.site_name || "Marinero"}
              {settings?.address ? `, ${settings.address}` : ""}
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-[#111827]/10">
              <iframe
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  mapQuery || "Marina Yacht Park Gdynia"
                )}&output=embed`}
                title="Google Maps"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="block h-[220px] w-full border-0 md:h-[300px]"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          </div>
        </div>,
        "mapa"
      )}

      {contacts.length
        ? wrap(
            <>
              <h3 className="font-semibold">{t.footerContact}</h3>

              {/* Podział na działy — klient szukający części nie musi zgadywać,
                  do kogo z pięciu osób zadzwonić. Przypisanie robi się
                  w Directusie (`team.department`). */}
              <div className="mt-6 grid gap-x-10 gap-y-9 md:grid-cols-3">
                {departments(t).map((department) => {
                  const people = contacts.filter(
                    (person: any) => (person.department || "sprzedaz") === department.key
                  )
                  if (!people.length) return null

                  return (
                    <div key={department.key}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#111827]/35">
                        {department.label}
                      </p>

                      <div className="mt-4 grid gap-5">
                        {people.map((person: any) => (
                          <div key={person.id}>
                            <p className="font-semibold">{person.name}</p>

                            {person.position ? (
                              <p className="mt-1 text-sm leading-6 text-[#111827]/45">
                                {person.position}
                              </p>
                            ) : null}

                            <div className="mt-2 grid gap-1 text-sm text-[#111827]/70">
                              {/* Serwis przyjmuje zgłoszenia mailem — telefon
                                  odbierają Monika i Sonia, żeby nikt nie dzwonił
                                  pod numer, przy którym nikt nie siedzi. */}
                              {person.phone && department.key !== "serwis" ? (
                                <a
                                  href={`tel:${person.phone.replace(/\s/g, "")}`}
                                  className="hover:text-[#2E64A8]"
                                >
                                  {person.phone}
                                </a>
                              ) : null}

                              {person.email ? (
                                <a
                                  href={`mailto:${person.email}`}
                                  className="hover:text-[#2E64A8]"
                                >
                                  {person.email}
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>,
            "kontakty"
          )
        : null}
    </>
  )
}
