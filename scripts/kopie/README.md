# Kopie zapasowe cen

Ceny żyją w dwóch miejscach naraz — w Medusie (sklep) i na Allegro — a zmienia
się je hurtem. Pomyłka w jednej kolumnie arkusza potrafi przestawić czterysta
pozycji i nie ma po niej śladu, z którego dałoby się wrócić.

## Zrobić kopię

```
cd /opt/marinero-frontend
node scripts/kopie/ceny.mjs
```

Sam odczyt. Zapisuje do `storage/kopie-cen/`:

- `ceny-<data>.json` — komplet, z tego przywraca `przywroc.mjs`,
- `ceny-<data>.csv` — do zerknięcia w Excelu (średnik i BOM, więc polski Excel
  otwiera go od razu w kolumnach).

`storage/` jest poza repozytorium i **przeżywa wdrożenia**: skrypt wdrożeniowy
robi `git reset --hard`, który nie rusza plików nieśledzonych.

Warto puścić to z crona raz na dobę:

```
0 3 * * * cd /opt/marinero-frontend && node scripts/kopie/ceny.mjs >> /var/log/marinero-kopie.log 2>&1
```

## Przywrócić

```
node scripts/kopie/przywroc.mjs storage/kopie-cen/ceny-2026-09-01-1435.json
```

**Domyślnie to podgląd** — wypisuje, co by zmienił, i nie rusza niczego.
Dopiero `--zapisz` zapisuje naprawdę:

```
node scripts/kopie/przywroc.mjs <plik> --zapisz
node scripts/kopie/przywroc.mjs <plik> --zapisz --tylko-sklep
node scripts/kopie/przywroc.mjs <plik> --zapisz --tylko-allegro
```

Przywracane są **tylko pozycje, które faktycznie się różnią**. Przy czterystu
produktach i trzech pomyłkowych zmianach idą trzy żądania, nie czterysta.

## Czego kopia nie obejmuje

Cen z konfiguratorów łodzi — te siedzą w Directusie (`configurator_options`)
i mają własną historię zmian w `directus_revisions`, z której da się je
odtworzyć w panelu.

## Uwaga o tokenie Allegro

Odczyt ofert wymaga wymiany refresh tokenu, a Allegro unieważnia stary przy
każdej wymianie. Oba skrypty zapisują nowy token do Directusa — bez tego
**sama kopia zapasowa położyłaby integrację**.
