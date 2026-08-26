"""
Konfiguratory XO z formularzy zamówień producenta.

XO wysyła na sezon jeden skoroszyt na model („XO EXPLR 9 Order Form 01.05.2026").
`czytaj.ts` rozbiera go na `dane/xo.json`, a ten skrypt przepisuje wynik do
Directusa: grupy opcji, ceny, kody katalogowe, tapicerki ze zdjęciami próbek
i kolor silnika.

Trzy rzeczy, których skrypt pilnuje:

1. **Cena bazowa konfiguratora zostaje 0.** U XO cenę łodzi niesie wybór
   silnika — pozycja „Mercury Verado 300 KM V8" to cena całej łodzi z tym
   silnikiem. Wpisanie ceny bazowej obok tego liczyłoby kadłub dwa razy.
2. **Nasze pozycje spoza cennika** (Suzuki, COX, przygotowanie pod nie)
   zostają z `off_price_list`; siedzą w `nasze.json`, bo po nazwie nie da się
   ich odróżnić od pozycji producenta.
3. **Najpierw wstawiamy, potem kasujemy.** Odwrotna kolejność przy zerwanym
   połączeniu zostawia łódź z pustą grupą — nadmiar da się usunąć, braku nie.

Uruchomienie:  python3 scripts/xo/import.py [--zapis] [slug ...]
Bez `--zapis` skrypt tylko pokazuje, co by zrobił.
"""

import json, os, re, subprocess, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request, zipfile
from html import unescape

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("XO_DANE", os.path.join(TU, "dane"))

_nazwy_surowe = {}
for plik in sorted(os.listdir(TU)):
    if plik.startswith("nazwy-") and plik.endswith(".json"):
        _nazwy_surowe.update(json.load(open(os.path.join(TU, plik), encoding="utf-8")))
NASZE = json.load(open(os.path.join(TU, "nasze.json"), encoding="utf-8"))

# Rendery kolorów kadłuba bierzemy wprost ze skoroszytu, więc trzeba wiedzieć,
# do której łodzi należy plik. Nazwa pliku nie wystarczy — oba skoroszyty
# 10S nazywają się tak samo, a różni je dopiero tytuł w środku („10S+").
# „10S+" przed „10S": pierwszy wzorzec wygrywa.
SLUGI_LAYOUT = [
    (re.compile(r"EXPLR\s*10S\s*\+", re.I), "xo-explr-10plus-sport"),
    (re.compile(r"EXPLR\s*10S", re.I), "xo-explr-10"),
    (re.compile(r"EXPLR\s*9", re.I), "xo-explr-9"),
    (re.compile(r"EXPLR\s*44", re.I), "xo-explr-44"),
    (re.compile(r"DFNDR\s*8", re.I), "xo-dfndr-8"),
    (re.compile(r"DFNDR\s*9", re.I), "xo-dfndr-9"),
]


def slug_skoroszytu(teksty):
    """Którą łódź opisuje skoroszyt — po tytule „XO … Standard Equipment"."""
    for t in teksty:
        czysty = norm(t)
        if "Standard Equipment" in czysty:
            trafiony = next((s for wzor, s in SLUGI_LAYOUT if wzor.search(czysty)), "")
            if trafiony:
                return trafiony
    return ""
TAPICERKI = json.load(open(os.path.join(TU, "tapicerki.json"), encoding="utf-8"))


def api(path, method="GET", body=None, prob=4):
    """Directus z powtórką — import to kilkaset żądań pod rząd i TLS potrafi urwać jedno."""
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
    """Excel wstawia w nazwy wąską spację nierozdzielającą — bez tego słownik nie trafia."""
    s = re.sub(r"[   ⁠]", " ", str(s or ""))
    return re.sub(r"\s+", " ", s).strip()


# Klucze słownika normalizujemy tak samo jak nazwy z arkusza: producent
# zostawia w nich podwójne spacje i wąskie spacje nierozdzielające.
NAZWY = {}


def _wczytaj_nazwy():
    for en, pl_ in _nazwy_surowe.items():
        NAZWY[norm(en)] = pl_


def klucz(nazwa):
    s = unicodedata.normalize("NFD", norm(nazwa).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s).split())


_wczytaj_nazwy()


def pl(en):
    """Polska nazwa pozycji z cennika. Brak tłumaczenia zgłaszamy — nie zgadujemy."""
    t = NAZWY.get(norm(en))
    if not t:
        print(f"    ! brak tłumaczenia: {en[:80]}")
    return t


