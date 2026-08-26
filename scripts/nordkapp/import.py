"""
Aktualizacja konfiguratorów Nordkappa z danych producenta.

Strona nordkapp-boats.com trzyma pełny cennik modelu w znaczniku
`<script id="model_boat" type="application/json">`: opcje dodatkowe z ceną,
opisem i zdjęciem, pakiety wyposażenia, tapicerki i warianty silnikowe.
Skrypt czyta to wprost i przepisuje do Directusa.

Czego skrypt NIE rusza: grup silnikowych i ceny bazowej. Producent podaje cenę
łodzi **razem z silnikiem**, a u nas baza jest bez silnika i doliczamy do niej
także silniki spoza oferty Nordkappa (Suzuki, elektryczne, „bez silnika").
Przeliczenie jednego na drugie to decyzja handlowa, nie techniczna.

Nasze własne pozycje (Garmin, mapy, silniki) zostają w grupie „Wyposażenie
dodatkowe" z zaznaczonym `off_price_list` — tak samo jak przy imporcie cenników.

Uruchomienie:  python3 scripts/nordkapp/import.py [--zapis] [slug ...]
Bez `--zapis` skrypt tylko pokazuje, co by zrobił.
"""

import json, os, re, subprocess, sys, unicodedata, urllib.parse, urllib.request

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("NORDKAPP_DANE", os.path.join(TU, "dane"))

NAZWY = json.load(open(os.path.join(TU, "nazwy.json"), encoding="utf-8"))
SLOWNIKI = json.load(open(os.path.join(TU, "slowniki.json"), encoding="utf-8"))
OPISY_PL = json.load(open(os.path.join(TU, "opisy.json"), encoding="utf-8"))
OPISY_EN = json.load(open(os.path.join(TU, "opisy-en.json"), encoding="utf-8"))
OPISY = dict(zip(OPISY_EN, OPISY_PL))

# Co zrobić z każdą starą nazwą opcji: „cennik" = producent ma tę pozycję i wchodzi
# świeży wpis, „nasza" = dokładamy ją sami i zostaje. Tabela zamiast zgadywania po
# nazwie: nasze polskie nazwy były tłumaczone luźno („Lodówka szufladowa" to
# „Szuflada chłodząca 30 l"), więc żadne dopasowanie tekstowe tego nie rozstrzygnie.
DECYZJE = json.load(open(os.path.join(TU, "stare-opcje.json"), encoding="utf-8"))["decyzje"]


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        D + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + T, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} → {e.code}: {e.read().decode()[:300]}") from None
    return json.loads(raw) if raw else {}


def klucz(nazwa):
    """Nazwa sprowadzona do porównywalnej postaci — bez ogonków, znaków i liczb w nawiasach."""
    s = unicodedata.normalize("NFD", str(nazwa or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


_pliki = {}


def wgraj_zdjecie(url, tytul):
    """Zdjęcie opcji do Directusa. Ten sam plik u kilku modeli wgrywamy raz."""
    if not url:
        return None
    czysty = re.sub(r"\?.*", "", url)
    if czysty in _pliki:
        return _pliki[czysty]
    pelny = "https://www.nordkapp-boats.com" + url if url.startswith("/") else url
    nazwa_pliku = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(czysty))[:100]

    # Ten sam plik mógł już trafić do Directusa przy wcześniejszym uruchomieniu —
    # bez tego każdy przebieg zostawiałby w bibliotece komplet duplikatów.
    juz = api(f"/files?filter[filename_download][_eq]={urllib.parse.quote(nazwa_pliku)}&fields=id&limit=1")["data"]
    if juz:
        _pliki[czysty] = juz[0]["id"]
        return _pliki[czysty]

    tmp = "/tmp/nk_" + nazwa_pliku
    r = subprocess.run(["curl", "-sL", "--max-time", "120", pelny, "-o", tmp], capture_output=True)
    if r.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) < 4000:
        _pliki[czysty] = None
        return None
    out = subprocess.run(["curl", "-s", "-X", "POST", f"{D}/files",
                          "-H", f"Authorization: Bearer {T}",
                          "-F", f"title={tytul[:140]}", "-F", f"file=@{tmp}"],
                         capture_output=True, text=True)
    os.remove(tmp)
    try:
        _pliki[czysty] = json.loads(out.stdout)["data"]["id"]
    except Exception:
        _pliki[czysty] = None
    return _pliki[czysty]


