import { getFooterData } from "@/lib/directus";
import WhatsAppButton from "@/components/WhatsAppButton";
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

  return (
    <footer className="border-t border-[#111827]/10 bg-white">
      {/* Facebook i mapa — klient pyta „gdzie jesteście" częściej niż o cokolwiek
          innego, a wpisy z Facebooka pokazują, że firma żyje. Oba są zwykłymi
          ramkami, bez SDK i bez dodatkowych skryptów na stronie. */}
      <div className="border-b border-[#111827]/10">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-12 md:px-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-12">
          <div>
            <h3 className="font-semibold">{t.footerFollow}</h3>

            <div className="mt-4 overflow-hidden rounded-lg border border-[#111827]/10">
              <iframe
                src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(
                  facebookUrl
                )}&tabs=timeline&width=340&height=380&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`}
                width="340"
                height="380"
                title="Facebook"
                loading="lazy"
                className="h-[380px] w-full border-0"
                scrolling="no"
                allow="encrypted-media"
              />
            </div>
          </div>

          <div>
            <h3 className="font-semibold">{t.footerFindUs}</h3>

            {siteSettings?.address ? (
              <p className="mt-2 text-sm leading-6 text-[#111827]/55">{siteSettings.address}</p>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-lg border border-[#111827]/10">
              <iframe
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  mapQuery || "Marina Yacht Park Gdynia"
                )}&output=embed`}
                title="Google Maps"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[320px] w-full border-0 md:h-[380px]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 md:grid-cols-4 md:px-8">
        <div>
          <img
            src="/logo-marinero.png"
            alt="Marinero"
            className="h-10 w-auto object-contain"
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
          <h3 className="font-semibold">{t.footerContact}</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#111827]/55">
            <a href={`mailto:${siteSettings?.email || "info@marinero.pl"}`}>
              {siteSettings?.email || "info@marinero.pl"}
            </a>
            <a href={`tel:${siteSettings?.phone || "+48"}`}>
              {siteSettings?.phone || t.navCall}
            </a>
            {siteSettings?.address ? (
              <p className="leading-6">{siteSettings.address}</p>
            ) : null}
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

      {/* Numer zależy od tego, czy klient jest w sklepie, czy przy łodziach. */}
      <WhatsAppButton
        boats={siteSettings?.whatsapp_boats}
        shop={siteSettings?.whatsapp_shop}
        label="WhatsApp"
      />
    </footer>
  );
}