# ── podział cennika na nasze grupy ────────────────────────────────────────────
#
# Nazwy grup w formularzu bywają rozwlekłe („Pilothouse & Exterior Boat
# Upholstery – Selection  (choose one)"), a przy EXPLR 44 producent wstawia
# dodatkową sekcję nazwaną całym zdaniem o Yamasze. Rozpoznajemy je po słowach
# kluczowych, nie po dokładnym brzmieniu.

def rodzaj_grupy(tytul):
    t = norm(tytul).lower()
    if "engine" in t:
        return "silnik"
    if "navigation" in t:
        return "nawigacja"
    if "additional features" in t:
        return "wyposazenie"
    if t.startswith("comfort"):
        return "komfort"
    if "hull and deck" in t:
        return "kadlub"
    if "upholstery" in t:
        return "tapicerka"
    if "wood finish" in t:
        return "drewno"
    if t.startswith("other"):
        return "transport"
    return ""


# Pozycja z sekcji silnikowej, która nie jest wariantem łodzi: przygotowanie
# pod silnik, joystick, CoastKey. Wariant łodzi poznajemy po „<model> with …".
WARIANT = re.compile(r"^XO .+? with ", re.I)
KOLOR_SILNIKA = re.compile(r"cold fusion white", re.I)


def tytul_tapicerki(en):
    """Nagłówek sekcji tapicerskiej → nasza nazwa grupy."""
    t = norm(en).lower()
    if "front and aft cabin" in t:
        return "Tapicerka kabiny dziobowej i rufowej"
    if "pilothouse & exterior" in t:
        return "Tapicerka sterówki i pokładu"
    if "exterior" in t:
        return "Tapicerka zewnętrzna"
    if "pilothouse" in t:
        return "Tapicerka sterówki"
    return "Tapicerka kabiny"


# ── zdjęcia próbek tapicerki ze skoroszytu ────────────────────────────────────

_pliki = {}


def zdjecia_tapicerek(zapis):
    """
    Próbki materiałów siedzą w skoroszycie jako obrazki. Kotwica („przy którym
    wierszu wisi obrazek") bywa przesunięta o wiersz, a przy jednym wierszu
    potrafią wisieć dwa zdjęcia, więc rozpoznajemy je po rozmiarze pliku —
    ten sam plik jest w każdym skoroszycie co do bajta.
    """
    wynik = {}
    po_rozmiarze = {int(k): v for k, v in TAPICERKI["zdjecia"].items()}
    for f in sorted(os.listdir(DANE)):
        if not f.endswith(".xlsx"):
            continue
        z = zipfile.ZipFile(os.path.join(DANE, f))
        for n in z.namelist():
            if not n.startswith("xl/media/"):
                continue
            rozmiar = z.getinfo(n).file_size
            tkanina = po_rozmiarze.get(rozmiar)
            if not tkanina or tkanina in wynik:
                continue
            wynik[tkanina] = None if not zapis else wgraj(z.read(n), tkanina)
    brak = [t for t in po_rozmiarze.values() if t not in wynik]
    if brak:
        print(f"  ! bez zdjęcia próbki: {', '.join(brak)}")
    return wynik


