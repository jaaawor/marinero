"""
Wyposażenie standardowe XO z arkusza „Boat Standard".

Producent układa je w skoroszycie w dwóch kolumnach, z nagłówkami sekcji
zapisanymi pogrubieniem („Hull", „Deck", „Pilothouse"). Czytamy najpierw całą
kolumnę B, potem C — tak, jak się to czyta na papierze: kolumna obok jest
dalszym ciągiem tej samej listy, nie osobną tabelą.

Nazwy tłumaczy `wyposazenie.json`; brak tłumaczenia zgłaszamy, bo angielska
pozycja na polskiej stronie modelu rzuca się w oczy bardziej niż jej brak.

Uruchomienie:  python3 scripts/xo/wyposazenie.py [--zapis] [slug ...]
"""

import json, os, re, sys, time, urllib.error, urllib.request, zipfile
from html import unescape

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("XO_DANE", os.path.join(TU, "dane"))
NAZWY = json.load(open(os.path.join(TU, "wyposazenie.json"), encoding="utf-8"))["nazwy"]

# Nazwa łodzi z arkusza → nasz slug. „10S+" przed „10S", bo pierwszy wzorzec wygrywa.
SLUGI = [
    (re.compile(r"EXPLR\s*10S\s*\+", re.I), "xo-explr-10plus-sport"),
    (re.compile(r"EXPLR\s*10S", re.I), "xo-explr-10"),
    (re.compile(r"EXPLR\s*9", re.I), "xo-explr-9"),
    (re.compile(r"EXPLR\s*44", re.I), "xo-explr-44"),
    (re.compile(r"DFNDR\s*8", re.I), "xo-dfndr-8"),
    (re.compile(r"DFNDR\s*9", re.I), "xo-dfndr-9"),
]

STOPKA = re.compile(r"Standard Equipment|Season |^Note:|informational purposes", re.I)


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


def pogrubione(z):
    """Które style komórek są pogrubione — po tym poznajemy nagłówki sekcji."""
    style = z.read("xl/styles.xml").decode()
    fonty = re.search(r"<fonts[^>]*>(.*?)</fonts>", style, re.S).group(1)
    bold = [("<b/>" in f) for f in re.findall(r"<font>(.*?)</font>", fonty, re.S)]
    xfs = re.search(r"<cellXfs[^>]*>(.*?)</cellXfs>", style, re.S).group(1)
    wynik = []
    for xf in re.findall(r"<xf\b[^>]*>", xfs):
        m = re.search(r'fontId="(\d+)"', xf)
        wynik.append(bold[int(m.group(1))] if m and int(m.group(1)) < len(bold) else False)
    return wynik


def czytaj(sciezka):
    """Arkusz „Boat Standard" → (nazwa łodzi, [(nagłówek?, tekst), …])."""
    z = zipfile.ZipFile(sciezka)
    arkusze = re.findall(r'<sheet name="([^"]+)"', z.read("xl/workbook.xml").decode())
    numer = next((i for i, n in enumerate(arkusze, 1) if "standard" in n.lower()), 0)
    if not numer:
        return "", []
    teksty = [unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", s, re.S)))
              for s in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S)]
    bold = pogrubione(z)
    arkusz = z.read(f"xl/worksheets/sheet{numer}.xml").decode()

    kolumny, tytul = {}, ""
    for rnum, body in re.findall(r"<row[^>]*r=\"(\d+)\"[^>]*>(.*?)</row>", arkusz, re.S):
        for ref, atrybuty, srodek in re.findall(
                r"<c r=\"([A-Z]+)\d+\"([^>]*)(?:/>|>(.*?)</c>)", body, re.S):
            typ = re.search(r't="([^"]+)"', atrybuty)
            styl = re.search(r's="(\d+)"', atrybuty)
            liczba = re.search(r"<v>(.*?)</v>", srodek or "")
            wartosc = liczba.group(1) if liczba else ""
            if typ and typ.group(1) == "s" and wartosc.isdigit():
                wartosc = teksty[int(wartosc)]
            wartosc = re.sub(r"\s+", " ", wartosc.replace("\xa0", " ")).strip()
            if not wartosc:
                continue
            if "Standard Equipment" in wartosc and not tytul:
                tytul = wartosc
            if STOPKA.search(wartosc):
                continue
            czy_naglowek = bool(styl and int(styl.group(1)) < len(bold) and bold[int(styl.group(1))])
            kolumny.setdefault(ref, []).append((int(rnum), wartosc, czy_naglowek))

    kolejno = []
    for kolumna in ("B", "C", "D"):
        kolejno += [x for x in sorted(kolumny.get(kolumna, []))]
    return tytul, [(naglowek, tekst) for _, tekst, naglowek in kolejno]


