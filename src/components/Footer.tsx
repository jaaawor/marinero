import { getFooterData } from "@/lib/directus";
import { getTeamPublic } from "@/lib/public-site-data";
import WhatsAppButton from "@/components/WhatsAppButton";
import ChatwootWidget from "@/components/ChatwootWidget";
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n";

type FooterProps = {
  settings?: any;
  brands?: any[];
  locale?: string;
};

export default async function Footer({ settings, brands, locale = "pl" }: FooterProps) {
  const current = normalizeLocale(locale);
  const t = getDictionary(current);
  const href = (path: string) => localeHref(current, path);
  let siteSettings = settings;
  let footerBrands = brands;

  if (!siteSettings || !footerBrands) {
    const data = await getFooterData();
    siteSettings = siteSettings || data.settings;
    footerBrands = footerBrands || data.brands;
  }

  const facebookUrl = siteSettings?.facebook_url || "https://www.facebook.com/marineropl";
  const mapQuery = siteSettings?.map_query || siteSettings?.address || "";

  // Cały zespół, nie tylko osoby przygotowujące oferty — w stopce ma być też
  // sklep i serwis.
  const contacts = await getTeamPublic(false).catch(() => []);

  return (
    <footer className="border-t border-[#111827]/10 bg-white">
      {/* Facebook i mapa — klient pyta „gdzie jesteście" częściej niż o cokolwiek
          innego, a wpisy z Facebooka pokazują, że firma żyje. Oba są zwykłymi
          ramkami, bez SDK i bez dodatkowych skryptów na stronie. */}
      <div className="border-b border-[#111827]/10">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-12">
          <div>
            <h3 className="font-semibold">{t.footerFollow}</h3>

            {/* Wtyczka Facebooka renderuje się w stałej szerokości podanej
                w adresie — bez `max-w` ramka na telefonie zostawiała pustą
                kolumnę obok wpisów. Nagłówek na wersję kompaktową, bez okładki,
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
              {siteSettings?.site_name || "Marinero"}
              {siteSettings?.address ? `, ${siteSettings.address}` : ""}
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
        </div>
      </div>

      {/* Kontakty do ludzi, nie do skrzynki ogólnej — tak jak na marinero.pl.
          Osoby pochodzą z kolekcji `team` w Directusie. */}
      {contacts.length ? (
        <div className="border-b border-[#111827]/10">
          <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-8">
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
                      <a href={`tel:${person.phone.replace(/\s/g, "")}`} className="hover:text-[#2E64A8]">
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
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 md:grid-cols-4 md:px-8">
        <div>
          <img
            src="/logo-marinero.png"
            alt="Marinero"
            className="h-9 w-auto object-contain"
          />
        </div>

        <div>
          <h3 className="font-semibold">{t.footerCompany}</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#111827]/55">
            <a href={href("/aktualnosci")}>{t.navNews}</a>
            <a href={href("/kontakt")}>{t.navContact}</a>
            <a href={`${href("/")}#services`}>{t.footerServices}</a>
            <a href={href("/modele")}>{t.navModels}</a>
            <a href={href("/lodzie")}>{t.navBoats}</a>
            <a href={href("/sklep")}>{t.navShop}</a>
          </div>
        </div>

        <div>
          <h3 className="font-semibold">{t.footerBrands}</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#111827]/55">
            {footerBrands && footerBrands.length > 0 ? (
              footerBrands.slice(0, 7).map((brand: any) => (
                <a key={brand.slug} href={href(`/marki/${brand.slug}`)}>
                  {brand.name}
                </a>
              ))
            ) : (
              <>
                <a href={href("/marki/nordkapp-boats")}>Nordkapp Boats</a>
                <a href={href("/marki/sting-boats")}>Sting Boats</a>
                <a href={href("/marki/xo-boats")}>XO Boats</a>
                <a href={href("/marki/jeanneau")}>Jeanneau</a>
              </>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">{siteSettings?.site_name || "Marinero"}</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#111827]/55">
            {siteSettings?.address ? (
              <p className="leading-6">{siteSettings.address}</p>
            ) : null}
            <a href={`mailto:${siteSettings?.email || "info@marinero.pl"}`}>
              {siteSettings?.email || "info@marinero.pl"}
            </a>
            <a href={`tel:${(siteSettings?.phone || "+48").replace(/\s/g, "")}`}>
              {siteSettings?.phone || t.navCall}
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-[#111827]/10">
        {/* Zapas z prawej — w tym rogu siedzi pływający przycisk WhatsApp. */}
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-5 pr-20 text-xs text-[#111827]/45 md:flex-row md:items-center md:justify-between md:px-8 md:pr-24">
          <p>© Marinero</p>
          <div className="flex flex-wrap gap-4">
            <a href={href("/regulamin")}>{t.footerTerms}</a>
            <a href={href("/polityka-prywatnosci")}>{t.footerPrivacy}</a>
            <a href={href("/kontakt")}>{t.navContact}</a>
          </div>
        </div>
      </div>

      {/* Czat na stronie — dymek po lewej. Bez zmiennych środowiskowych
          nie ładuje niczego, więc może stać na produkcji przed serwerem czatu. */}
      <ChatwootWidget
        url={process.env.NEXT_PUBLIC_CHATWOOT_URL}
        token={process.env.NEXT_PUBLIC_CHATWOOT_TOKEN}
        locale={current}
      />

      {/* Numer zależy od tego, czy klient jest w sklepie, czy przy łodziach. */}
      <WhatsAppButton
        boats={siteSettings?.whatsapp_boats}
        shop={siteSettings?.whatsapp_shop}
        hours={siteSettings?.whatsapp_hours}
        label="WhatsApp"
      />
    </footer>
  );
}