def rendery_kadluba(zapis):
    """
    Arkusz „Layout" to w istocie COLOUR COMBINATION ILLUSTRATIONS — render łodzi
    w każdym oklejeniu kadłuba. Etykieta („XO Classic – Hull wrapped in…") stoi
    w wierszu nad obrazkiem, więc każdy render przypisujemy do najbliższej
    etykiety powyżej. Renderów bywa mniej niż nazw — producent nie dosyła kadru
    do każdego wariantu i wtedy kafelek zostaje bez zdjęcia.
    """
    wynik = {}
    for f in sorted(os.listdir(DANE)):
        if not f.endswith(".xlsx"):
            continue
        sciezka = os.path.join(DANE, f)
        z = zipfile.ZipFile(sciezka)
        arkusze = re.findall(r'<sheet name="([^"]+)"', z.read("xl/workbook.xml").decode())
        numer = next((i for i, n in enumerate(arkusze, 1) if "layout" in n.lower()), 0)
        if not numer:
            continue
        teksty = [unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", x, re.S)))
                  for x in re.findall(r"<si>(.*?)</si>",
                                      z.read("xl/sharedStrings.xml").decode(), re.S)]
        etykiety = []
        for rnum, body in re.findall(r"<row[^>]*r=\"(\d+)\"[^>]*>(.*?)</row>",
                                     z.read(f"xl/worksheets/sheet{numer}.xml").decode(), re.S):
            # `[^>]*?` musi być NIEzachłanne: pusta komórka to
            # `<c r="B9" s="96"/>`, a wzorzec zachłanny zjadał ukośnik
            # i łapał treść NASTĘPNEJ komórki jako własną — ta sama pułapka,
            # którą opisuje `src/lib/xlsx-parse.ts`.
            for ref, atrybuty, srodek in re.findall(
                    r"<c r=\"([A-Z]+)\d+\"([^>]*?)(?:/>|>(.*?)</c>)", body, re.S):
                typ = re.search(r't="([^"]+)"', atrybuty)
                liczba = re.search(r"<v>(.*?)</v>", srodek or "")
                wartosc = liczba.group(1) if liczba else ""
                if typ and typ.group(1) == "s" and wartosc.isdigit():
                    wartosc = teksty[int(wartosc)]
                wartosc = norm(wartosc)
                if wartosc.startswith("XO "):
                    etykiety.append((int(rnum), wartosc.split("–")[0].strip()))
        if not etykiety:
            continue
        etykiety.sort()
        try:
            rels = z.read(f"xl/worksheets/_rels/sheet{numer}.xml.rels").decode()
        except KeyError:
            continue
        cel = re.search(r'Target="\.\./(drawings/drawing\d+\.xml)"', rels)
        if not cel:
            continue
        sc = "xl/" + cel.group(1)
        pary = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"',
                               z.read(sc.replace("drawings/", "drawings/_rels/") + ".rels").decode()))
        obrazki = []
        for m in re.finditer(r"<xdr:(?:two|one)CellAnchor.*?</xdr:(?:two|one)CellAnchor>",
                             z.read(sc).decode(), re.S):
            blok = m.group(0)
            wiersz = re.search(r"<xdr:from>.*?<xdr:row>(\d+)</xdr:row>", blok, re.S)
            emb = re.search(r'r:embed="([^"]+)"', blok)
            if wiersz and emb and emb.group(1) in pary:
                obrazki.append((int(wiersz.group(1)) + 1, "xl/" + pary[emb.group(1)].replace("../", "")))
        slug = slug_skoroszytu(teksty)
        if not slug:
            continue
        dla_lodzi = {}
        for wiersz, plik in sorted(obrazki):
            pasuje = [e for e in etykiety if e[0] <= wiersz]
            if not pasuje:
                continue
            nazwa = pasuje[-1][1]
            if nazwa in dla_lodzi:
                continue
            dla_lodzi[nazwa] = wgraj(z.read(plik), f"{slug} {nazwa}") if zapis else "podgląd"
        if dla_lodzi:
            wynik[slug] = dla_lodzi
    return wynik


def wgraj(dane, tytul):
    """Plik do Directusa. Ten sam raz — powtórny przebieg nie ma dubli w bibliotece."""
    nazwa_pliku = "xo-" + re.sub(r"[^A-Za-z0-9]+", "-", tytul).strip("-").lower() + ".png"
    if nazwa_pliku in _pliki:
        return _pliki[nazwa_pliku]
    juz = api(f"/files?filter[filename_download][_eq]={urllib.parse.quote(nazwa_pliku)}&fields=id&limit=1")["data"]
    if juz:
        _pliki[nazwa_pliku] = juz[0]["id"]
        return _pliki[nazwa_pliku]
    tmp = "/tmp/" + nazwa_pliku
    with open(tmp, "wb") as fh:
        fh.write(dane)
    out = subprocess.run(["curl", "-s", "-X", "POST", f"{D}/files",
                          "-H", f"Authorization: Bearer {T}",
                          "-F", f"title={tytul}",
                          "-F", f"file=@{tmp};filename={nazwa_pliku}"],
                         capture_output=True, text=True)
    os.remove(tmp)
    try:
        _pliki[nazwa_pliku] = json.loads(out.stdout)["data"]["id"]
    except Exception:
        print(f"    ! nie udało się wgrać próbki {tytul}: {out.stdout[:160]}")
        _pliki[nazwa_pliku] = None
    return _pliki[nazwa_pliku]


# ── zapis grupy ───────────────────────────────────────────────────────────────

ZAPISANE = set()


