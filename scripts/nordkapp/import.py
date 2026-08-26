"""
Aktualizacja konfiguratorów Nordkappa z danych producenta.

Strona nordkapp-boats.com trzyma pełny cennik modelu w znaczniku
`<script id="model_boat" type="application/json">`: opcje dodatkowe z ceną,
opisem i zdjęciem, pakiety wyposażenia, tapicerki i warianty silnikowe.
Skrypt czyta to wprost i przepisuje do Directusa.

Czego ten skrypt NIE rusza: grup silnikowych i ceny bazowej — tym zajmuje się
osobno `silniki.py`, bo producent podaje cenę łodzi **razem z silnikiem**,
a u nas baza jest bez silnika i doliczamy do niej także silniki spoza oferty
Nordkappa (Suzuki, elektryczne, „bez silnika").

Nasze własne pozycje (Garmin, mapy, silniki) zostają w grupie „Wyposażenie
dodatkowe" z zaznaczonym `off_price_list` — tak samo jak przy imporcie cenników.

Uruchomienie:  python3 scripts/nordkapp/import.py [--zapis] [slug ...]
Bez `--zapis` skrypt tylko pokazuje, co by zrobił.
"""

import json, os, re, subprocess, sys, time, unicodedata, urllib.parse, urllib.request

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


def api(path, method="GET", body=None, prob=4):
    """
    Wywołanie Directusa. Import to kilka tysięcy żądań pod rząd i co jakiś czas
    jedno z nich urywa się na poziomie TLS — bez powtórki cały przebieg padał
    w połowie, zostawiając łódź z połową wyposażenia.
    """
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
    """
    Pakiety wyposażenia. Pierwsza pozycja to zawsze „Tylko wyposażenie
    standardowe" — bez niej z grupy radio nie da się wyjść, a klient, który
    kliknął pakiet z ciekawości, zostawał z nim na stałe.

    W polu `includes` zapisujemy kody katalogowe pozycji wchodzących w skład
    pakietu. Front po nich zaznacza te opcje i **nie liczy ich drugi raz** —
    w pakiecie są taniej niż osobno.
    """
    out = [{"nazwa": "Tylko wyposażenie standardowe", "cena": 0, "kod": "",
            "opis": "", "wybrana": True}]
    for p in (d.get("orderedEquipmentPackages") or []):
        en = (p.get("name") or "").strip()
        if en.lower().startswith("only standard equipment"):
            continue
        # Producent dopisuje model do nazwy pakietu raz w nawiasie
        # („Highline (Coupe 830)"), a raz po myślniku („Highline - Airborne 5.4").
        pakiet = re.sub(r"\s*\(.*?\)\s*", "", en).strip()
        pakiet = re.sub(r"\s+[-–—]\s+.*$", "", pakiet).strip()
        pakiet = re.sub(r"\s+\+$", "+", pakiet)
        skladniki = [NAZWY.get((x.get("name") or "").strip(), (x.get("name") or "").strip())
                     for x in (p.get("equipment") or [])]
        kody = [str(x.get("sku") or "").strip() for x in (p.get("equipment") or [])]
        out.append({
            "nazwa": f"Pakiet {pakiet}",
            "cena": int(p.get("price") or 0),
            "kod": (p.get("sku") or "").strip(),
            "opis": ("W pakiecie: " + ", ".join(skladniki) + ".") if skladniki else "",
            "sklad": [k for k in kody if k],
            "wybrana": False,
        })
    return out if len(out) > 1 else []


def silniki_pakietowe(d):
    """Warianty silnikowe z cennika producenta — pełna cena łodzi z silnikiem."""
    out = []
    for b in sorted(d.get("orderedBasePackages") or [], key=lambda x: x.get("price") or 0):
        en = ((b.get("engine") or {}).get("name") or "").strip()
        if not en:
            continue
        out.append({"pl": SLOWNIKI["silniki"].get(en, en), "cena": int(b.get("price") or 0)})
    return out


def kolory_silnika(d):
    """
    Kolor silnika. Producent daje wybór czarny/biały przy części wersji
    silnikowych — wszędzie tak samo wyceniony, więc robimy z tego jedną grupę
    zamiast doklejać kolor do każdego silnika osobno.
    """
    warianty = {}
    for b in d.get("orderedBasePackages") or []:
        for c in ((b.get("engine") or {}).get("colorOptions") or []):
            nazwa = (c.get("colorLabel") or c.get("colorName") or "").strip()
            pl = {"black": "Czarny", "white": "Biały"}.get(nazwa.lower(), nazwa)
            if not pl or pl in warianty:
                continue
            warianty[pl] = {
                "nazwa": f"Silnik w kolorze: {pl.lower()}",
                "cena": int(c.get("price") or 0),
                "kod": "",
                # Opis koloru producent ma tylko po angielsku — zostawiamy puste.
                "opis": "",
                "zdjecie": (c.get("dialogueImageUrl") or c.get("listImageUrl") or "").strip(),
                "kolor": (c.get("colorValue") or "").strip(),
            }
    if len(warianty) < 2:
        return []
    out = sorted(warianty.values(), key=lambda x: x["cena"])
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


