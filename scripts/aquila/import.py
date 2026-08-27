"""
Konfiguratory Aquili z cenników producenta.

Aquila wysyła osobny skoroszyt na model („Aquila_42Y_Pricing_7.1.25.xlsx"),
jeden arkusz, jedna kolumna z ceną w USD. Układ jest zawsze ten sam: wiersz
z ceną łodzi bazowej, a pod nim sekcje (Engine, Hull Color, Electronics
Package…), w których kolumna A trzyma nazwę sekcji, D opis pozycji, a I cenę.

Konwencja jak przy XO: **cena bazowa konfiguratora zostaje 0**, bo wariant
silnikowy niesie całą cenę łodzi. W cenniku silnik standardowy kosztuje 0,
więc doliczamy do niego cenę bazową z pierwszego wiersza.

Uruchomienie:  python3 scripts/aquila/import.py [--zapis] [--szczegoly] [slug ...]
"""

import html, json, os, re, sys, time, unicodedata, urllib.error, urllib.request, zipfile

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("AQUILA_DANE", os.path.join(TU, "dane"))
NAZWY = json.load(open(os.path.join(TU, "nazwy.json"), encoding="utf-8"))

# Tytuł w skoroszycie → nasz slug. Cennik nazywa modele inaczej niż katalog
# („Aquila 28 Molokai Cuddy Catamaran" wobec „Aquila 28 Molokai Cuddy”),
# a wersje Cuddy trzeba sprawdzać przed zwykłymi — pierwszy wzorzec wygrywa.
SLUGI = [
    (re.compile(r"28\s*Molokai\s*Cuddy|28\s*MC\s*Cuddy|28MCC", re.I), "aquila-28-molokai-cuddy"),
    (re.compile(r"28\s*Molokai|28MC", re.I), "aquila-28-molokai"),
    (re.compile(r"\b32\s*S(port)?\b", re.I), "aquila-32-sport"),
    (re.compile(r"\b35\s*S(port)?\b", re.I), "aquila-35-sport"),
    (re.compile(r"36\s*(Molokai|MC)\b", re.I), "aquila-36-molokai"),
    (re.compile(r"\b36\s*S(port)?\b", re.I), "aquila-36-sport"),
    (re.compile(r"42\s*Y(acht)?\b", re.I), "aquila-42-yacht"),
    (re.compile(r"42\s*C(oupe)?\b", re.I), "aquila-42-coupe"),
    (re.compile(r"\b45\s*S(port)?\b", re.I), "aquila-45-sport"),
    (re.compile(r"46\s*C(oupe)?\b", re.I), "aquila-46-coupe"),
    (re.compile(r"46\s*Y(acht)?\b", re.I), "aquila-46-yacht"),
    (re.compile(r"47\s*(Molokai|MC)\b", re.I), "aquila-47-molokai"),
    (re.compile(r"50\s*Y(acht)?\b", re.I), "aquila-50-yacht"),
    (re.compile(r"54\s*Y(acht)?\b", re.I), "aquila-54-yacht"),
    (re.compile(r"70\s*Luxury", re.I), "aquila-70-luxury"),
]

# Transport z Szanghaju — producent zostawia w cenniku „do potwierdzenia
# z dealerem", a stawki mamy własne, zależne od długości łodzi (w stopach).
# Wchodzi zaznaczony, bo łódź trzeba przywieźć: oferta bez transportu byłaby
# o kilkadziesiąt tysięcy dolarów za tania.
TRANSPORT = [(28, 18000), (36, 50000), (47, 90000), (999, 120000)]


def transport(slug):
    stopy = int(re.search(r"aquila-(\d+)", slug).group(1))
    return next(cena for granica, cena in TRANSPORT if stopy <= granica)


# Wiersze podsumowania arkusza — nie są pozycją do wyboru.
POMIJANE = re.compile(r"^\s*Total for boat\b", re.I)

# Sekcje, których w konfiguratorze nie chcemy. „Voltage" to napięcie instalacji
# pokładowej (110 V / 120 V / 230 V) — wybór wynika z rynku, na który idzie
# łódź, a nie z życzenia klienta, i tylko myli w formularzu.
POMIJANE_SEKCJE = {"Voltage"}