def zapisz_grupe(cfg_id, tytul, typ, sort, layout, pozycje, zapis, marka=None):
    if not pozycje:
        return
    ZAPISANE.add(klucz(tytul))
    istnieje = api(f"/items/configurator_groups?filter[configurator][_eq]={cfg_id}"
                   f"&fields=id,title,options.id,options.name,options.image&limit=100")["data"]
    grupa = next((g for g in istnieje if klucz(g["title"]) == klucz(tytul)), None)

    if not zapis:
        print(f"    [{sort}. {tytul}] {'aktualizacja' if grupa else 'nowa'}: {len(pozycje)} poz.")
        if "--szczegoly" in sys.argv:
            for p in pozycje:
                print(f"        {p.get('kod') or '—':>10} | {p['nazwa'][:78]:<78} | "
                      f"{round(float(p['cena'] or 0)):>7}"
                      f"{'  (nasze)' if p.get('nasze') else ''}"
                      f"{'  ✓' if p.get('wybrana') else ''}")
        return

    # Zdjęcia opcji nie pochodzą z cennika (wgrywa je `zdjecia.py` ze strony
    # producenta), a import przepisuje grupę od zera — bez przeniesienia
    # każdy kolejny przebieg kasowałby cały dorobek zdjęciowy.
    stare_zdjecia = {}
    if grupa:
        for o in grupa.get("options") or []:
            if o.get("image"):
                stare_zdjecia[klucz(o["name"])] = o["image"]

    if grupa:
        # Tytuł też nadpisujemy: grupy dopasowujemy po nazwie bez znaków
        # („nawigacja & sterowanie" = „nawigacja i sterowanie"), więc bez tego
        # w panelu zostałby stary zapis obok nowego przy sąsiedniej łodzi.
        api(f"/items/configurator_groups/{grupa['id']}", "PATCH",
            {"title": tytul, "type": typ, "sort": sort, "layout": layout,
             "engine_brand": marka})
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
            "price": round(float(p["cena"] or 0)),
            "code": p.get("kod") or None,
            "description": p.get("opis") or None,
            "image": p.get("plik") or stare_zdjecia.get(klucz(p["nazwa"])) or None,
            "selected": bool(p.get("wybrana")),
            "off_price_list": bool(p.get("nasze")),
            "sort": i + 1,
        })
    for oid in do_kasacji:
        api(f"/items/configurator_options/{oid}", "DELETE")


# ── jedna łódź ────────────────────────────────────────────────────────────────