def wspolne_dane():
    """
    Zdjęcie i opis tej samej opcji bierzemy z dowolnego modelu, w którym
    producent je podał. Nordkapp opisuje np. lodówkę zdjęciem tylko przy jednej
    łodzi, a przy pozostałych zostawia puste pole — bez tego połowa opcji
    zostałaby bez kadru i bez wyjaśnienia, do czego służy.
    """
    zdjecia, opisy = {}, {}
    for f in sorted(os.listdir(DANE)):
        if not f.endswith(".json"):
            continue
        d = json.load(open(os.path.join(DANE, f), encoding="utf-8"))
        for e in (d.get("regionalAvailableAdditionalEquipment") or []):
            pl = NAZWY.get((e.get("name") or "").strip())
            if not pl:
                continue
            k = klucz(pl)
            url = (e.get("dialogueImageUrl") or e.get("listImageUrl") or "").strip()
            if url and not zdjecia.get(k):
                zdjecia[k] = url
            opis = OPISY.get((e.get("listSummary") or "").strip(), "")
            if opis and not opisy.get(k):
                opisy[k] = opis
    return zdjecia, opisy


ZDJECIA = None
DODATKOWE_OPISY = None


def opcje_producenta(d):
    """Opcje dodatkowe z cennika producenta, po polsku."""
    wynik = []
    widziane = set()
    for e in (d.get("regionalAvailableAdditionalEquipment") or []):
        en = (e.get("name") or "").strip()
        pl = NAZWY.get(en)
        if not pl:
            print(f"    ! brak tłumaczenia: {en}")
            continue
        k = klucz(pl)
        if k in widziane:      # producent powtarza tę samą pozycję pod dwiema nazwami
            continue
        widziane.add(k)
        wynik.append({
            "nazwa": pl,
            "cena": int(e.get("price") or 0),
            "kod": (e.get("sku") or "").strip(),
            "opis": (OPISY.get((e.get("listSummary") or "").strip(), "")
                     or (DODATKOWE_OPISY or {}).get(k, "")),
            "zdjecie": ((e.get("dialogueImageUrl") or e.get("listImageUrl") or "").strip()
                        or (ZDJECIA or {}).get(k, "")),
        })
    return wynik


def pakiety(d):
    out = []
    for p in (d.get("orderedEquipmentPackages") or []):
        en = (p.get("name") or "").strip()
        if en.lower().startswith("only standard equipment"):
            out.append({"nazwa": "Tylko wyposażenie standardowe", "cena": 0, "kod": "", "opis": "", "wybrana": True})
            continue
        pakiet = re.sub(r"\s*\(.*?\)\s*", "", en).strip()
        pakiet = re.sub(r"\s+\+$", "+", pakiet)
        skladniki = [NAZWY.get((x.get("name") or "").strip(), (x.get("name") or "").strip())
                     for x in (p.get("equipment") or [])]
        out.append({
            "nazwa": f"Pakiet {pakiet}",
            "cena": int(p.get("price") or 0),
            "kod": (p.get("sku") or "").strip(),
            "opis": ("W pakiecie: " + ", ".join(skladniki) + ".") if skladniki else "",
            "wybrana": False,
        })
    if out and not any(x["wybrana"] for x in out):
        out[0]["wybrana"] = True
    return out


def tapicerki(d):
    out = []
    for i, p in enumerate(d.get("orderedInteriorPackages") or []):
        en = (p.get("name") or "").strip()
        out.append({
            "nazwa": SLOWNIKI["tapicerki"].get(en, en),
            "cena": int(p.get("price") or 0),
            "kod": (p.get("sku") or "").strip(),
            "opis": "",
            "zdjecie": (p.get("dialogueImageUrl") or p.get("listImageUrl") or ""),
            "wybrana": i == 0,
        })
    return out


def zapisz_grupe(cfg_id, tytul, typ, sort, layout, pozycje, zapis):
    """Nadpisuje grupę: kasuje stare opcje, wstawia nowe. Grupę tworzy, jeśli jej nie ma."""
    istnieje = api(f"/items/configurator_groups?filter[configurator][_eq]={cfg_id}"
                   f"&fields=id,title,options.id&limit=100")["data"]
    grupa = next((g for g in istnieje if klucz(g["title"]) == klucz(tytul)), None)

    if not zapis:
        print(f"    [{tytul}] {'aktualizacja' if grupa else 'nowa grupa'}: {len(pozycje)} poz.")
        return

    if grupa:
        for o in grupa.get("options") or []:
            api(f"/items/configurator_options/{o['id']}", "DELETE")
        api(f"/items/configurator_groups/{grupa['id']}", "PATCH",
            {"type": typ, "sort": sort, "layout": layout})
        gid = grupa["id"]
    else:
        gid = api("/items/configurator_groups", "POST",
                  {"configurator": cfg_id, "title": tytul, "type": typ,
                   "sort": sort, "layout": layout})["data"]["id"]

    for i, p in enumerate(pozycje):
        api("/items/configurator_options", "POST", {
            "group": gid,
            "name": p["nazwa"],
            "price": p["cena"],
            "code": p.get("kod") or None,
            "description": p.get("opis") or None,
            "image": p.get("plik") or None,
            "selected": bool(p.get("wybrana")),
            "off_price_list": bool(p.get("nasze")),
            "sort": i + 1,
        })


