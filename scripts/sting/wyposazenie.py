"""
Wyposażenie standardowe Stinga ze strony producenta.

Cennik odsyła po nie na stronę („Standard equipment listed on
www.sting-boats.com"), a strona trzyma je w znaczniku
`<script id="model_boat" type="application/json">` — dokładnie tak samo jak
Nordkapp, bo obie marki należą do Frydenbø i stoją na tym samym silniku.

Lista producenta jest krótka (9–16 pozycji na model) — tyle publikuje.
Dopisywanie własnych pozycji zostawiamy narzędziu `/admin/wyposazenie`.

Uruchomienie:  python3 scripts/sting/wyposazenie.py [--zapis] [--odswiez] [slug ...]
`--odswiez` pobiera strony na nowo; bez tego czyta migawki z `dane/strony/`.
"""

import html, json, os, re, subprocess, sys, time, urllib.error, urllib.request

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("STING_DANE", os.path.join(TU, "dane"))
STRONY = os.path.join(DANE, "strony")
NAZWY = json.load(open(os.path.join(TU, "wyposazenie.json"), encoding="utf-8"))["nazwy"]

ZRODLO = "https://www.sting-boats.no/en/boats/"

# Nasz slug → ścieżka modelu u producenta. Sting dzieli łodzie na „console"
# i „utility", więc samej nazwy modelu nie da się złożyć w adres.
MODELE = {
    "sting-470-pro": "utility-boat/470-pro",
    "sting-485-s": "console-boat/485-s",
    "sting-530-s": "console-boat/530-s",
    "sting-535-pro": "utility-boat/535-pro",
    "sting-580-s": "console-boat/580-s",
    "sting-580-t": "console-boat/580-t",
    "sting-600-pro": "utility-boat/600-pro",
    "sting-600-pro-ht": "utility-boat/600-pro-ht",
    "sting-725-pro": "utility-boat/725-pro",
    "sting-725-pro-cabin": "utility-boat/725-pro-cabin",
    "sting-725-pro-cabin-xl": "utility-boat/725-pro-cabin-xl",
    "sting-725-pro-ht": "utility-boat/725-pro-ht",
    "sting-725-pro-t-top": "utility-boat/725-pro-t-top",
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


def strona(slug, odswiez):
    os.makedirs(STRONY, exist_ok=True)
    plik = os.path.join(STRONY, slug + ".html")
    if odswiez or not os.path.exists(plik):
        r = subprocess.run(["curl", "-sL", "--max-time", "90",
                            ZRODLO + MODELE[slug] + "/", "-o", plik], capture_output=True)
        if r.returncode != 0 or not os.path.exists(plik):
            return ""
    return open(plik, encoding="utf-8", errors="replace").read()


def wyposazenie(tresc):
    """Pozycje z `model_boat.regionalEquipment`, po polsku."""
    m = re.search(r'<script id="model_boat" type="application/json">(.*?)</script>', tresc, re.S)
    if not m:
        return None
    dane = json.loads(html.unescape(m.group(1)))
    wynik, widziane = [], set()
    for e in (dane.get("regionalEquipment") or []):
        en = re.sub(r"\s+", " ", str(e.get("name") or "")).strip()
        if not en:
            continue
        pl = NAZWY.get(en)
        if not pl:
            print(f"    ! brak tłumaczenia: {en}")
            continue
        if pl in widziane:
            continue
        widziane.add(pl)
        wynik.append(pl)
    return wynik


def zapisz(slug, pozycje, zapis):
    model = api(f"/items/boat_models?filter[slug][_eq]={slug}&fields=id,name&limit=1")["data"]
    if not model:
        print(f"  – {slug}: nie ma takiego modelu w katalogu")
        return
    mid = model[0]["id"]
    stare = api(f"/items/equipment_groups?filter[boat_model][_eq]={mid}"
                f"&fields=id,title,items.id&limit=100")["data"]
    bylo = sum(len(g.get("items") or []) for g in stare)
    print(f"  {slug:<24} {len(pozycje):>3} poz. (było {bylo})")
    if not zapis or not pozycje:
        return

    # Najpierw wstawiamy komplet, dopiero potem kasujemy stare.
    gid = api("/items/equipment_groups", "POST",
              {"boat_model": mid, "title": "Wyposażenie standardowe", "sort": 1})["data"]["id"]
    for i, tekst in enumerate(pozycje):
        api("/items/equipment_items", "POST", {"group": gid, "text": tekst, "sort": i + 1})
    for g in stare:
        for o in g.get("items") or []:
            api(f"/items/equipment_items/{o['id']}", "DELETE")
        api(f"/items/equipment_groups/{g['id']}", "DELETE")


def main():
    zapis = "--zapis" in sys.argv
    odswiez = "--odswiez" in sys.argv
    wybrane = [a for a in sys.argv[1:] if not a.startswith("--")]
    for slug in MODELE:
        if wybrane and slug not in wybrane:
            continue
        tresc = strona(slug, odswiez)
        if not tresc:
            print(f"  ! {slug}: nie udało się pobrać strony producenta")
            continue
        pozycje = wyposazenie(tresc)
        if pozycje is None:
            print(f"  ! {slug}: na stronie nie ma danych modelu")
            continue
        zapisz(slug, pozycje, zapis)
    print("\n" + ("Zapisane." if zapis else "Przebieg na sucho — dodaj --zapis."))


if __name__ == "__main__":
    main()
