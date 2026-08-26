"""
Kolor silnika Suzuki w konfiguratorach.

Suzuki sprzedaje te same silniki w wersji białej i czarnej — u nas widać to
w sklepie, gdzie każdy model stoi w obu kolorach z własnym zdjęciem. Skrypt
zakłada przy każdej łodzi z silnikami Suzuki grupę „Kolor silnika Suzuki":
grupa pokazuje się dopiero po wybraniu Suzuki, a przy „2x Suzuki…" dopłata
liczy się dwa razy (`configurator_groups.engine_brand`).

Ceny zostawiamy na 0 — w cenniku dealerskim kolor nie jest osobno wyceniony,
a różnice widoczne w sklepie to różnice między modelami, nie dopłata za lakier.
Jeśli dopłata istnieje, wpisuje się ją przy opcji w Directusie.

Uruchomienie:  python3 scripts/nordkapp/kolor-suzuki.py [--zapis]
"""

import json, os, re, subprocess, sys, time, urllib.parse, urllib.request

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

SKLEP = os.environ.get("MEDUSA_URL", "https://commerce.marinero.150197.pl")
KLUCZ = os.environ.get(
    "MEDUSA_KEY", "pk_32276a7735ff8cd65c842044030f1e3e6eb82d240643db0a2901de5d4a4f7fd2"
)


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
            raise RuntimeError(f"{method} {path} → {e.code}: {e.read().decode()[:300]}") from None
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            if podejscie == prob - 1:
                raise
            time.sleep(2 ** podejscie)
    return {}


def sklep(path):
    req = urllib.request.Request(SKLEP + path, headers={"x-publishable-api-key": KLUCZ})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def zdjecia_suzuki():
    """Pary zdjęć biały/czarny z naszego sklepu, po mocy silnika."""
    pary = {}
    for strona in range(0, 8):
        d = sklep(f"/store/products?limit=100&offset={strona * 100}&fields=id,title,thumbnail")
        produkty = d.get("products", [])
        if not produkty:
            break
        for p in produkty:
            m = re.match(r"^Suzuki DF ?(\d+(?:\.\d+)?)\s.*\s(Biały|Czarny)$", p["title"])
            if not m or not p.get("thumbnail"):
                continue
            moc = float(m.group(1))
            pary.setdefault(moc, {}).setdefault(m.group(2), p["thumbnail"])
    return {moc: v for moc, v in pary.items() if "Biały" in v and "Czarny" in v}


_pliki = {}


def wgraj(url, tytul):
    if not url:
        return None
    nazwa = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(url.split("?")[0]))[:100]
    if nazwa in _pliki:
        return _pliki[nazwa]
    juz = api(f"/files?filter[filename_download][_eq]={urllib.parse.quote(nazwa)}&fields=id&limit=1")["data"]
    if juz:
        _pliki[nazwa] = juz[0]["id"]
        return _pliki[nazwa]
    tmp = "/tmp/sz_" + nazwa
    r = subprocess.run(["curl", "-sL", "--max-time", "120", url, "-o", tmp], capture_output=True)
    if r.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) < 3000:
        _pliki[nazwa] = None
        return None
    out = subprocess.run(["curl", "-s", "-X", "POST", f"{D}/files",
                          "-H", f"Authorization: Bearer {T}",
                          "-F", f"title={tytul[:140]}", "-F", f"file=@{tmp}"],
                         capture_output=True, text=True)
    os.remove(tmp)
    try:
        _pliki[nazwa] = json.loads(out.stdout)["data"]["id"]
    except Exception:
        _pliki[nazwa] = None
    return _pliki[nazwa]


def moc_suzuki(nazwy):
    moce = [int(x) for n in nazwy for x in re.findall(r"\d{2,3}", n) if 4 <= int(x) <= 400]
    return max(moce) if moce else 0


def main():
    zapis = "--zapis" in sys.argv
    pary = zdjecia_suzuki()
    print("par zdjęć biały/czarny w sklepie:", len(pary))

    cfg = api("/items/configurators?limit=-1&fields=id,slug,groups.id,groups.title,"
              "groups.sort,groups.engine_brand,groups.options.name")["data"]

    for c in sorted(cfg, key=lambda x: x["slug"]):
        nazwy = [o["name"] for g in (c.get("groups") or []) for o in (g.get("options") or [])
                 if "suzuki" in o["name"].lower()]
        if not nazwy:
            continue
        if any("suzuki" in (g.get("title") or "").lower() and "kolor" in (g.get("title") or "").lower()
               for g in c["groups"]):
            print(f"  {c['slug']:28} ma już grupę koloru Suzuki")
            continue

        moc = moc_suzuki(nazwy)
        blisko = min(pary, key=lambda m: abs(m - moc)) if pary else None
        print(f"  {c['slug']:28} Suzuki {len(nazwy):2} szt., moc do {moc} KM → zdjęcia z {blisko} KM")
        if not zapis or not blisko:
            continue

        # Kolor stoi zaraz za wyborem silnika, nie na końcu listy — inaczej
        # klient trafiał na niego dopiero pod całym wyposażeniem dodatkowym.
        # Numeracja grup w konfiguratorach jest różna, więc bierzemy pozycję
        # ostatniej grupy silnikowej i przesuwamy resztę o jeden w dół.
        silnikowe = [int(g.get("sort") or 0) for g in c["groups"]
                     if "silnik" in (g.get("title") or "").lower()]
        pozycja = (max(silnikowe) if silnikowe else 0) + 1
        for g in c["groups"]:
            if int(g.get("sort") or 0) >= pozycja:
                api(f"/items/configurator_groups/{g['id']}", "PATCH",
                    {"sort": int(g.get("sort") or 0) + 1})
        gid = api("/items/configurator_groups", "POST", {
            "configurator": c["id"], "title": "Kolor silnika Suzuki", "type": "radio",
            "sort": pozycja, "layout": "kafelki-pion", "engine_brand": "suzuki",
        })["data"]["id"]
        for i, kolor in enumerate(["Biały", "Czarny"]):
            api("/items/configurator_options", "POST", {
                "group": gid,
                "name": f"Silnik w kolorze: {kolor.lower()}",
                "price": 0,
                "color": "#f2f2f2" if kolor == "Biały" else "#1a1a1a",
                "image": wgraj(pary[blisko][kolor], f"Suzuki {kolor.lower()}"),
                "selected": i == 0,
                "sort": i + 1,
            })

    if not zapis:
        print("\n(przebieg na sucho — nic nie zapisano; dodaj --zapis)")


if __name__ == "__main__":
    main()
