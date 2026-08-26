"""
Pobranie cenników modeli Nordkappa ze strony producenta.

Każda strona modelu ma komplet danych w `<script id="model_boat">`. Zapisujemy
je do katalogu `dane/` (poza repozytorium — to migawka cennika, nie kod).

Uruchomienie:  python3 scripts/nordkapp/pobierz.py
"""

import json, os, re, subprocess, sys

MODELE = [
    "/boats/airborne/airborne-5-4/", "/boats/airborne/airborne-6-3/",
    "/boats/airborne/airborne-7/", "/boats/airborne/airborne-8/",
    "/boats/avant/avant-605/", "/boats/avant/avant-705/",
    "/boats/coupe/coupe-780/", "/boats/coupe/coupe-830/",
    "/boats/coupe/coupe-905/", "/boats/coupe/coupe-905-v12/",
    "/boats/enduro/enduro-605/", "/boats/enduro/enduro-705/",
    "/boats/enduro/enduro-805/", "/boats/enduro/enduro-830/",
    "/boats/noblesse/noblesse-660/", "/boats/noblesse/noblesse-720/",
    "/boats/noblesse/noblesse-830/",
]

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.environ.get("NORDKAPP_DANE", os.path.join(TU, "dane"))
os.makedirs(DANE, exist_ok=True)

for p in MODELE:
    slug = "nordkapp-" + p.strip("/").split("/")[-1]
    r = subprocess.run(["curl", "-s", "-A", "Mozilla/5.0", "--max-time", "120",
                        "https://www.nordkapp-boats.com" + p], capture_output=True, text=True)
    m = re.search(r'<script id="model_boat" type="application/json">\s*(\{.*?\})\s*</script>',
                  r.stdout, re.S)
    if not m:
        print(f"  ! {slug}: brak danych na stronie")
        continue
    d = json.loads(m.group(1))
    json.dump(d, open(os.path.join(DANE, slug + ".json"), "w"), ensure_ascii=False)
    ile = len(d.get("regionalAvailableAdditionalEquipment") or [])
    print(f"  {slug:28} {d.get('displayPriceFrom','?'):>12}  opcji: {ile}")
