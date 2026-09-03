# Nocny restart Medusy

## Po co

Po wyjęciu zdjęć spod Node'a (`wlacz.py`) Medusa przestała padać co pół
godziny, ale **nie przestała rosnąć**. 3 września proces przeżył
**18,5 godziny** i dopiero wtedy dobił do 2,75 GB przy limicie 3 GB:

```
Sep 03 13:58:00  Mark-Compact 2751.6 (3104.2) -> 2561.4 (3091.5) MB
Sep 03 13:58:00  FATAL ERROR: Ineffective mark-compacts near heap limit
Sep 03 13:58:07  Started marinero-commerce.service
```

Jeden pad na dobę zamiast czterech na półtorej godziny to zupełnie inna
sytuacja, ale ten jeden i tak wypadł **w środku dnia roboczego** — a każdy
taki pad to dziesięć sekund, w których nginx oddaje `502` na `/sklep`, a to,
co w tym oknie trafi do cache'u ISR, zostaje na stronie bez połowy sekcji.

Wyciek jest **w samej Medusie**, nie u nas: rośnie równo, bez związku
z ruchem, i nie mamy jak go naprawić w tym repozytorium. Zostaje więc
wybranie **momentu**, w którym proces wstaje od nowa — a skoro i tak ma
wstawać, niech to będzie czwarta rano, a nie druga po południu.

## Włączenie (raz, na VPS-ie)

```bash
crontab -l 2>/dev/null | grep -q "restart marinero-commerce" \
  || ( crontab -l 2>/dev/null; echo "0 4 * * * systemctl restart marinero-commerce" ) | crontab -
crontab -l | grep marinero-commerce
```

Druga linijka jest sprawdzeniem — ma wypisać dokładnie jeden wiersz.
Warunek `grep -q` pilnuje, żeby ponowne wklejenie nie dopisało drugiego
wpisu; godzina jest **lokalna serwera**, więc zmiana czasu niczego nie
rozjeżdża.

## Czego to NIE załatwia

Restart o 4:00 daje **18,5 godziny do 22:30** — czyli sklep dojeżdża
do końca dnia handlowego, ale przy złym dniu potrafi jeszcze mrugnąć
wieczorem. To świadomy kompromis: drugi restart w ciągu dnia byłby
przerwą w godzinach, w których ktoś kupuje, czyli lekarstwem gorszym
od choroby.

Gdyby to zaczęło przeszkadzać, są dwa wyjścia i **oba trzeba zmierzyć,
zanim się je włączy**:

- **więcej sterty** (`--max-old-space-size` w
  `marinero-commerce-pamiec.conf`, dziś 3072). Przy 4096 doba wchodzi
  z zapasem, ale serwer ma 8 GB i musi się w nich zmieścić także build
  frontu — a to on 31 sierpnia położył całą maszynę. Przed zmianą:
  `free -h` w trakcie `next build`;
- **restart po przekroczeniu progu** zamiast o stałej godzinie — wtedy
  w spokojny tydzień nie ma go wcale. Za to potrafi wypaść w południe,
  czyli dokładnie tam, skąd go zabieraliśmy.

## Sprawdzenie po dobie

```bash
journalctl -u marinero-commerce --since today | grep -c "heap out of memory"
systemctl show marinero-commerce -p ExecMainStartTimestamp
```

Zero padów i znacznik startu z 4:00 nad ranem znaczą, że działa.