def grupy(pozycje):
    """Sekcje z nagłówkami. Pozycje przed pierwszym nagłówkiem dostają własną grupę."""
    out, biezaca = [], None
    for naglowek, tekst in pozycje:
        pl = NAZWY.get(tekst)
        if not pl:
            print(f"    ! brak tłumaczenia: {tekst[:90]}")
            continue
        if naglowek:
            biezaca = {"tytul": pl, "pozycje": []}
            out.append(biezaca)
            continue
        if biezaca is None:
            biezaca = {"tytul": "Wyposażenie standardowe", "pozycje": []}
            out.append(biezaca)
        biezaca["pozycje"].append(pl)
    return [g for g in out if g["pozycje"]]


def zapisz(slug, sekcje, zapis):
    model = api(f"/items/boat_models?filter[slug][_eq]={slug}&fields=id&limit=1")["data"]
    if not model:
        print(f"  – {slug}: nie ma takiego modelu")
        return
    mid = model[0]["id"]
    stare = api(f"/items/equipment_groups?filter[boat_model][_eq]={mid}"
                f"&fields=id,title,items.id&limit=100")["data"]
    razem = sum(len(g["pozycje"]) for g in sekcje)
    print(f"\n{slug}: {len(sekcje)} sekcji, {razem} pozycji "
          f"(było {len(stare)} gr., {sum(len(g.get('items') or []) for g in stare)} poz.)")
    for g in sekcje:
        print(f"    {g['tytul']} — {len(g['pozycje'])}")
    if not zapis:
        return

    # Najpierw wstawiamy komplet, dopiero potem kasujemy stare — urwane
    # połączenie w środku zostawia nadmiar, nie pustkę.
    for i, g in enumerate(sekcje):
        gid = api("/items/equipment_groups", "POST",
                  {"boat_model": mid, "title": g["tytul"], "sort": i + 1})["data"]["id"]
        for j, tekst in enumerate(g["pozycje"]):
            api("/items/equipment_items", "POST", {"group": gid, "text": tekst, "sort": j + 1})
    for g in stare:
        for o in g.get("items") or []:
            api(f"/items/equipment_items/{o['id']}", "DELETE")
        api(f"/items/equipment_groups/{g['id']}", "DELETE")


def main():
    zapis = "--zapis" in sys.argv
    wybrane = [a for a in sys.argv[1:] if not a.startswith("--")]
    for plik in sorted(os.listdir(DANE)):
        if not plik.endswith(".xlsx"):
            continue
        tytul, pozycje = czytaj(os.path.join(DANE, plik))
        slug = next((s for wzor, s in SLUGI if wzor.search(tytul)), "")
        if not slug:
            print(f"  ! {plik}: nie wiem, która to łódź (\u201e{tytul}\u201d)")
            continue
        if wybrane and slug not in wybrane:
            continue
        zapisz(slug, grupy(pozycje), zapis)
    print("\n" + ("Zapisane." if zapis else "Przebieg na sucho — dodaj --zapis."))


if __name__ == "__main__":
    main()
