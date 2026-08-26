"""
Konfiguratory Sting z cennika producenta.

Sting wysyła jeden skoroszyt na sezon: arkusz „Sting Boats prices ex.vat"
z cenami łodzi w wariantach silnikowych i po jednym arkuszu opcji na model
(„485 S Options", „PRO 725 Cabin Options"…). Do tej pory żadna łódź Stinga
nie miała u nas konfiguratora — cała marka stała na samych zdjęciach.

Konwencja jak przy XO: **cena bazowa konfiguratora zostaje 0**, bo cennik
podaje cenę łodzi razem z silnikiem. Wybór silnika niesie całą cenę.

Ceny „STD" (pozycja jest w standardzie) i „-" (niedostępna na tym modelu)
pomijamy — to nie są opcje do doliczenia.

Uruchomienie:  python3 scripts/sting/import.py [--zapis] [--szczegoly] [slug ...]
"""

import json, os, re, sys, time, unicodedata, urllib.error, urllib.request, zipfile
from html import unescape

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("STING_DANE", os.path.join(TU, "dane"))
NAZWY = json.load(open(os.path.join(TU, "nazwy.json"), encoding="utf-8"))

# Arkusz opcji → nasz slug. Cennik nazywa łodzie inaczej niż katalog
# („PRO 725 Open" to u nas „Sting 725 Pro"), więc tabela zamiast zgadywania.
ARKUSZE = {
    "PRO 535 Options": "sting-535-pro",
    "PRO 600 Options": "sting-600-pro",
    "PRO 600 HT Options": "sting-600-pro-ht",
    "Sting 725 Open Options": "sting-725-pro",
    "Sting 725 Cabin Options": "sting-725-pro-cabin",
    "Sting 725 Cabin XL Options": "sting-725-pro-cabin-xl",
    "Sting 725 HT Options": "sting-725-pro-ht",
    "485 S Options": "sting-485-s",
    "530 S Options": "sting-530-s",
    "580 S Options": "sting-580-s",
    "580 T Options": "sting-580-t",
}

# Nazwa modelu w arkuszu z cenami łodzi → ten sam slug.
MODELE = {
    "Sting 535 Pro": "sting-535-pro",
    "Sting 600 Pro": "sting-600-pro",
    "Sting 600 Pro HT": "sting-600-pro-ht",
    "PRO 725 Open": "sting-725-pro",
    "PRO 725 Cabin": "sting-725-pro-cabin",
    "PRO 725 Cabin XL": "sting-725-pro-cabin-xl",
    "PRO 725 HT": "sting-725-pro-ht",
    "Sting 485 S": "sting-485-s",
    "Sting 530 S": "sting-530-s",
    "Sting 580 S": "sting-580-s",
    "Sting 580 T": "sting-580-t",
}


def api(path, method="GET", body=None, prob=4):
    req = urllib.request.Request(
        D + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + T, "Content-Type": "application/json"})
    for podejscie in range(prob):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read().decode()
            return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            tresc = e.read().decode()[:300]
            if e.code in (429, 502, 503, 504) and podejscie < prob - 1:
                time.sleep(2 ** podejscie)
                continue
            raise RuntimeError(f"{method} {path} → {e.code}: {tresc}") from None
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            if podejscie == prob - 1:
                raise RuntimeError(f"{method} {path} → {e}") from None
            time.sleep(2 ** podejscie)
    return {}


def norm(s):
    s = re.sub(r"[   ⁠]", " ", unescape(str(s or "")))
    return re.sub(r"\s+", " ", s).strip()


def klucz(nazwa):
    s = unicodedata.normalize("NFD", norm(nazwa).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s).split())


def skoroszyt():
    pliki = [f for f in sorted(os.listdir(DANE)) if f.endswith(".xlsx")]
    if not pliki:
        sys.exit(f"Wrzuć cennik Stinga (.xlsx) do {DANE}")
    return zipfile.ZipFile(os.path.join(DANE, pliki[-1])), pliki[-1]


