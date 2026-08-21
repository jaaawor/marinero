# Chatwoot — czat na stronie

Klient pisze w okienku na marinero.pl, nie wychodząc nigdzie i nie mając
WhatsAppa. Zespół odpowiada z jednej skrzynki: w przeglądarce albo z aplikacji
na telefonie (powiadomienia push). Chatwoot jest open source i stoi na naszym
VPS obok Directusa i Medusy — **nie ma opłat za wiadomość**.

Przycisk WhatsApp zostaje jako drugie wejście, dla tych, którzy wolą swój
komunikator. Dymek Chatwoota siada po **lewej** stronie, WhatsApp po prawej,
więc się nie zasłaniają.

## Instalacja (na VPS, jako root)

1. Wpis DNS: `chat.marinero.150197.pl` → adres IP serwera (rekord A).
2. `bash /opt/marinero-frontend/deploy/chatwoot/install.sh`

   Skrypt sam wygeneruje hasła i `SECRET_KEY_BASE`, ustawi nginx z WebSocketem,
   weźmie certyfikat i wystartuje kontenery. Można go uruchomić ponownie —
   istniejącego `.env` ani certyfikatu nie nadpisze.

3. Załóż pierwsze konto (polecenie wypisuje sam skrypt na końcu).
4. Panel → **Settings → Inboxes → Add Inbox → Website**. Podaj adres
   `https://marinero.pl`, nazwę „Marinero" i skopiuj **website token**.

## Włączenie widżetu na stronie

W środowisku frontu (`/opt/marinero-frontend/.env.local` na VPS):

```
CHATWOOT_URL=https://chat.marinero.150197.pl
CHATWOOT_TOKEN=<website token z panelu>
```

a potem przebuduj front: `bash /root/marinero-deploy.sh --force`. Sam restart
nie wystarczy — strona główna jest prerenderowana w czasie builda, więc plik
`.env.local` musi istnieć zanim ruszy `npm run build`.

Bez tych zmiennych `ChatwootWidget` nie renderuje niczego — strona działa
dokładnie tak jak dziś. To celowe: kod może iść na produkcję, zanim serwer
czatu w ogóle stanie.

## Gdy coś nie zadziała

- **`nginx -t` nie przechodzi, certbot odmawia** — konfiguracja z certyfikatem
  wskazuje na plik, którego jeszcze nie ma. Skrypt rozwiązuje to dwuetapowo:
  najpierw stawia serwer na samym porcie 80 z katalogiem na wyzwanie ACME,
  bierze certyfikat metodą `--webroot`, a dopiero potem wgrywa konfigurację
  z TLS. Wystarczy uruchomić skrypt ponownie.
- **`syntax error near unexpected token` przy `.env`** — pliku nie wolno
  wczytywać przez `source`; wartość `Marinero <info@marinero.pl>` powłoka
  bierze za przekierowanie. Docker Compose czyta go sam, skrypt już go
  nie sourcuje.
- **Wyzwanie ACME nie przechodzi** — sprawdź rekord A dla domeny. Skrypt
  porównuje go z adresem serwera i przerywa z czytelnym komunikatem.
- **Restart od zera** — `cd /opt/chatwoot && docker compose down -v`
  kasuje też bazę i załączniki. Sam `.env` zostaje, więc hasła się nie zmienią.

## Zasoby

Chatwoot to Rails + Sidekiq + Postgres + Redis — licz około **1,5 GB RAM**
i 5 GB dysku na start. Postgres jest osobny od tego, którego używa Directus,
żeby aktualizacja jednego nie ruszała drugiego.

## Kopie zapasowe

Do backupu wchodzą dwa wolumeny: `chatwoot_postgres` (rozmowy, kontakty)
i `chatwoot_storage` (załączniki). Jak reszta — kopie w `/opt/backups`,
nigdy w katalogu projektu.

## Później: WhatsApp w tej samej skrzynce

Chatwoot ma kanał WhatsApp (Cloud API). Uwaga na dwie rzeczy:

- numer podpięty do Cloud API **przestaje działać w zwykłej aplikacji
  WhatsApp Business** — od tego momentu odpisuje się z Chatwoota;
- rozmowę zaczętą przez firmę (a nie przez klienta) Meta liczy jako wiadomość
  szablonową i jest **płatna**; odpowiedzi w 24 h od wiadomości klienta są
  darmowe.

Dlatego na start zostawiamy własny widżet Chatwoota plus przycisk WhatsApp —
to nic nie kosztuje i pokrywa oba rodzaje klientów.
