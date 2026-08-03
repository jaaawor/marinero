import { getFooterData } from "@/lib/directus";

type FooterProps = {
  settings?: any;
  brands?: any[];
};

export default async function Footer({ settings, brands }: FooterProps) {
  let siteSettings = settings;
  let footerBrands = brands;

  if (!siteSettings || !footerBrands) {
    const data = await getFooterData();
    siteSettings = siteSettings || data.settings;
    footerBrands = footerBrands || data.brands;
  }

  return (
    <footer className="border-t border-[#111827]/10 bg-white">
      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 md:grid-cols-4 md:px-8">
        <div>
          <img
            src="/logo-marinero.png"
            alt="Marinero"
            className="h-10 w-auto object-contain"
          />
        </div>

        <div>
          <h3 className="font-semibold">Firma</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#111827]/55">
            <a href="/aktualnosci">Aktualności</a>
            <a href="/kontakt">Kontakt</a>
            <a href="/#services">Usługi</a>
            <a href="/modele">Modele</a>
            <a href="/lodzie">Łodzie</a>
            <a href="https://sklep.marinero.150197.pl">Sklep</a>
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Marki</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#111827]/55">
            {footerBrands && footerBrands.length > 0 ? (
              footerBrands.slice(0, 7).map((brand: any) => (
                <a key={brand.slug} href={`/marki/${brand.slug}`}>
                  {brand.name}
                </a>
              ))
            ) : (
              <>
                <a href="/marki/nordkapp-boats">Nordkapp Boats</a>
                <a href="/marki/sting-boats">Sting Boats</a>
                <a href="/marki/xo-boats">XO Boats</a>
                <a href="/marki/jeanneau">Jeanneau</a>
              </>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Kontakt</h3>
          <div className="mt-4 grid gap-2 text-sm text-[#111827]/55">
            <a href={`mailto:${siteSettings?.email || "info@marinero.pl"}`}>
              {siteSettings?.email || "info@marinero.pl"}
            </a>
            <a href={`tel:${siteSettings?.phone || "+48"}`}>
              {siteSettings?.phone || "Zadzwoń do nas"}
            </a>
            {siteSettings?.address ? (
              <p className="leading-6">{siteSettings.address}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-[#111827]/10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-5 text-xs text-[#111827]/45 md:flex-row md:items-center md:justify-between md:px-8">
          <p>© Marinero</p>
          <div className="flex gap-4">
            <a href="/polityka-prywatnosci">Polityka prywatności</a>
            <a href="/kontakt">Kontakt</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