def arkusze(z):
    """Nazwa arkusza → wiersze jako słowniki {kolumna: wartość}."""
    teksty = [unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", x, re.S)))
              for x in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S)]
    nazwy = re.findall(r'<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"',
                       z.read("xl/workbook.xml").decode())
    cele = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"',
                           z.read("xl/_rels/workbook.xml.rels").decode()))
    wynik = {}
    for nazwa, rid in nazwy:
        sciezka = "xl/" + cele[rid].replace("/xl/", "")
        wiersze = []
        for _, body in re.findall(r"<row[^>]*r=\"(\d+)\"[^>]*>(.*?)</row>",
                                  z.read(sciezka).decode(), re.S):
            komorki = {}
            for ref, atrybuty, srodek in re.findall(
                    r"<c r=\"([A-Z]+)\d+\"([^>]*)(?:/>|>(.*?)</c>)", body, re.S):
                typ = re.search(r't="([^"]+)"', atrybuty)
                liczba = re.search(r"<v>(.*?)</v>", srodek or "")
                wartosc = liczba.group(1) if liczba else ""
                if typ and typ.group(1) == "s" and wartosc.isdigit():
                    wartosc = teksty[int(wartosc)]
                wartosc = norm(wartosc)
                if wartosc:
                    komorki[ref] = wartosc
            if komorki:
                wiersze.append(komorki)
        wynik[nazwa] = wiersze
    return wynik


def silniki(wiersze):
    """Warianty silnikowe per slug — cena to pełna cena łodzi z tym silnikiem."""
    wynik = {}
    for w in wiersze:
        slug = MODELE.get(w.get("A", ""))
        silnik, cena = w.get("B", ""), w.get("C", "")
        if not slug or not silnik or silnik == "Engine":
            continue
        try:
            cena = float(cena)
        except ValueError:
            continue
        pl = NAZWY["silniki"].get(silnik)
        if not pl:
            print(f"    ! brak tłumaczenia silnika: {silnik}")
            continue
        wynik.setdefault(slug, []).append({"nazwa": pl, "cena": cena, "kod": ""})
    return wynik


def opcje(wiersze):
    """Opcje z jednego arkusza. Kod katalogowy producenta idzie do `code`."""
    wynik = []
    for w in wiersze:
        kod, opis, cena = w.get("A", ""), w.get("B", ""), w.get("C", "")
        if not opis or opis == "Description of option":
            continue
        # „STD" = pozycja jest w standardzie, „-" = niedostępna na tym modelu.
        # Ani jedno, ani drugie nie jest opcją do doliczenia.
        if cena in ("", "-", "STD"):
            continue
        try:
            cena = float(cena)
        except ValueError:
            continue
        pl = NAZWY["opcje"].get(opis)
        if not pl:
            print(f"    ! brak tłumaczenia: {opis}")
            continue
        # Przy części pozycji producent podaje dwa kody w jednej komórce
        # („OP_360… OP_399…") — bierzemy pierwszy, reszta to wariant lustrzany.
        wynik.append({"nazwa": pl, "cena": cena, "kod": kod.split()[0] if kod else ""})
    return wynik


ZAPISANE = set()


def zapisz_grupe(cfg_id, tytul, typ, sort, pozycje, zapis):
    if not pozycje:
        return
    ZAPISANE.add(klucz(tytul))
    # Przy przebiegu na sucho konfiguratora może jeszcze nie być — nie ma
    # wtedy czego pytać o istniejące grupy.
    istnieje = [] if not cfg_id else api(
        f"/items/configurator_groups?filter[configurator][_eq]={cfg_id}"
        f"&fields=id,title,options.id,options.name,options.image&limit=100")["data"]
    grupa = next((g for g in istnieje if klucz(g["title"]) == klucz(tytul)), None)

    if not zapis:
        print(f"    [{sort}. {tytul}] {'aktualizacja' if grupa else 'nowa'}: {len(pozycje)} poz.")
        if "--szczegoly" in sys.argv:
            for p in pozycje:
                print(f"        {p.get('kod') or '—':>22} | {p['nazwa'][:64]:<64} | "
                      f"{round(p['cena']):>6}{'  ✓' if p.get('wybrana') else ''}")
        return

    # Zdjęcia opcji dokładamy osobno, poza cennikiem — przy nadpisaniu grupy
    # trzeba je przenieść, inaczej każdy kolejny cennik je kasuje.
    stare_zdjecia = {}
    if grupa:
        for o in grupa.get("options") or []:
            if o.get("image"):
                stare_zdjecia[klucz(o["name"])] = o["image"]
        api(f"/items/configurator_groups/{grupa['id']}", "PATCH",
            {"title": tytul, "type": typ, "sort": sort, "layout": "lista"})
        gid = grupa["id"]
        do_kasacji = [o["id"] for o in grupa.get("options") or []]
    else:
        gid = api("/items/configurator_groups", "POST",
                  {"configurator": cfg_id, "title": tytul, "type": typ,
                   "sort": sort, "layout": "lista"})["data"]["id"]
        do_kasacji = []

    for i, p in enumerate(pozycje):
        api("/items/configurator_options", "POST", {
            "group": gid,
            "name": p["nazwa"],
            "price": round(p["cena"]),
            "code": p.get("kod") or None,
            "image": stare_zdjecia.get(klucz(p["nazwa"])) or None,
            "selected": bool(p.get("wybrana")),
            "sort": i + 1,
        })
    for oid in do_kasacji:
        api(f"/items/configurator_options/{oid}", "DELETE")


