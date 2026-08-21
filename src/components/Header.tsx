import { getSiteSettings } from "@/lib/directus";
import { getBoatModelsPublic } from "@/lib/public-site-data";
import { getModelImage } from "@/lib/model-taxonomy";
import { getDictionary, localeHref, normalizeLocale } from "@/lib/i18n";
import MobileMenu from "@/components/MobileMenu";
import ModelSearch from "@/components/ModelSearch";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type HeaderProps = {
  settings?: any;
  variant?: "hero" | "light";
  models?: any[];
  locale?: string;
};

export default async function Header({
  settings,
  variant = "light",
  models,
  locale = "pl",
}: HeaderProps) {
  const [siteSettings, allModels] = await Promise.all([
    settings ? Promise.resolve(settings) : getSiteSettings(),
    models ? Promise.resolve(models) : getBoatModelsPublic(),
  ]);

  const current = normalizeLocale(locale);
  const t = getDictionary(current);
  const href = (path: string) => localeHref(current, path);
  const isHero = variant === "hero";

  // Do przeglądarki trafia tylko to, czego potrzebuje wyszukiwarka.
  const searchModels = (allModels || []).map((model: any) => ({
    name: model.name,
    slug: model.slug,
    brandName: model.brandName,
    image: getModelImage(model),
  }));

  return (
    <header
      className={
        isHero
          ? "relative z-20 bg-white/5 backdrop-blur-[2px]"
          : "sticky top-0 z-50 border-b border-[#111827]/10 bg-white shadow-sm"
      }
    >
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
        <a href={href("/")} className="flex min-w-0 items-center gap-3">
          <img
            src="/logo-marinero.png"
            alt="Marinero"
            className="h-7 w-auto object-contain md:h-8"
          />
        </a>

        <nav className="hidden items-center gap-6 text-base font-bold text-[#111827] xl:flex">
          <a href={`${href("/")}#brands`} className="transition hover:text-[#4854A7]">
            {t.navBrands}
          </a>
          <a href={href("/lodzie")} className="transition hover:text-[#4854A7]">
            {t.navBoats}
          </a>
          <a href={href("/modele")} className="transition hover:text-[#4854A7]">
            {t.navModels}
          </a>
          {/* Sklep wyróżniony — to jedyne wejście, które kończy się zakupem
              od ręki, a w rzędzie zwykłych linków ginął. */}
          <a
            href={href("/sklep")}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#4854A7]/10 px-3 py-1.5 text-[#3C468C] transition hover:bg-[#4854A7] hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-[15px] w-[15px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16l-1.3 11.2a2 2 0 0 1-2 1.8H7.3a2 2 0 0 1-2-1.8Z" />
              <path d="M9 7V5.6A3 3 0 0 1 12 3a3 3 0 0 1 3 2.6V7" />
            </svg>
            {t.navShop}
          </a>
          <a href={href("/aktualnosci")} className="transition hover:text-[#4854A7]">
            {t.navNews}
          </a>
          <a href={href("/kontakt")} className="transition hover:text-[#4854A7]">
            {t.navContact}
          </a>
        </nav>

        <div className="hidden min-w-[190px] max-w-[260px] flex-1 lg:block">
          <ModelSearch
            models={searchModels}
            basePath={href("/modele")}
            placeholder={t.searchPlaceholder}
            emptyLabel={t.searchEmpty}
          />
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher locale={current} />

          <a
            href={`tel:${siteSettings?.phone || "+48"}`}
            className={
              isHero
                ? "rounded-md border border-[#4854A7]/30 bg-[#4854A7] px-5 py-2.5 text-base font-bold text-white shadow-sm backdrop-blur-[2px] hover:bg-[#3C468C]"
                : "rounded-md bg-[#4854A7] px-5 py-2.5 text-base font-bold text-white hover:bg-[#3C468C]"
            }
          >
            {t.navCall}
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <LanguageSwitcher locale={current} />
          <MobileMenu phone={siteSettings?.phone} />
        </div>
      </div>

      {/* Na wąskich ekranach wyszukiwarka pod paskiem nawigacji. */}
      <div className="border-t border-[#111827]/8 px-5 py-3 lg:hidden">
        <ModelSearch
          models={searchModels}
          basePath={href("/modele")}
          placeholder={t.searchPlaceholder}
          emptyLabel={t.searchEmpty}
        />
      </div>
    </header>
  );
}