def lodz(slug, dane, probki, rendery, zapis):
    ZAPISANE.clear()
    cfg = api(f"/items/configurators?filter[boat_model][slug][_eq]={slug}"
              f"&fields=id,base_price,currency&limit=1")["data"]
    if not cfg:
        print(f"  – {slug}: nie ma konfiguratora, pomijam")
        return
    cfg = cfg[0]
    wlasne = NASZE["lodzie"].get(slug, {})
    baza = int(dane["basePrice"] or 0)
    roznica = baza - int(wlasne.get("stara_baza") or baza)

    pomijane = {klucz(x) for x in NASZE["pominiete_nazwy"]}
    silniki, przygotowanie, kolor_silnika = [], [], []
    grupy = {"nawigacja": [], "wyposazenie": [], "komfort": [], "kadlub": [],
             "drewno": [], "transport": []}
    tapicerki = {}
    braki = 0

    for o in dane["options"]:
        rodzaj = rodzaj_grupy(o["group"])
        nazwa = pl(o["name"])
        if not nazwa:
            braki += 1
            continue
        if klucz(nazwa) in pomijane:
            continue
        poz = {"nazwa": nazwa, "cena": o["price"], "kod": (o.get("code") or "").strip()}

        if rodzaj == "silnik":
            if KOLOR_SILNIKA.search(o["name"]):
                kolor_silnika.append(poz)
            elif WARIANT.match(norm(o["name"])):
                silniki.append(poz)
            else:
                przygotowanie.append(poz)
        elif rodzaj == "tapicerka":
            tapicerki.setdefault(tytul_tapicerki(o["group"]), []).append(poz)
        elif rodzaj in grupy:
            grupy[rodzaj].append(poz)
        elif not rodzaj:
            # Wiersz spoza sekcji (wersja europejska / amerykańska) — pomijamy,
            # ale głośno, żeby nowa sekcja nie wypadła po cichu.
            print(f"    ? poza sekcjami, pomijam: {nazwa[:60]}")

    # „Bez silnika" to cena kadłuba z wyposażeniem standardowym — pierwszy wiersz
    # formularza. U nas musi być pozycją silnikową, bo baza konfiguratora to 0.
    silniki.append({"nazwa": "Bez silnika (kadłub z wyposażeniem standardowym)",
                    "cena": baza, "kod": "", "nasze": True})
    for s in wlasne.get("silniki") or []:
        silniki.append({"nazwa": s["nazwa"], "cena": s["cena"] + roznica, "kod": "", "nasze": True})
    for s in wlasne.get("przygotowanie") or []:
        przygotowanie.append({"nazwa": s["nazwa"], "cena": s["cena"], "kod": "", "nasze": True})
    for k in NASZE["kamizelki"]:
        grupy[k["grupa"]].append({"nazwa": k["nazwa"], "cena": k["cena"], "kod": "", "nasze": True})

    silniki.sort(key=lambda p: float(p["cena"] or 0))
    # Przy bazie 0 kalkulator bez zaznaczonego silnika otwiera się z „Razem 0",
    # co wygląda na awarię. Zaznaczamy najtańszą łódź **z silnikiem**: strona
    # modelu otwarta na wariancie „bez silnika" wygląda jak niedokończona oferta.
    z_silnikiem = next((p for p in silniki if not p["nazwa"].startswith("Bez silnika")), None)
    if z_silnikiem:
        z_silnikiem["wybrana"] = True

    print(f"\n{slug}  (baza {baza} {dane['currency']}, różnica wobec naszej: {roznica:+})")
    print(f"    silniki {len(silniki)} | przygotowanie {len(przygotowanie)} | "
          f"nawigacja {len(grupy['nawigacja'])} | wyposażenie {len(grupy['wyposazenie'])} | "
          f"komfort {len(grupy['komfort'])} | kadłub {len(grupy['kadlub'])} | "
          f"tapicerki {sum(len(v) for v in tapicerki.values())} w {len(tapicerki)} gr. | "
          f"drewno {len(grupy['drewno'])} | transport {len(grupy['transport'])}"
          + (f" | BEZ TŁUMACZENIA: {braki}" if braki else ""))

    if zapis and int(cfg["base_price"] or 0) != 0:
        # Cenę kadłuba niesie wybór silnika; baza obok tego liczyłaby go dwa razy.
        api(f"/items/configurators/{cfg['id']}", "PATCH", {"base_price": 0})
        print(f"    baza konfiguratora {cfg['base_price']} → 0 (cenę niesie silnik)")

    zapisz_grupe(cfg["id"], "Silnik", "radio", 1, "lista", silniki, zapis)
    zapisz_grupe(cfg["id"], "Przygotowanie pod silnik i sterowanie", "checkbox", 4, "lista",
                 przygotowanie, zapis)
    zapisz_grupe(cfg["id"], "Wyposażenie dodatkowe – nawigacja i sterowanie", "checkbox", 5,
                 "lista", grupy["nawigacja"], zapis)
    zapisz_grupe(cfg["id"], "Wyposażenie dodatkowe – wyposażenie łodzi", "checkbox", 6,
                 "lista", grupy["wyposazenie"], zapis)
    zapisz_grupe(cfg["id"], "Wyposażenie dodatkowe – komfort", "checkbox", 7,
                 "lista", grupy["komfort"], zapis)

    kadlub = grupy["kadlub"]
    if kadlub:
        kadlub.sort(key=lambda p: float(p["cena"] or 0))
        kadlub[0]["wybrana"] = True
    # Render łodzi w danym oklejeniu, jeśli producent go dołożył. Nazwa opcji
    # zaczyna się od wariantu („XO Classic — kadłub oklejony…"), więc bierzemy
    # dwa pierwsze słowa.
    moje_rendery = rendery.get(slug) or {}
    for p in kadlub:
        p["plik"] = moje_rendery.get(" ".join(p["nazwa"].split()[:2]))
    ma_zdjecia = any(p.get("plik") for p in kadlub)
    zapisz_grupe(cfg["id"], "Kolor kadłuba i pokładu", "radio", 8,
                 "kafelki" if ma_zdjecia else "lista", kadlub, zapis)

    sort = 9
    for tytul in sorted(tapicerki):
        poz = tapicerki[tytul]
        poz.sort(key=lambda p: float(p["cena"] or 0))
        poz[0]["wybrana"] = True
        for p in poz:
            # „Tapicerka Maglia Oak (MAG-6018)" → klucz do próbki i opisu.
            tkanina = re.sub(r"^Tapicerka\s+", "", p["nazwa"]).strip()
            p["plik"] = probki.get(tkanina)
            p["opis"] = TAPICERKI["opisy"].get(tkanina)
        zapisz_grupe(cfg["id"], tytul, "radio", sort, "kafelki", poz, zapis)
        sort += 1

    if grupy["drewno"]:
        grupy["drewno"].sort(key=lambda p: float(p["cena"] or 0))
        grupy["drewno"][0]["wybrana"] = True
        zapisz_grupe(cfg["id"], "Drewno we wnętrzu", "radio", sort, "lista", grupy["drewno"], zapis)
        sort += 1
    zapisz_grupe(cfg["id"], "Transport", "checkbox", sort, "lista", grupy["transport"], zapis)

    # Kolor silnika: przy łodziach z jednym wariantem koloru grupa jest związana
    # z marką silnika (pokazuje się po wyborze Mercury'ego i mnoży dopłatę przez
    # liczbę silników). Przy EXPLR 44 producent wycenia komplet silników osobno
    # dla V8/V10 i V12, więc zostaje zwykła grupa bez mnożenia.
    if kolor_silnika:
        czarny = {"nazwa": "Silnik w kolorze: czarny", "cena": 0, "kod": "", "wybrana": True}
        if len(kolor_silnika) == 1:
            biale = [{"nazwa": "Silnik w kolorze: biały", "cena": kolor_silnika[0]["cena"],
                      "kod": kolor_silnika[0]["kod"]}]
            zapisz_grupe(cfg["id"], "Kolor silnika Mercury", "radio", 3, "kafelki-pion",
                         [czarny] + biale, zapis, marka="mercury")
        else:
            zapisz_grupe(cfg["id"], "Kolor silników", "radio", 3, "lista",
                         [czarny] + kolor_silnika, zapis)

    posprzataj(cfg["id"], zapis)

    if zapis:
        api(f"/items/configurators/{cfg['id']}", "PATCH",
            {"price_list_note": f"{dane['boat']} — {dane.get('plik') or 'formularz zamówienia'}"})