# Sekcja silnikowa bywa nazwana „Power" (28 Molokai Cuddy) — a to ona niesie
# cenę łodzi, więc trzeba ją rozpoznać po obu nazwach.
SILNIK = {"Engine", "Power"}

# Wspólny układ grup dla całej marki.
#
# Producent kroi cennik po swojemu i za każdym razem inaczej: przy jednej łodzi
# osprzęt pokładowy to „Deck Gear", przy drugiej „Deck Equipment", przy trzeciej
# „Deck Gear and Anchoring"; agregat stoi osobno od reszty elektryki, a osłony
# przeciwsłoneczne rozbite są na „Canvas", „Shade" i „Hard Top". Przepisane
# jeden do jednego dawało 44 różne sekcje na jedenaście łodzi — czyli przy
# każdym modelu inne nazwy i inna kolejność.
#
# Dlatego `nazwy.json` sprowadza je do wspólnego zestawu (kilka sekcji cennika
# może wpaść do jednej grupy), a `KOLEJNOSC` ustawia je zawsze tak samo, od
# silnika po transport. Handlowiec przechodzący z 28 Molokai na 54 Yacht widzi
# ten sam formularz, tylko dłuższy.
KOLEJNOSC = [
    "Pakiety wyposażenia",
    "Silnik",
    "Napęd i sterowanie",
    "Kolor kadłuba",
    "Kolor dachu od wewnątrz",
    "Kolor listwy kabiny i naklejek na kadłubie",
    "Wykończenie wnętrza",
    "Kolor tapicerki zewnętrznej",
    "Układ kabin",
    "Kokpit",
    "Salon i kambuz",
    "Flybridge",
    "Stanowisko sterowania",
    "Pokrowce i zadaszenie",
    "Pokład",
    "Komfort",
    "Toaleta",
    "Instalacja wodna",
    "Wyposażenie pokładowe",
    "Wyposażenie wędkarskie",
    "Elektryka",
    "Oświetlenie",
    "Pakiety elektroniki",
    "Elektronika i nawigacja",
    "System foilowy",
    "Część podwodna",
    "Transport",
]

# Grupy, w których wybiera się jedną pozycję. Reszta to dokładane wyposażenie.
# „Silnik" jest tu zawsze: przy naszej konwencji wariant silnikowy niesie całą
# cenę łodzi, więc zaznaczenie dwóch naraz nie miałoby sensu.
RADIO = {"Pakiety wyposażenia", "Silnik", "Kolor kadłuba", "Kolor dachu od wewnątrz",
         "Kolor listwy kabiny i naklejek na kadłubie", "Wykończenie wnętrza",
         "Kolor tapicerki zewnętrznej", "Układ kabin", "Pakiety elektroniki",
         "System foilowy"}


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
    s = re.sub(r"[   ⁠]", " ", html.unescape(str(s or "")))
    return re.sub(r"\s+", " ", s).strip()


def klucz(nazwa):
    s = unicodedata.normalize("NFD", norm(nazwa).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s).split())


def wiersze(sciezka):
    """Arkusz cennika → lista (numer wiersza, {kolumna: wartość})."""
    z = zipfile.ZipFile(sciezka)
    teksty = [html.unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", x, re.S)))
              for x in re.findall(r"<si>(.*?)</si>",
                                  z.read("xl/sharedStrings.xml").decode(), re.S)]
    # Przy 47 Molokai skoroszyt ma dwa arkusze: najpierw specyfikację łodzi
    # bazowej, dopiero potem cennik. Bierzemy ten z ceną w nazwie („AQUILA 47
    # USD"), a gdy takiego nie ma — pierwszy z brzegu.
    nazwy = re.findall(r'<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"',
                       z.read("xl/workbook.xml").decode())
    cele = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"',
                           z.read("xl/_rels/workbook.xml.rels").decode()))
    rid = next((r for n, r in nazwy if "usd" in n.lower()), nazwy[0][1] if nazwy else "")
    arkusz = "xl/" + cele[rid].replace("/xl/", "")
    out = []
    for numer, body in re.findall(r"<row[^>]*r=\"(\d+)\"[^>]*>(.*?)</row>",
                                  z.read(arkusz).decode(), re.S):
        komorki = {}
        # `[^>]*?` musi być NIEzachłanne: pusta komórka to `<c r="B9" s="96"/>`,
        # a wzorzec zachłanny zjadał ukośnik i łapał treść NASTĘPNEJ komórki —
        # ta sama pułapka, którą opisuje `src/lib/xlsx-parse.ts`.
        for ref, atrybuty, srodek in re.findall(
                r"<c r=\"([A-Z]+)\d+\"([^>]*?)(?:/>|>(.*?)</c>)", body, re.S):
            typ = re.search(r't="([^"]+)"', atrybuty)
            liczba = re.search(r"<v>(.*?)</v>", srodek or "")
            wartosc = liczba.group(1) if liczba else ""
            if typ and typ.group(1) == "s" and wartosc.isdigit():
                wartosc = teksty[int(wartosc)]
            wartosc = norm(wartosc)
            if wartosc:
                komorki[ref] = wartosc
        if komorki:
            out.append((int(numer), komorki))
    return out


