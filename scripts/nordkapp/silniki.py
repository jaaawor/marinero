"""
Ceny bazowe i dopłaty za silniki Mercury wg cennika producenta.

Nordkapp podaje cenę łodzi **razem z silnikiem**, a u nas baza jest bez silnika
i doliczamy do niej także Suzuki i silniki elektryczne. Dlatego nie przepisujemy
ceny producenta wprost, tylko zachowujemy naszą konwencję:

    nowa baza = cena producenta z najtańszym Mercurym − nasza dopłata za ten silnik

Dzięki temu łódź z najtańszym Mercurym kosztuje dokładnie tyle, co u producenta,
a dopłaty za Suzuki i silniki elektryczne dalej liczą się do tej samej bazy.
Dopłaty za pozostałe Mercury przepisujemy z różnic w cenniku producenta.

Przy Airborne i Coupe 905 V12 baza wynosi 0, bo cenę łodzi niesie wybór silnika —
tam wpisujemy pełne ceny pakietów.

Uruchomienie:  python3 scripts/nordkapp/silniki.py [--zapis]
"""

import json, os, re, sys, time, unicodedata, urllib.request

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("NORDKAPP_DANE", os.path.join(TU, "dane"))
SILNIKI_PL = json.load(open(os.path.join(TU, "slowniki.json"), encoding="utf-8"))["silniki"]


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


def moc(nazwa):
    """Moc silnika z nazwy. „Mercury V250 XXL AM DS" i „Mercury 250 XXL HD" to 250."""
    liczby = [int(x) for x in re.findall(r"\d{2,4}", str(nazwa))]
    sensowne = [x for x in liczby if 40 <= x <= 700]
    return sensowne[0] if sensowne else None


def blizniak(nazwa):
    """Czy to zestaw dwóch silników."""
    return bool(re.search(r"\b2\s*[x×]|\btwin\b", str(nazwa), re.I))


def wersja(nazwa):
    """
    Odmiana silnika. Sama moc nie wystarcza: przy Avant 605 mamy w cenniku
    i F115 ELPT, i F115 ELPT Pro XS — droższy o 800 EUR. Bez rozróżnienia
    obie pozycje dostawały jedną cenę i Pro XS tanioło.
    """
    #
    # Rozróżniamy tylko wersję wyczynową (Pro XS / Racing) — reszta oznaczeń
    # w nazwach Mercury'ego (HD, AM, DS, V8, V10) to kody zamówieniowe tego
    # samego silnika i wciągnięcie ich do klucza rozjeżdżało dopasowanie:
    # nasze „Mercury V250 XXL AM DS" i cennikowe „Mercury 250 XXL HD" to
    # ta sama jednostka.
    t = str(nazwa).lower()
    # „Mercury 150R" to w cenniku producenta wersja Racing — bez tego wpadała
    # do jednego worka ze zwykłym F150 i obie zostawały bez ceny.
    # Producent pisze wersję wyczynową na kilka sposobów: „Mercury 150R",
    # „150hp R", „Pro XS". U nas to samo bywa opisane jako „Racing".
    if re.search(r"pro\s*-?\s*xs|\bpxs\b|racing|\d{2,3}\s*(?:hp\s*)?r\b", t):
        return "pxs"
    return ""


def klucz(nazwa):
    return (moc(nazwa), blizniak(nazwa), wersja(nazwa))


def pakiety_silnikowe(d):
    # Producent potrafi wymienić ten sam wariant dwa razy (Enduro 605 ma dwa
    # wpisy „Mercury 150R" w tej samej cenie). Bez odsiania duplikatu wygląda
    # to na dwa różne silniki i skrypt odmawia dopasowania.
    out, widziane = [], set()
    for p in d.get("orderedBasePackages") or []:
        e = p.get("engine") or {}
        en = (e.get("name") or "").strip()
        cena = int(p.get("price") or 0)
        if not en or (en, cena) in widziane:
            continue
        widziane.add((en, cena))
        out.append({"en": en, "pl": SILNIKI_PL.get(en, en), "cena": cena})
    return sorted(out, key=lambda x: x["cena"])


