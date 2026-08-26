"""
Zdjęcia opcji ze strony producenta.

XO trzyma katalog wyposażenia pod `xoboats.com/configurator` jako produkty
WooCommerce: nazwa, cena i zdjęcie. Formularz zamówienia, z którego bierzemy
ceny, zdjęć nie ma wcale — a opcja z kadrem sprzedaje się inaczej niż wiersz
tabeli.

Nazwy na stronie są krótsze i starsze niż w formularzu („Bow thruster 2.0KW"
wobec „Bow thruster Lewmar 2.0 kW"), więc parujemy je **ręcznie** tabelą
`zdjecia.json` — tak samo jak przy cennikach. Jedno zdjęcie obsługuje zwykle
kilka naszych wariantów tej samej rzeczy.

Uruchomienie:  python3 scripts/xo/zdjecia.py [--zapis] [--odswiez]
`--odswiez` pobiera stronę na nowo; bez tego czyta migawkę z `dane/`.
"""

import html, json, os, re, subprocess, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("XO_DANE", os.path.join(TU, "dane"))
MIGAWKA = os.path.join(DANE, "konfigurator-xo.html")
ZRODLO = "https://xoboats.com/configurator/"

PARY = json.load(open(os.path.join(TU, "zdjecia.json"), encoding="utf-8"))["pary"]

# Konfiguratory XO w Directusie — po slugu modelu.
SLUGI = ["xo-explr-9", "xo-explr-10", "xo-explr-10plus-sport", "xo-explr-44",
         "xo-dfndr-8", "xo-dfndr-9"]


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


def pobierz_strone(odswiez):
    if odswiez or not os.path.exists(MIGAWKA):
        os.makedirs(DANE, exist_ok=True)
        r = subprocess.run(["curl", "-sL", "--max-time", "120", ZRODLO, "-o", MIGAWKA],
                           capture_output=True)
        if r.returncode != 0 or not os.path.exists(MIGAWKA):
            sys.exit("Nie udało się pobrać strony konfiguratora XO.")
    return open(MIGAWKA, encoding="utf-8", errors="replace").read()


def katalog(strona):
    """
    Kafelki produktów: nazwa i pełne zdjęcie. Bierzemy `data-guid`, nie `src` —
    w `src` siedzi miniatura 258 px, a `data-guid` wskazuje oryginał.
    """
    wynik = {}
    for blok in re.findall(r'<div class="tmb tmb-woocommerce.*?(?=<div class="tmb tmb-woocommerce|$)',
                           strona, re.S):
        tytul = re.search(r'<h3 class="t-entry-title[^"]*"[^>]*>(.*?)</h3>', blok, re.S)
        guid = re.search(r'data-guid="([^"]+)"', blok)
        if not (tytul and guid):
            continue
        nazwa = norm(re.sub(r"<[^>]+>", "", tytul.group(1)))
        # „comingsoon" to zaślepka producenta — pusty biały kwadrat z napisem.
        if "comingsoon" in guid.group(1):
            continue
        wynik.setdefault(nazwa, guid.group(1))
    return wynik


_pliki = {}


def wgraj(url, tytul):
    nazwa_pliku = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(re.sub(r"\?.*", "", url)))[:100]
    if nazwa_pliku in _pliki:
        return _pliki[nazwa_pliku]
    juz = api(f"/files?filter[filename_download][_eq]={urllib.parse.quote(nazwa_pliku)}"
              f"&fields=id&limit=1")["data"]
    if juz:
        _pliki[nazwa_pliku] = juz[0]["id"]
        return _pliki[nazwa_pliku]

    tmp = "/tmp/xo_" + nazwa_pliku
    r = subprocess.run(["curl", "-sL", "--max-time", "120", url, "-o", tmp], capture_output=True)
    # Sprawdzamy nagłówek pliku, nie sam rozmiar: serwer, który przestał
    # oddawać zdjęcia, potrafi zwrócić stronę HTML z komunikatem — i taki
    # dokument przechodził próg wielkości, a w Directusie zostawała ikona
    # zepsutego obrazka.
    if r.returncode != 0 or not os.path.exists(tmp):
        return None
    with open(tmp, "rb") as fh:
        naglowek = fh.read(12)
    obrazek = (naglowek.startswith(b"\x89PNG") or naglowek.startswith(b"\xff\xd8\xff")
               or naglowek.startswith(b"GIF8") or naglowek[8:12] == b"WEBP")
    if not obrazek:
        os.remove(tmp)
        print(f"    ! to nie jest obrazek: {url}")
        return None

    out = subprocess.run(["curl", "-s", "-X", "POST", f"{D}/files",
                          "-H", f"Authorization: Bearer {T}",
                          "-F", f"title={tytul[:140]}", "-F", f"file=@{tmp}"],
                         capture_output=True, text=True)
    os.remove(tmp)
    try:
        _pliki[nazwa_pliku] = json.loads(out.stdout)["data"]["id"]
    except Exception:
        print(f"    ! nie udało się wgrać {nazwa_pliku}: {out.stdout[:160]}")
        _pliki[nazwa_pliku] = None
    return _pliki[nazwa_pliku]


def main():
    zapis = "--zapis" in sys.argv
    strona = pobierz_strone("--odswiez" in sys.argv)
    zdjecia = katalog(strona)
    print(f"katalog producenta: {len(zdjecia)} pozycji ze zdjęciem")

    brakujace = [n for n in PARY if norm(n) not in zdjecia]
    if brakujace:
        print("  ! nie ma już na stronie: " + "; ".join(brakujace))

    # Nasze opcje: nazwa → lista id (ta sama pozycja stoi przy kilku łodziach).
    nasze = {}
    for slug in SLUGI:
        cfg = api(f"/items/configurators?filter[boat_model][slug][_eq]={slug}&fields=id&limit=1")["data"]
        if not cfg:
            continue
        grupy = api(f"/items/configurator_groups?filter[configurator][_eq]={cfg[0]['id']}"
                    f"&fields=id,options.id,options.name,options.image&limit=100")["data"]
        for g in grupy:
            for o in g.get("options") or []:
                nasze.setdefault(klucz(o["name"]), []).append(o)

    do_zrobienia, nietrafione = [], []
    for nazwa_xo, nasze_nazwy in PARY.items():
        url = zdjecia.get(norm(nazwa_xo))
        if not url:
            continue
        cele = []
        for n in nasze_nazwy:
            trafione = nasze.get(klucz(n)) or []
            if not trafione:
                nietrafione.append(n)
            cele += [o for o in trafione if not o.get("image")]
        if cele:
            do_zrobienia.append((nazwa_xo, url, cele))

    ile = sum(len(c) for _, _, c in do_zrobienia)
    print(f"do podpięcia: {ile} opcji z {len(do_zrobienia)} zdjęć")
    if nietrafione:
        print("  ! nie ma takiej opcji u nas: " + "; ".join(sorted(set(nietrafione))))
    if not zapis:
        for nazwa_xo, _, cele in do_zrobienia:
            print(f"    {nazwa_xo[:52]:<52} → {len(cele)}")
        print("\nPrzebieg na sucho — dodaj --zapis.")
        return

    for nazwa_xo, url, cele in do_zrobienia:
        plik = wgraj(url, f"XO — {nazwa_xo}")
        if not plik:
            continue
        for o in cele:
            api(f"/items/configurator_options/{o['id']}", "PATCH", {"image": plik})
        print(f"    {nazwa_xo[:52]:<52} → {len(cele)}")
    print("\nZapisane.")


if __name__ == "__main__":
    main()
