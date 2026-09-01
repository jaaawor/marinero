# Reset hasła klienta

Front ma całą ścieżkę gotową:

1. `/sklep/konto/reset` — klient podaje adres, front woła Medusę
   (`POST /auth/customer/emailpass/reset-password`).
2. mail z odnośnikiem — wysyła go front, `POST /api/konto/reset-mail`.
3. `/sklep/konto/nowe-haslo?token=…&email=…` — klient ustawia hasło, front woła
   Medusę (`POST /auth/customer/emailpass/update`) i od razu go loguje.

Brakuje **jednego ogniwa po stronie Medusy** i bez niego krok 2 nigdy nie
nastąpi: Medusa na `reset-password` odpowiada `201 Created` **bez tokenu**
i emituje zdarzenie `auth.password_reset` wewnątrz swojego kontenera. Token
nie wychodzi na zewnątrz i nie da się go wyliczyć u nas — podpisuje go klucz,
którego front nie zna (i nie powinien znać).

Sprawdzone na żywym API (`https://commerce.marinero.150197.pl`):

| Żądanie | Odpowiedź |
| --- | --- |
| `POST /auth/customer/emailpass/reset-password` `{identifier}` | `201`, pusta treść |
| `POST /auth/customer/emailpass/update` z tokenem sesji | `401 {"type":"unauthorized","message":"Invalid token"}` |
| logowanie starym hasłem po tym wszystkim | `200` — nic się nie zmieniło |

## Co zrobić na VPS-ie

1. Skopiować `haslo-reset.ts` do projektu Medusy:

   ```bash
   cp haslo-reset.ts /opt/marinero/src/subscribers/haslo-reset.ts
   ```

   (Jeśli katalog `src/subscribers` nie istnieje — założyć go.)

2. Wymyślić wspólny sekret, np.:

   ```bash
   openssl rand -hex 32
   ```

3. Wpisać go **w dwóch miejscach**:

   - Medusa (`/opt/marinero/.env` albo `environment:` w `docker-compose.yml`):

     ```
     MARINERO_URL=https://marinero.pl
     MARINERO_RESET_KEY=<sekret>
     ```

   - front (`/opt/marinero-frontend/.env.local`):

     ```
     RESET_HOOK_TOKEN=<ten sam sekret>
     ```

4. Przebudować i wystartować oba:

   ```bash
   cd /opt/marinero && docker compose up -d --build
   bash /root/marinero-deploy.sh --force
   ```

   Front musi iść przez `--force`, bo zmienne środowiskowe wchodzą **przed
   buildem** — sam restart usługi nic nie da.

## Kiedy zadziała, a kiedy nie

- Bez `RESET_HOOK_TOKEN` końcówka `/api/konto/reset-mail` odpowiada `503`
  i nie wysyła niczego. To celowo: otwarta pozwalałaby komukolwiek wysyłać
  z naszej skrzynki listy „zresetuj hasło" z linkiem własnego wyrobu.
- Bez SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) wraca
  `email_skipped_no_smtp` — ten sam stan co przy ofertach i zamówieniach.
- Formularz „Nie pamiętam hasła" **działa już teraz** i zawsze mówi to samo
  („jeśli mamy konto na ten adres, wysłaliśmy odnośnik"), niezależnie od tego,
  czy konto istnieje i czy mail wyszedł. Inaczej odpowiadałby na pytanie
  „które adresy mają u was konto".

## Zanim to stanie

Dopóki subskrybenta nie ma, klient bez hasła pisze na `biuro@marinero.pl` —
tak też mówi mu ekran po wysłaniu formularza.