def model(sciezka, zapis):
    slug = os.path.basename(sciezka).replace(".json", "")
    d = json.load(open(sciezka, encoding="utf-8"))
    cfg = api(f"/items/configurators?filter[slug][_eq]={slug}&fields=id,slug,base_price,currency")["data"]
    if not cfg:
        print(f"  – {slug}: brak konfiguratora, pomijam")
        return None
    cfg = cfg[0]

    nowe = opcje_producenta(d)
    klucze_nowych = {klucz(x["nazwa"]) for x in nowe}

    # Nasze pozycje spoza cennika producenta — zostają.
    stare = api(f"/items/configurator_groups?filter[configurator][_eq]={cfg['id']}"
                f"&fields=id,title,options.name,options.price&limit=100")["data"]
    zostaja = []
    for g in stare:
        if "dodatkow" not in g["title"].lower():
            continue
        for o in g.get("options") or []:
            nazwa = o["name"].strip()
            # Pozycja, którą właśnie wstawiamy z cennika — przy powtórnym
            # uruchomieniu skryptu to jest nasz własny wpis z poprzedniego razu.
            # Bez tego każdy kolejny przebieg dubluje całe wyposażenie.
            if klucz(nazwa) in klucze_nowych:
                continue
            decyzja = DECYZJE.get(nazwa)
            if decyzja is None:
                # Nowa pozycja, której nie znamy — zostawiamy, bo skasowanie po cichu
                # cudzej pracy jest gorsze niż jeden duplikat do usunięcia ręcznie.
                print(f"    ? nieznana pozycja, zostawiam: {nazwa}")
                decyzja = "nasza"
            if decyzja == "nasza":
                zostaja.append({"nazwa": nazwa, "cena": o["price"], "kod": "",
                                "opis": "", "zdjecie": "", "nasze": True})

    print(f"\n{slug}  (u nas baza {cfg['base_price']} {cfg['currency']} | u producenta {d.get('displayPriceFrom')})")
    print(f"    opcje producenta: {len(nowe)} | nasze zostają: {len(zostaja)} | "
          f"pakiety: {len(pakiety(d))} | tapicerki: {len(tapicerki(d))}")

    if zapis:
        for p in nowe:
            p["plik"] = wgraj_zdjecie(p.get("zdjecie"), p["nazwa"])
        tp = tapicerki(d)
        for p in tp:
            p["plik"] = wgraj_zdjecie(p.get("zdjecie"), p["nazwa"])
    else:
        tp = tapicerki(d)

    zapisz_grupe(cfg["id"], "Pakiety wyposażenia", "radio", 5, "lista", pakiety(d), zapis)
    if tp:
        zapisz_grupe(cfg["id"], "Tapicerka", "radio", 6, "kafelki", tp, zapis)
    zapisz_grupe(cfg["id"], "Wyposażenie dodatkowe", "checkbox", 9, "lista", nowe + zostaja, zapis)
    return {"slug": slug, "nasza_baza": cfg["base_price"],
            "baza_producenta": d.get("priceFrom"), "opcji": len(nowe), "naszych": len(zostaja)}


if __name__ == "__main__":
    zapis = "--zapis" in sys.argv
    ZDJECIA, DODATKOWE_OPISY = wspolne_dane()
    tylko = [a for a in sys.argv[1:] if not a.startswith("--")]
    pliki = sorted(f for f in os.listdir(DANE) if f.endswith(".json"))
    if tylko:
        pliki = [f for f in pliki if f.replace(".json", "") in tylko]
    raport = [r for r in (model(os.path.join(DANE, f), zapis) for f in pliki) if r]
    print("\n== ceny bazowe ==")
    for r in raport:
        print(f"  {r['slug']:28} u nas {r['nasza_baza']:>8}  producent {r['baza_producenta']:>8} EUR")
    if not zapis:
        print("\n(przebieg na sucho — nic nie zapisano; dodaj --zapis)")
