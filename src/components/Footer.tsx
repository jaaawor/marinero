import { getFooterData } from "@/lib/directus";
import ContactBand from "@/components/ContactBand";
import WhatsAppButton from "@/components/WhatsAppButton";
import ChatwootWidget from "@/components/ChatwootWidget";
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n";

type FooterProps = {
  settings?: any;
  brands?: any[];
  locale?: string;
  /** Strona sama pokazuje baner z mapą i kontaktami — w stopce byłby drugi raz. */
  hideContactBand?: boolean;
};

export default async function Footer({
  settings,
  brands,
  locale = "pl",
  hideContactBand,
}: FooterProps) {
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

  return (
    <footer className="border-t border-[#111827]/10 bg-white">
      {/* Facebook, mapa i kontakty do ludzi — ten sam blok co na stronie
          kontaktu, żeby numery telefonów były w obu miejscach identyczne. */}
      {hideContactBand ? null : (
        <ContactBand settings={siteSettings} locale={current} bare />
      )}

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
            <a href={`mailto:${siteSettings?.email || "biuro@marinero.pl"}`}>
              {siteSettings?.email || "biuro@marinero.pl"}
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
        url={siteSettings?.chatwoot_url || process.env.CHATWOOT_URL}
        token={siteSettings?.chatwoot_token || process.env.CHATWOOT_TOKEN}
        locale={current}
      />

      {/* Numer zależy od tego, czy klient jest w sklepie, czy przy łodziach. */}
      <WhatsAppButton
        boats={siteSettings?.whatsapp_boats}
        shop={siteSettings?.whatsapp_shop}
        hours={siteSettings?.whatsapp_hours}
        chat={Boolean(siteSettings?.chatwoot_url || process.env.CHATWOOT_URL)}
        label="WhatsApp"
      />
    </footer>
  );
}