def zapisz_grupe(cfg_id, tytul, typ, sort, layout, pozycje, zapis, marka=None):
    """
    Nadpisuje grupę. Najpierw **wstawiamy** komplet nowych opcji, dopiero potem
    kasujemy stare: przy odwrotnej kolejności urwane połączenie w środku
    przebiegu zostawiało łódź z pustą grupą i bezpowrotnie kasowało nasze
    własne pozycje (Garmin, mapy), których nie ma w cenniku producenta.
    Nadmiar da się usunąć, braku nie da się odtworzyć.
    """
    if not cfg_id:
        # Przebieg na sucho przy łodzi, która nie ma jeszcze konfiguratora.
        print(f"    [{tytul}] nowa grupa: {len(pozycje)} poz.")
        return

    istnieje = api(f"/items/configurator_groups?filter[configurator][_eq]={cfg_id}"
                   f"&fields=id,title,options.id&limit=100")["data"]
    grupa = next((g for g in istnieje if klucz(g["title"]) == klucz(tytul)), None)

    if not zapis:
        print(f"    [{tytul}] {'aktualizacja' if grupa else 'nowa grupa'}: {len(pozycje)} poz.")
        return

    if grupa:
        api(f"/items/configurator_groups/{grupa['id']}", "PATCH",
            {"type": typ, "sort": sort, "layout": layout, "engine_brand": marka})
        gid = grupa["id"]
        do_kasacji = [o["id"] for o in grupa.get("options") or []]
    else:
        gid = api("/items/configurator_groups", "POST",
                  {"configurator": cfg_id, "title": tytul, "type": typ,
                   "sort": sort, "layout": layout, "engine_brand": marka})["data"]["id"]
        do_kasacji = []

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
            "includes": ", ".join(p.get("sklad") or []) or None,
            "color": p.get("kolor") or None,
            "sort": i + 1,
        })

    for oid in do_kasacji:
        api(f"/items/configurator_options/{oid}", "DELETE")


def model(sciezka, zapis):
    slug = os.path.basename(sciezka).replace(".json", "")
    d = json.load(open(sciezka, encoding="utf-8"))
    cfg = api(f"/items/configurators?filter[slug][_eq]={slug}&fields=id,slug,base_price,currency")["data"]
    if not cfg:
        model_bazy = api(f"/items/boat_models?filter[slug][_eq]={slug}&fields=id&limit=1")["data"]
        if not model_bazy:
            print(f"  – {slug}: nie ma takiego modelu w katalogu, pomijam")
            return None
        if not zapis:
            print(f"  + {slug}: konfiguratora nie ma, założę go")
            cfg = {"id": None, "base_price": 0, "currency": "EUR"}
        else:
            # Nowa łódź dostaje bazę 0 — cenę niesie wybór silnika, tak samo
            # jak przy pozostałych Airborne'ach.
            cfg = api("/items/configurators", "POST", {
                "status": "published", "slug": slug, "currency": "EUR",
                "base_price": 0, "vat_rate": 0.23, "pln_rate": 4.3,
                "boat_model": model_bazy[0]["id"],
            })["data"]
            print(f"  + {slug}: założony konfigurator")
            zapisz_grupe(cfg["id"], "Silnik", "radio", 1, "lista",
                         [{"nazwa": p["pl"], "cena": p["cena"], "kod": "", "opis": "",
                           "wybrana": i == 0}
                          for i, p in enumerate(silniki_pakietowe(d))], zapis)
    else:
        cfg = cfg[0]

    nowe = opcje_producenta(d)
    klucze_nowych = {klucz(x["nazwa"]) for x in nowe}

    # Nasze pozycje spoza cennika producenta — zostają. Przy przebiegu na sucho
    # konfiguratora jeszcze nie ma, więc nie ma czego pytać.
    stare = [] if not cfg.get("id") else api(
        f"/items/configurator_groups?filter[configurator][_eq]={cfg['id']}"
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
          f"pakiety: {len(pakiety(d))} | tapicerki: {len(tapicerki(d))} | "
          f"kolory silnika: {len(kolory_silnika(d))}")

    if zapis:
        for p in nowe:
            p["plik"] = wgraj_zdjecie(p.get("zdjecie"), p["nazwa"])
        tp = tapicerki(d)
        for p in tp:
            p["plik"] = wgraj_zdjecie(p.get("zdjecie"), p["nazwa"])
    else:
        tp = tapicerki(d)

    kolory = kolory_silnika(d)
    if zapis:
        for p in kolory:
            p["plik"] = wgraj_zdjecie(p.get("zdjecie"), p["nazwa"])
    if kolory:
        # Grupa zależna od silnika: pokazuje się dopiero po wybraniu Mercury'ego
        # i mnoży dopłatę przez liczbę silników. Kadr pionowy, bo silnik
        # zaburtowy jest wyższy niż szerszy.
        zapisz_grupe(cfg["id"], "Kolor silnika Mercury", "radio", 4, "kafelki-pion",
                     kolory, zapis, marka="mercury")

    pak = pakiety(d)
    if pak:
        zapisz_grupe(cfg["id"], "Pakiety wyposażenia", "radio", 5, "lista", pak, zapis)
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