def model(sciezka, zapis):
    slug = os.path.basename(sciezka).replace(".json", "")
    d = json.load(open(sciezka, encoding="utf-8"))
    cfg = api(f"/items/configurators?filter[slug][_eq]={slug}"
              f"&fields=id,base_price,groups.id,groups.title,groups.options.id,"
              f"groups.options.name,groups.options.price")["data"]
    if not cfg:
        return
    cfg = cfg[0]

    pakiety = pakiety_silnikowe(d)
    if not pakiety:
        print(f"{slug}: producent nie podaje wariantów silnikowych, pomijam")
        return
    najtanszy = pakiety[0]

    grupa = next((g for g in cfg["groups"]
                  if "spalinow" in g["title"].lower() or g["title"].lower() == "silnik"), None)
    if not grupa:
        print(f"{slug}: brak grupy silników spalinowych, pomijam")
        return

    nasze = [o for o in (grupa.get("options") or []) if "mercury" in o["name"].lower()]

    # Klucz musi być jednoznaczny po obu stronach. Gdy dwie nasze pozycje albo
    # dwa warianty producenta wpadają na ten sam klucz, nie zgadujemy która jest
    # która — zostawiamy cenę i wypisujemy do ręcznego sprawdzenia.
    from collections import Counter
    ile_nasze = Counter(klucz(o["name"]) for o in nasze)
    ile_prod = Counter(klucz(p["en"]) for p in pakiety)
    dwuznaczne = {k for k in ile_nasze if ile_nasze[k] > 1} | {k for k in ile_prod if ile_prod[k] > 1}

    wg_klucza = {}
    for o in nasze:
        wg_klucza.setdefault(klucz(o["name"]), o)

    baza_stara = float(cfg["base_price"] or 0)
    dopasowany = wg_klucza.get(klucz(najtanszy["en"]))

    print(f"\n{slug}")
    if baza_stara == 0:
        # Cena łodzi siedzi w wyborze silnika — wpisujemy pełne ceny pakietów.
        baza_nowa = 0.0
        nowe = {klucz(p["en"]): p["cena"] for p in pakiety}
        print(f"    baza 0 (cenę niesie silnik)")
    else:
        if not dopasowany or klucz(najtanszy["en"]) in dwuznaczne:
            print(f"    ! nie umiem jednoznacznie dopasować {najtanszy['en']} — cen nie ruszam")
            return
        baza_nowa = najtanszy["cena"] - float(dopasowany["price"] or 0)
        nowe = {klucz(p["en"]): float(dopasowany["price"] or 0) + (p["cena"] - najtanszy["cena"])
                for p in pakiety}
        print(f"    baza {baza_stara:.0f} → {baza_nowa:.0f} EUR "
              f"({baza_nowa - baza_stara:+.0f}); najtańszy: {najtanszy['pl']}")

    zmiany, bez_pary, niepewne = [], [], []
    for o in nasze:
        k = klucz(o["name"])
        if k in dwuznaczne:
            niepewne.append(o)
        elif k in nowe:
            zmiany.append((o, nowe[k]))
        else:
            bez_pary.append(o)

    for o, cena in zmiany:
        stara = float(o["price"] or 0)
        znak = "=" if abs(stara - cena) < 0.5 else "→"
        print(f"      {o['name'][:44]:46} {stara:8.0f} {znak} {cena:8.0f}")
    for o in bez_pary:
        print(f"      {o['name'][:44]:46} {float(o['price'] or 0):8.0f}   (nie ma w cenniku, zostaje)")
    for o in niepewne:
        print(f"      {o['name'][:44]:46} {float(o['price'] or 0):8.0f}   ! dwa warianty tej mocy — sprawdź ręcznie")

    # Warianty, których u nas brakuje — tylko do wiadomości, sami ich nie dokładamy:
    # o tym, które silniki sprzedajemy, decyduje handlowiec.
    for p in pakiety:
        if klucz(p["en"]) not in {klucz(o["name"]) for o in nasze}:
            print(f"      + u producenta jest {p['pl']} ({p['cena']} EUR), u nas go nie ma")

    if not zapis:
        return

    if baza_nowa != baza_stara:
        api(f"/items/configurators/{cfg['id']}", "PATCH", {"base_price": baza_nowa})
    for o, cena in zmiany:
        if abs(float(o["price"] or 0) - cena) >= 0.5:
            api(f"/items/configurator_options/{o['id']}", "PATCH", {"price": cena})


if __name__ == "__main__":
    zapis = "--zapis" in sys.argv
    tylko = [a for a in sys.argv[1:] if not a.startswith("--")]
    pliki = sorted(f for f in os.listdir(DANE) if f.endswith(".json"))
    if tylko:
        pliki = [f for f in pliki if f.replace(".json", "") in tylko]
    for f in pliki:
        model(os.path.join(DANE, f), zapis)
    if not zapis:
        print("\n(przebieg na sucho — nic nie zapisano; dodaj --zapis)")
