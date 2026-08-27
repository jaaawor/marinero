"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { getDictionary, type Dict, type Locale } from "@/lib/i18n";

type MenuLink = { label: string; href: string };

type MenuGroup = {
  label: string;
  href: string;
  children: { label: string; href: string; count: number; section?: boolean }[];
};

type MobileMenuProps = {
  phone?: string;
  /** W sklepie pokazujemy menu sklepu, nie całego serwisu. */
  variant?: "site" | "shop";
  /** Gotowe odnośniki (z prefiksem języka) — zastępują listę domyślną. */
  links?: MenuLink[];
  /** Działy sklepu — na wąskim ekranie to jedyne wejście w kategorie. */
  groups?: MenuGroup[];
  /** Dodatek nad przyciskami, np. przełącznik języka. */
  extra?: ReactNode;
  locale?: Locale;
};

/**
 * Domyślne wejścia menu. Etykiety idą ze słownika, bo szuflada na telefonie
 * była jedynym miejscem w serwisie, które zostawało po polsku niezależnie
 * od wybranego języka.
 */
function siteLinks(t: Dict): [string, string][] {
  return [
    [t.navBrands, "/#brands"],
    [t.navBoats, "/lodzie"],
    [t.navOffers, "/gielda"],
    [t.navTrailers, "/przyczepy"],
    [t.navEngines, "/silniki"],
    [t.navShop, "/sklep"],
    [t.navNews, "/aktualnosci"],
    [t.navContact, "/kontakt"],
  ];
}

/** Sklep wyróżniamy też w menu na telefonie — tak jak w pasku nawigacji. */
const HIGHLIGHTED = "/sklep";

function shopLinks(t: Dict): [string, string][] {
  return [
    [t.navShop, "/sklep"],
    [t.menuAllProducts, "/sklep/produkty"],
    [t.shopCart, "/sklep/koszyk"],
    [t.navBoats, "/lodzie"],
    [t.navContact, "/kontakt"],
  ];
}

export default function MobileMenu({
  phone,
  variant = "site",
  links,
  groups,
  extra,
  locale,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const t = getDictionary(locale);

  const fallback = variant === "shop" ? shopLinks(t) : siteLinks(t);
  const items: MenuLink[] =
    links && links.length
      ? links
      : fallback.map(([label, href]) => ({ label, href }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#111827]/15 bg-white px-4 py-2 text-sm font-bold text-[#111827] shadow-sm"
        aria-label={t.menuOpen}
      >
        <span className="text-lg leading-none">☰</span>
        <span>Menu</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[9999] bg-[#111827]/45">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Zamknij menu"
          />

          <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#111827]/50">
                Menu
              </p>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[#111827]/15 px-3 py-2 text-sm font-bold"
                aria-label="Zamknij menu"
              >
                Zamknij
              </button>
            </div>

            {/* W sklepie na górze stoją działy produktów — po nie klient wchodzi
                do menu. Odnośniki serwisowe (kontakt, polityka) idą niżej,
                mniejsze; wcześniej było odwrotnie i kategorie ginęły pod nimi. */}
            {groups && groups.length ? (
              <div className="grid gap-1">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#111827]/40">
                  Kategorie
                </p>

                {groups.map((group) => (
                  <details key={group.href} className="border-b border-[#111827]/10">
                    <summary className="flex cursor-pointer items-center justify-between py-4 text-lg font-semibold text-[#111827]">
                      {group.label}
                      <span className="text-[13px] font-normal text-[#111827]/35">
                        {group.children.length}
                      </span>
                    </summary>

                    <div className="grid gap-1 pb-4">
                      <a
                        href={group.href}
                        onClick={() => setOpen(false)}
                        className="py-2 text-[15px] font-semibold text-[#4854A7]"
                      >
                        {group.label} — wszystko
                      </a>

                      {group.children.map((child) => (
                        <a
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center justify-between py-2 text-[15px] ${
                            child.section
                              ? "font-semibold text-[#111827]"
                              : "pl-3 text-[#111827]/70"
                          }`}
                        >
                          {child.label}
                          <span className="text-[12px] tabular-nums text-[#111827]/30">
                            {child.count}
                          </span>
                        </a>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ) : null}

            <nav className={groups && groups.length ? "mt-7 grid gap-1" : "grid gap-1"}>
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={
                    groups && groups.length
                      ? "flex items-center justify-between border-b border-[#111827]/8 py-2.5 text-[15px] text-[#111827]/70"
                      : item.href.endsWith(HIGHLIGHTED)
                        ? "my-1 flex items-center justify-between rounded-md bg-[#4854A7]/10 px-3 py-4 text-xl font-semibold text-[#3C468C]"
                        : "flex items-center justify-between border-b border-[#111827]/10 py-4 text-xl font-semibold text-[#111827]"
                  }
                >
                  {item.label}
                  <span className="text-[#4854A7]">→</span>
                </a>
              ))}
            </nav>

            <div className="mt-auto grid gap-3 pt-8">
              {extra ? <div className="flex justify-start pb-1">{extra}</div> : null}

              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="rounded-md bg-[#4854A7] px-5 py-3 text-center text-sm font-bold text-white"
                >
                  {t.navCall}
                </a>
              ) : null}

              <a
                href="/kontakt"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[#111827]/15 px-5 py-3 text-center text-sm font-bold text-[#111827]"
              >
                {t.menuWrite}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