def lodz(slug, warianty, dodatki, plik, zapis):
    ZAPISANE.clear()
    model = api(f"/items/boat_models?filter[slug][_eq]={slug}&fields=id,name&limit=1")["data"]
    if not model:
        print(f"  – {slug}: nie ma takiego modelu w katalogu")
        return
    cfg = api(f"/items/configurators?filter[boat_model][_eq]={model[0]['id']}"
              f"&fields=id,base_price&limit=1")["data"]

    warianty = sorted(warianty, key=lambda p: p["cena"])
    if warianty:
        warianty[0]["wybrana"] = True

    print(f"\n{slug} ({model[0]['name']}): silniki {len(warianty)}, opcje {len(dodatki)}"
          + ("" if cfg else "  [nowy konfigurator]"))

    if not zapis:
        zapisz_grupe(None if not cfg else cfg[0]["id"], "Silnik", "radio", 1, warianty, zapis)
        zapisz_grupe(None if not cfg else cfg[0]["id"], "Wyposażenie dodatkowe", "checkbox", 2,
                     dodatki, zapis)
        return

    if cfg:
        cfg_id = cfg[0]["id"]
        # Cenę łodzi niesie wybór silnika — baza obok tego liczyłaby kadłub
        # drugi raz.
        if int(cfg[0]["base_price"] or 0) != 0:
            api(f"/items/configurators/{cfg_id}", "PATCH", {"base_price": 0})
    else:
        cfg_id = api("/items/configurators", "POST", {
            "status": "published", "boat_model": model[0]["id"], "currency": "EUR",
            "base_price": 0, "vat_rate": 0.23, "pln_rate": 4.3,
            "show_base_includes": False,
        })["data"]["id"]

    zapisz_grupe(cfg_id, "Silnik", "radio", 1, warianty, zapis)
    zapisz_grupe(cfg_id, "Wyposażenie dodatkowe", "checkbox", 2, dodatki, zapis)
    api(f"/items/configurators/{cfg_id}", "PATCH", {"price_list_note": f"Sting — {plik}"})


def main():
    zapis = "--zapis" in sys.argv
    wybrane = [a for a in sys.argv[1:] if not a.startswith("--")]
    z, plik = skoroszyt()
    dane = arkusze(z)

    cennik = next((n for n in dane if "boats prices" in n.lower()), "")
    if not cennik:
        sys.exit("W skoroszycie nie ma arkusza z cenami łodzi.")
    warianty = silniki(dane[cennik])

    for arkusz, slug in ARKUSZE.items():
        if wybrane and slug not in wybrane:
            continue
        if arkusz not in dane:
            print(f"  ! nie ma arkusza \u201e{arkusz}\u201d")
            continue
        lodz(slug, warianty.get(slug, []), opcje(dane[arkusz]), plik, zapis)

    bez_cennika = [s for s in MODELE.values() if s not in ARKUSZE.values()]
    if bez_cennika:
        print("\nModele z cennika bez arkusza opcji: " + ", ".join(bez_cennika))
    print("\n" + ("Zapisane." if zapis else "Przebieg na sucho — dodaj --zapis."))


if __name__ == "__main__":
    main()