def cena(wartosc):
    try:
        return round(float(wartosc))
    except (TypeError, ValueError):
        return None


def cennik(sciezka):
    """(slug, cena bazowa, [(sekcja, nazwa, cena), …]) z jednego skoroszytu."""
    w = wiersze(sciezka)
    tytul = next((k["A"] for _, k in w if k.get("A", "").lower().startswith("aquila")), "")
    slug = next((s for wzor, s in SLUGI if wzor.search(tytul)), "")

    # Sekcje rozdziela pusty wiersz, a nazwa sekcji nie zawsze stoi w jego
    # pierwszym wierszu: przy 42 Yacht wariant standardowy silnika jest wyżej
    # niż etykieta „Engine". Dlatego dzielimy arkusz na bloki po przerwie
    # w numeracji i etykietę bierzemy z całego bloku.
    bloki, biezacy, poprzedni = [], [], None
    for numer, k in w:
        if poprzedni is not None and numer > poprzedni + 1 and biezacy:
            bloki.append(biezacy)
            biezacy = []
        biezacy.append(k)
        poprzedni = numer
    if biezacy:
        bloki.append(biezacy)

    baza, pozycje, po_bazie, sekcja = None, [], False, ""
    for blok in bloki:
        # Etykieta sekcji stoi w kolumnie A i zwykle otwiera blok, ale nie
        # zawsze: przy 42 Yacht wariant standardowy silnika leży WYŻEJ niż
        # etykieta „Engine", a przy 47 Molokai dwie sekcje potrafią stać
        # w jednym bloku, bez pustego wiersza między nimi. Dlatego wiersze
        # sprzed pierwszej etykiety należą do niej, a każda kolejna etykieta
        # otwiera nową sekcję od swojego wiersza.
        etykiety = [k.get("A") for k in blok]
        etykiety = [(i, e) for i, e in enumerate(etykiety) if e and not e.startswith("*")]
        pierwsza = etykiety[0][1] if etykiety else sekcja
        for i, k in enumerate(blok):
            nowa = next((e for j, e in etykiety if j == i), None)
            if nowa:
                sekcja = nowa
            elif i < (etykiety[0][0] if etykiety else 0):
                sekcja = pierwsza

            opis, kwota = k.get("D", ""), cena(k.get("I"))
            if not po_bazie:
                # Pierwszy wiersz z opisem i ceną to łódź bazowa.
                if opis and kwota is not None:
                    baza, po_bazie = kwota, True
                continue
            if opis and POMIJANE.match(opis):
                continue
            if not opis:
                # Wariant bez opisu, za to z tekstem w kolumnie ceny — tak
                # zapisane jest napięcie instalacji („110 V", „120 V").
                wariant = k.get("I", "")
                if sekcja and wariant and cena(wariant) is None:
                    pozycje.append((sekcja, wariant, 0))
                continue
            # Wiersze bez ceny to warianty bez dopłaty albo transport
            # „do potwierdzenia z dealerem".
            pozycje.append((sekcja, opis, kwota if kwota is not None else 0))
    return slug, baza, pozycje


ZAPISANE = set()


