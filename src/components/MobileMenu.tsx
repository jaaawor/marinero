"use client";

import { useState } from "react";

type MobileMenuProps = {
  phone?: string;
  /** W sklepie pokazujemy menu sklepu, nie całego serwisu. */
  variant?: "site" | "shop";
};

const SITE_LINKS: [string, string][] = [
  ["Marki", "/#brands"],
  ["Łodzie", "/lodzie"],
  ["Modele", "/modele"],
  ["Silniki", "/silniki"],
  ["Sklep", "/sklep"],
  ["Aktualności", "/aktualnosci"],
  ["Kontakt", "/kontakt"],
];

const SHOP_LINKS: [string, string][] = [
  ["Sklep", "/sklep"],
  ["Wszystkie produkty", "/sklep/produkty"],
  ["Koszyk", "/sklep/koszyk"],
  ["Łodzie", "/lodzie"],
  ["Kontakt", "/kontakt"],
];

export default function MobileMenu({ phone, variant = "site" }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  const links = variant === "shop" ? SHOP_LINKS : SITE_LINKS;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#111827]/15 bg-white px-4 py-2 text-sm font-bold text-[#111827] shadow-sm"
        aria-label="Otwórz menu"
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

          <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-white p-6 shadow-2xl">
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

            <nav className="grid gap-1">
              {links.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b border-[#111827]/10 py-4 text-xl font-semibold text-[#111827]"
                >
                  {label}
                  <span className="text-[#4854A7]">→</span>
                </a>
              ))}
            </nav>

            <div className="mt-auto grid gap-3 pt-8">
              <a
                href={`tel:${phone || "+48"}`}
                className="rounded-md bg-[#4854A7] px-5 py-3 text-center text-sm font-bold text-white"
              >
                Zadzwoń
              </a>

              <a
                href="/kontakt"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[#111827]/15 px-5 py-3 text-center text-sm font-bold text-[#111827]"
              >
                Wyślij wiadomość
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
