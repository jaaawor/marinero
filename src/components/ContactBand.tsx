import { getTeamPublic } from "@/lib/public-site-data"
import { getDictionary, normalizeLocale } from "@/lib/i18n"

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
                inaczej samo zdjęcie w tle zjadało całą wysokość ramki. */}
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

              <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
                {contacts.map((person: any) => (
                  <div key={person.id}>
                    <p className="font-semibold">{person.name}</p>

                    {person.position ? (
                      <p className="mt-1 text-sm leading-6 text-[#111827]/45">{person.position}</p>
                    ) : null}

                    <div className="mt-2 grid gap-1 text-sm text-[#111827]/70">
                      {person.phone ? (
                        <a
                          href={`tel:${person.phone.replace(/\s/g, "")}`}
                          className="hover:text-[#2E64A8]"
                        >
                          {person.phone}
                        </a>
                      ) : null}

                      {person.email ? (
                        <a href={`mailto:${person.email}`} className="hover:text-[#2E64A8]">
                          {person.email}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>,
            "kontakty"
          )
        : null}
    </>
  )
}