def zapisz_grupe(cfg_id, tytul, typ, sort, pozycje, zapis):
    if not pozycje:
        return
    ZAPISANE.add(klucz(tytul))
    istnieje = [] if not cfg_id else api(
        f"/items/configurator_groups?filter[configurator][_eq]={cfg_id}"
        f"&fields=id,title,options.id,options.name,options.image,options.off_price_list"
        f"&limit=100")["data"]
    grupa = next((g for g in istnieje if klucz(g["title"]) == klucz(tytul)), None)

    if not zapis:
        print(f"    [{sort}. {tytul}] {'aktualizacja' if grupa else 'nowa'}: {len(pozycje)} poz.")
        if "--szczegoly" in sys.argv:
            for p in pozycje:
                print(f"        {p['nazwa'][:88]:<88} {p['cena']:>8}"
                      f"{'  ✓' if p.get('wybrana') else ''}")
        return

    stare_zdjecia = {}
    if grupa:
        for o in grupa.get("options") or []:
            if o.get("image"):
                stare_zdjecia[klucz(o["name"])] = o["image"]
        api(f"/items/configurator_groups/{grupa['id']}", "PATCH",
            {"title": tytul, "type": typ, "sort": sort, "layout": "lista"})
        gid = grupa["id"]
        # Nasze pozycje spoza cennika (`off_price_list`) zostają nietknięte —
        # tak samo jak przy XO. Producent wycofuje warianty, których my nadal
        # sprzedajemy (pokład jasnoszary tylko na kokpit i dziób przy 42 Coupe),
        # i bez tego znikałyby przy każdym kolejnym cenniku.
        do_kasacji = [o["id"] for o in grupa.get("options") or []
                      if not o.get("off_price_list")]
    else:
        gid = api("/items/configurator_groups", "POST",
                  {"configurator": cfg_id, "title": tytul, "type": typ,
                   "sort": sort, "layout": "lista"})["data"]["id"]
        do_kasacji = []

    for i, p in enumerate(pozycje):
        api("/items/configurator_options", "POST", {
            "group": gid, "name": p["nazwa"], "price": p["cena"],
            "image": stare_zdjecia.get(klucz(p["nazwa"])) or None,
            "selected": bool(p.get("wybrana")), "sort": i + 1,
        })
    for oid in do_kasacji:
        api(f"/items/configurator_options/{oid}", "DELETE")


def posprzataj(cfg_id, zapis):
    """Grupy z poprzedniego układu — po zmianie tytułu wisiałyby obok nowych."""
    if not cfg_id:
        return
    for g in api(f"/items/configurator_groups?filter[configurator][_eq]={cfg_id}"
                 f"&fields=id,title,engine_brand,options.id,options.off_price_list"
                 f"&limit=100")["data"]:
        if klucz(g["title"]) in ZAPISANE or (g.get("engine_brand") or ""):
            continue
        nasze = [o for o in g.get("options") or [] if o.get("off_price_list")]
        if nasze:
            print(f"    · grupa spoza cennika zostaje: {g['title']} ({len(nasze)} poz.)")
            continue
        print(f"    – zbędna grupa po starym układzie: {g['title']} "
              f"({len(g.get('options') or [])} poz.)")
        if not zapis:
            continue
        for o in g.get("options") or []:
            api(f"/items/configurator_options/{o['id']}", "DELETE")
        api(f"/items/configurator_groups/{g['id']}", "DELETE")


