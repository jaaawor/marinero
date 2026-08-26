"""
Opisy modeli Stinga.

Dziesięć z trzynastu łodzi nie miało u nas żadnego opisu, a przy dwóch stało
coś gorszego niż nic: przy 485 S wklejone wyposażenie standardowe („Gniazdo
12V - Antifouling - Konsola z ramą…"), przy 530 S zdanie „Strona zostanie
uzupełniona".

Teksty leżą w `opisy.json` — napisane po polsku na podstawie materiałów
producenta i naszych danych technicznych, a nie tłumaczone słowo w słowo:
strona Stinga opisuje każdą łódź kilkoma ekranami tekstu, a u nas opis ma
zachęcić do obejrzenia zdjęć i konfiguratora.

Wchodzą do `short_description`, bo właśnie stamtąd strona modelu bierze
zajawkę w kadrze otwierającym i sekcję „Opis" pod spodem.

Uruchomienie:  python3 scripts/sting/opisy.py [--zapis] [slug ...]
"""

import json, os, sys, time, urllib.error, urllib.request

D = os.environ.get("DIRECTUS_URL", "https://dms.marinero.150197.pl")
T = os.environ.get("DIRECTUS_TOKEN", "")
if not T:
    sys.exit("Ustaw DIRECTUS_TOKEN w zmiennych środowiskowych.")

TU = os.path.dirname(os.path.abspath(__file__))
OPISY = json.load(open(os.path.join(TU, "opisy.json"), encoding="utf-8"))["opisy"]


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


def main():
    zapis = "--zapis" in sys.argv
    wybrane = [a for a in sys.argv[1:] if not a.startswith("--")]
    for slug, tekst in OPISY.items():
        if wybrane and slug not in wybrane:
            continue
        model = api(f"/items/boat_models?filter[slug][_eq]={slug}"
                    f"&fields=id,short_description,description&limit=1")["data"]
        if not model:
            print(f"  – {slug}: nie ma takiego modelu")
            continue
        bylo = (model[0].get("short_description") or "").strip()
        print(f"  {slug:<24} {len(bylo):>4} → {len(tekst)} zn.")
        if not zapis:
            continue
        pola = {"short_description": tekst}
        # Stary `description` bywa śmieciem z importu ze starej strony (bloki
        # HTML WordPressa). Skoro opis idzie do `short_description`, ten drugi
        # tylko myli w panelu.
        stary = (model[0].get("description") or "").strip()
        if "wp-block" in stary or "Strona zostanie uzupełniona" in stary:
            pola["description"] = None
        api(f"/items/boat_models/{model[0]['id']}", "PATCH", pola)
    print("\n" + ("Zapisane." if zapis else "Przebieg na sucho — dodaj --zapis."))


if __name__ == "__main__":
    main()
