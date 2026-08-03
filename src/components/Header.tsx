import { getSiteSettings } from "@/lib/directus";
import MobileMenu from "@/components/MobileMenu";

type HeaderProps = {
  settings?: any;
  variant?: "hero" | "light";
};

export default async function Header({
  settings,
  variant = "light",
}: HeaderProps) {
  const siteSettings = settings || (await getSiteSettings());
  const isHero = variant === "hero";

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

        <nav className="hidden items-center gap-9 text-base font-bold text-[#111827] lg:flex">
          <a href="/#brands" className="transition hover:text-[#4854A7]">
            Marki
          </a>
          <a href="/lodzie" className="transition hover:text-[#4854A7]">
            Łodzie
          </a>
          <a href="/modele" className="transition hover:text-[#4854A7]">
            Modele
          </a>
            <a href="https://sklep.marinero.150197.pl">
              Sklep
            </a>
          <a href="/#services" className="transition hover:text-[#4854A7]">
            Usługi
          </a>
          <a href="/aktualnosci" className="transition hover:text-[#4854A7]">
            Aktualności
          </a>
          <a href="/kontakt" className="transition hover:text-[#4854A7]">
            Kontakt
          </a>
        </nav>

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
    </header>
  );
}