def lodz(slug, baza, pozycje, plik, zapis):
    ZAPISANE.clear()
    model = api(f"/items/boat_models?filter[slug][_eq]={slug}&fields=id,name&limit=1")["data"]
    if not model:
        print(f"  – {slug}: nie ma takiego modelu w katalogu")
        return
    cfg = api(f"/items/configurators?filter[boat_model][_eq]={model[0]['id']}"
              f"&fields=id,base_price&limit=1")["data"]
    cfg_id = cfg[0]["id"] if cfg else None

    sekcje, braki = {}, 0
    for sekcja, en, kwota in pozycje:
        if sekcja in POMIJANE_SEKCJE:
            continue
        pl_sekcja = NAZWY["grupy"].get(sekcja)
        pl_nazwa = NAZWY["opcje"].get(en)
        if not pl_sekcja:
            print(f"    ! brak tłumaczenia sekcji: {sekcja}")
            braki += 1
            continue
        if not pl_nazwa:
            print(f"    ! brak tłumaczenia: {en[:90]}")
            braki += 1
            continue
        # Wariant silnikowy niesie całą cenę łodzi — w cenniku stoi tam sama
        # dopłata, a silnik standardowy kosztuje 0.
        if sekcja in SILNIK:
            kwota += baza or 0
        # Kilka sekcji cennika wpada do jednej naszej grupy (agregat do
        # elektryki, „Shade" i „Hard Top" do zadaszenia) — klucz to nasza
        # nazwa, nie nazwa producenta.
        sekcje.setdefault(pl_sekcja, []).append({"nazwa": pl_nazwa, "cena": kwota})

    print(f"\n{slug} ({model[0]['name']}): baza {baza} USD, {len(pozycje)} pozycji "
          f"w {len(sekcje)} sekcjach" + (f" | BEZ TŁUMACZENIA: {braki}" if braki else "")
          + ("" if cfg else "  [nowy konfigurator]"))

    if zapis:
        if cfg_id:
            if int(cfg[0]["base_price"] or 0) != 0:
                api(f"/items/configurators/{cfg_id}", "PATCH", {"base_price": 0})
        else:
            # `slug` musi być wypełniony: strona modelu szuka konfiguratora
            # właśnie po nim, nie po powiązaniu z modelem.
            cfg_id = api("/items/configurators", "POST", {
                "status": "published", "slug": slug, "boat_model": model[0]["id"],
                "currency": "USD", "base_price": 0, "vat_rate": 0.23, "pln_rate": 3.75,
                "show_base_includes": True,
            })["data"]["id"]

    # Kolejność zawsze ta sama, niezależnie od tego, w jakiej producent
    # ułożył sekcje w tym konkretnym skoroszycie.
    kolejne = sorted(sekcje, key=lambda t: KOLEJNOSC.index(t) if t in KOLEJNOSC else 999)
    for sort, pl_sekcja in enumerate(kolejne, start=1):
        lista = sekcje[pl_sekcja]
        if pl_sekcja == "Transport":
            lista = [{"nazwa": "Transport z Szanghaju do miejsca docelowego",
                      "cena": transport(slug), "wybrana": True}]
            zapisz_grupe(cfg_id, pl_sekcja, "checkbox", sort, lista, zapis)
            continue
        typ = "radio" if pl_sekcja in RADIO else "checkbox"
        if typ == "radio":
            lista.sort(key=lambda p: p["cena"])
            # Z grupy radio trzeba móc wyjść. Kolory i układy kabin mają
            # w cenniku wariant standardowy za 0, ale pakiety (elektronika,
            # foile, Upgrade Package) już nie — bez tej pozycji klient, który
            # kliknął pakiet z ciekawości, zostawał z nim na stałe.
            # Silnika to nie dotyczy: jakiś trzeba wybrać.
            if pl_sekcja != "Silnik" and not any(p["cena"] == 0 for p in lista):
                lista.insert(0, {"nazwa": "Tylko wyposażenie standardowe", "cena": 0})
            lista[0]["wybrana"] = True
        zapisz_grupe(cfg_id, pl_sekcja, typ, sort, lista, zapis)

    posprzataj(cfg_id, zapis)
    if zapis:
        api(f"/items/configurators/{cfg_id}", "PATCH", {"price_list_note": f"Aquila — {plik}"})


def main():
    zapis = "--zapis" in sys.argv
    wybrane = [a for a in sys.argv[1:] if not a.startswith("--")]
    pliki = [f for f in sorted(os.listdir(DANE)) if f.endswith(".xlsx")]
    if not pliki:
        sys.exit(f"Wrzuć cenniki Aquili (.xlsx) do {DANE}")
    for plik in pliki:
        slug, baza, pozycje = cennik(os.path.join(DANE, plik))
        if not slug:
            print(f"  ! {plik}: nie wiem, która to łódź")
            continue
        if wybrane and slug not in wybrane:
            continue
        lodz(slug, baza, pozycje, plik, zapis)
    print("\n" + ("Zapisane." if zapis else "Przebieg na sucho — dodaj --zapis."))


if __name__ == "__main__":
    main()