def posprzataj(cfg_id, zapis):
    """
    Grupy, których w tym przebiegu nie zapisaliśmy. Zostają po poprzednim
    układzie („Kolor tapicerki", „Wyposażenie dodatkowe - nawigacja & sterowanie")
    i po zmianie tytułu wisiałyby obok nowych — te same opcje dwa razy.

    Grup związanych z marką silnika nie ruszamy: kolory Suzuki mają wgrane
    zdjęcia i próbki, a w formularzu XO ich nie ma.
    """
    grupy = api(f"/items/configurator_groups?filter[configurator][_eq]={cfg_id}"
                f"&fields=id,title,engine_brand,options.id&limit=100")["data"]
    zbedne = [g for g in grupy
              if klucz(g["title"]) not in ZAPISANE and not (g.get("engine_brand") or "")]
    for g in zbedne:
        print(f"    – zbędna grupa po starym układzie: {g['title']} ({len(g.get('options') or [])} poz.)")
        if not zapis:
            continue
        for o in g.get("options") or []:
            api(f"/items/configurator_options/{o['id']}", "DELETE")
        api(f"/items/configurator_groups/{g['id']}", "DELETE")


def main():
    zapis = "--zapis" in sys.argv
    wybrane = [a for a in sys.argv[1:] if not a.startswith("--")]
    plik = os.path.join(DANE, "xo.json")
    if not os.path.exists(plik):
        sys.exit(f"Brak {plik} — najpierw: npx tsx scripts/xo/czytaj.ts {DANE}/*.xlsx")
    dane = json.load(open(plik, encoding="utf-8"))
    probki = zdjecia_tapicerek(zapis)
    print(f"próbki tapicerek: {sum(1 for v in probki.values() if v) if zapis else len(probki)}")
    rendery = rendery_kadluba(zapis)
    print("rendery kolorów kadłuba: " + ", ".join(
        f"{s} {len(v)}" for s, v in sorted(rendery.items())) or "brak")
    for slug, d in dane.items():
        if wybrane and slug not in wybrane:
            continue
        lodz(slug, d, probki, rendery, zapis)
    print("\n" + ("Zapisane." if zapis else "Przebieg na sucho — dodaj --zapis."))


if __name__ == "__main__":
    main()
