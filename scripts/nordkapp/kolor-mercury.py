"""
Kolor silnika Mercury przy XO i Jeanneau.

Przy Nordkappie kolor przychodzi z cennika producenta razem z ceną (600 EUR
za biały). Przy XO i Jeanneau cennik go nie wymienia, ale dopłata jest ta sama,
więc zakładamy grupę ręcznie — mechanizm i zdjęcia są wspólne.

Grupa ma `engine_brand = mercury`: pokazuje się dopiero po wybraniu Mercury'ego,
a dopłata mnoży się przez liczbę silników.

Nie ruszamy XO EXPLR 44 — ta łódź ma własną grupę „Kolor silników" z cenami
z cennika (1500 EUR dla V10, 1800 dla V12), rozbitą na warianty silnikowe.
Pomijamy też XO EXPLR 10 Sport IB: to silniki stacjonarne, nie ma czego malować.

Uruchomienie:  python3 scripts/nordkapp/kolor-mercury.py [--zapis]
"""

import json, os, re, sys, time, urllib.request

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

BIALY_EUR = 600
# XO EXPLR 44 ma własną grupę koloru z cennika, XO EXPLR 10 Sport IB silniki
# stacjonarne, a Cap Camarat 12.5 WA jedyny wariant Mercury'ego już w bieli
# („3x Mercury 300HP Białe") — dopłata za biały byłaby tam liczona drugi raz.
POMIJAMY = {"xo-explr-44", "xo-explr-10-sport-ib", "jeanneau-cap-camarat-125-wa"}

# Zdjęcia wgrane już przy Nordkappie — te same silniki, więc nie dublujemy plików.
KADRY = {
    "duzy": {"czarny": "nk_verado-v8.jpg", "biały": "nk_verado-v8-white.jpg"},
    "maly": {"czarny": "nk_mercury-fourstroke-75-150hp.jpg", "biały": "nk_fourstroke-r4-white.jpg"},
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
            raise RuntimeError(f"{method} {path} → {e.code}: {e.read().decode()[:300]}") from None
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            if podejscie == prob - 1:
                raise
            time.sleep(2 ** podejscie)
    return {}


def plik(nazwa):
    d = api(f"/files?filter[filename_download][_eq]={urllib.parse.quote(nazwa)}&fields=id&limit=1")["data"]
    return d[0]["id"] if d else None


import urllib.parse  # noqa: E402  (po definicji api, żeby zachować kolejność czytania)


def main():
    zapis = "--zapis" in sys.argv
    kadry = {rozmiar: {k: plik(v) for k, v in warianty.items()}
             for rozmiar, warianty in KADRY.items()}

    cfg = api("/items/configurators?limit=-1&fields=id,slug,groups.id,groups.title,"
              "groups.sort,groups.engine_brand,groups.options.name")["data"]

    for c in sorted(cfg, key=lambda x: x["slug"]):
        if not (c["slug"].startswith("xo-") or c["slug"].startswith("jeanneau-")):
            continue
        if c["slug"] in POMIJAMY:
            continue
        # Tylko silniki spalinowe. „Mercury Avator 35e" to silnik elektryczny,
        # a wzmianka o Verado w opisie opcji dodatkowej to nie silnik w ogóle —
        # bez tego filtra kolor lądował przy łodziach, które nie mają czego malować.
        nazwy = [
            o["name"]
            for g in (c.get("groups") or [])
            if "silnik" in (g.get("title") or "").lower()
            and "elektryczn" not in (g.get("title") or "").lower()
            for o in (g.get("options") or [])
            if "mercury" in o["name"].lower()
            and [x for x in re.findall(r"\d{2,3}", o["name"]) if 40 <= int(x) <= 700]
        ]
        if not nazwy:
            continue
        if any(g.get("engine_brand") == "mercury" for g in c["groups"]):
            print(f"  {c['slug']:34} ma już grupę koloru Mercury")
            continue

        moce = [int(x) for n in nazwy for x in re.findall(r"\d{2,3}", n) if 40 <= int(x) <= 700]
        rozmiar = "duzy" if (max(moce) if moce else 0) >= 200 else "maly"
        print(f"  {c['slug']:34} Mercury {len(nazwy):2} szt., do {max(moce) if moce else '?'} KM → kadry „{rozmiar}\"")
        if not zapis:
            continue

        silnikowe = [int(g.get("sort") or 0) for g in c["groups"]
                     if "silnik" in (g.get("title") or "").lower()]
        pozycja = (max(silnikowe) if silnikowe else 0) + 1
        for g in c["groups"]:
            if int(g.get("sort") or 0) >= pozycja:
                api(f"/items/configurator_groups/{g['id']}", "PATCH",
                    {"sort": int(g.get("sort") or 0) + 1})

        gid = api("/items/configurator_groups", "POST", {
            "configurator": c["id"], "title": "Kolor silnika Mercury", "type": "radio",
            "sort": pozycja, "layout": "kafelki-pion", "engine_brand": "mercury",
        })["data"]["id"]
        for i, (kolor, cena) in enumerate([("czarny", 0), ("biały", BIALY_EUR)]):
            api("/items/configurator_options", "POST", {
                "group": gid,
                "name": f"Silnik w kolorze: {kolor}",
                "price": cena,
                "color": "#1a1a1a" if kolor == "czarny" else "#f2f2f2",
                "image": kadry[rozmiar][kolor],
                "selected": i == 0,
                "sort": i + 1,
            })

    if not zapis:
        print("\n(przebieg na sucho — nic nie zapisano; dodaj --zapis)")


if __name__ == "__main__":
    main()
