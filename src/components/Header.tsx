import { getSiteSettings } from "@/lib/directus";
import { getBoatModelsPublic } from "@/lib/public-site-data";
import { getModelImage } from "@/lib/model-taxonomy";
import MobileMenu from "@/components/MobileMenu";
import ModelSearch from "@/components/ModelSearch";

type HeaderProps = {
  settings?: any;
  variant?: "hero" | "light";
  models?: any[];
};

export default async function Header({
  settings,
  variant = "light",
  models,
}: HeaderProps) {
  const [siteSettings, allModels] = await Promise.all([
    settings ? Promise.resolve(settings) : getSiteSettings(),
    models ? Promise.resolve(models) : getBoatModelsPublic(),
  ]);

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
        <a href="/" className="flex min-w-0 items-center gap-3">
          <img
            src="/logo-marinero.png"
            alt="Marinero"
            className="h-10 w-auto object-contain md:h-12"
          />
        </a>

        <nav className="hidden items-center gap-7 text-base font-bold text-[#111827] xl:flex">
          <a href="/#brands" className="transition hover:text-[#4854A7]">
            Marki
          </a>
          <a href="/lodzie" className="transition hover:text-[#4854A7]">
            Łodzie
          </a>
          <a href="/modele" className="transition hover:text-[#4854A7]">
            Modele
          </a>
          <a href="https://sklep.marinero.150197.pl" className="transition hover:text-[#4854A7]">
            Sklep
          </a>
          <a href="/aktualnosci" className="transition hover:text-[#4854A7]">
            Aktualności
          </a>
          <a href="/kontakt" className="transition hover:text-[#4854A7]">
            Kontakt
          </a>
        </nav>

        <div className="hidden min-w-[210px] max-w-[280px] flex-1 lg:block">
          <ModelSearch models={searchModels} />
        </div>

        <div className="hidden lg:block">
          <a
            href={`tel:${siteSettings?.phone || "+48"}`}
            className={
              isHero
                ? "rounded-md border border-[#4854A7]/30 bg-[#4854A7] px-5 py-2.5 text-base font-bold text-white shadow-sm backdrop-blur-[2px] hover:bg-[#3C468C]"
                : "rounded-md bg-[#4854A7] px-5 py-2.5 text-base font-bold text-white hover:bg-[#3C468C]"
            }
          >
            Zadzwoń
          </a>
        </div>

        <div className="flex shrink-0 lg:hidden">
          <MobileMenu phone={siteSettings?.phone} />
        </div>
      </div>

      {/* Na wąskich ekranach wyszukiwarka pod paskiem nawigacji. */}
      <div className="border-t border-[#111827]/8 px-5 py-3 lg:hidden">
        <ModelSearch models={searchModels} />
      </div>
    </header>
  );
}
