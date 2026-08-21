#!/usr/bin/env bash
# Instalacja Chatwoota na VPS. Uruchamiać jako root:
#
#   bash /opt/marinero-frontend/deploy/chatwoot/install.sh
#
# Skrypt jest bezpieczny do powtórzenia: nie nadpisuje istniejącego `.env`
# ani certyfikatu, a brakujące elementy uzupełnia.

set -euo pipefail

DOMAIN="${CHATWOOT_DOMAIN:-chat.marinero.150197.pl}"
EMAIL="${CERTBOT_EMAIL:-info@marinero.pl}"
TARGET="/opt/chatwoot"
WEBROOT="/var/www/certbot"
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▸ Chatwoot → $TARGET (domena: $DOMAIN)"

mkdir -p "$TARGET"
cp "$SOURCE/docker-compose.yml" "$TARGET/docker-compose.yml"

# --- .env -----------------------------------------------------------------
# UWAGA: tego pliku NIE wolno wczytywać przez `source` — wartości takie jak
# `Marinero <info@marinero.pl>` to dla powłoki przekierowanie. Docker Compose
# czyta go sam (i jako `env_file`, i do podstawień `${...}`), bo leży obok
# `docker-compose.yml`.

if [ ! -f "$TARGET/.env" ]; then
  echo "▸ generuję $TARGET/.env"
  cp "$SOURCE/env.example" "$TARGET/.env"
fi

# Uzupełniamy tylko puste wartości — przy powtórzeniu hasła zostają te same.
fill() {
  local key="$1" value="$2"
  if grep -qE "^${key}=$" "$TARGET/.env"; then
    sed -i "s|^${key}=$|${key}=${value}|" "$TARGET/.env"
    echo "  · uzupełniono ${key}"
  fi
}

REDIS_PASS="$(grep -E '^REDIS_PASSWORD=' "$TARGET/.env" | cut -d= -f2-)"
if [ -z "$REDIS_PASS" ]; then
  REDIS_PASS="$(openssl rand -hex 24)"
fi

fill SECRET_KEY_BASE "$(openssl rand -hex 64)"
fill POSTGRES_PASSWORD "$(openssl rand -hex 24)"
fill REDIS_PASSWORD "$REDIS_PASS"

# `REDIS_URL` z szablonu ma w sobie placeholder — podmieniamy na prawdziwe hasło.
if grep -q 'HASLO_REDIS' "$TARGET/.env"; then
  sed -i "s|HASLO_REDIS|${REDIS_PASS}|" "$TARGET/.env"
  echo "  · uzupełniono REDIS_URL"
fi

sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" "$TARGET/.env"
chmod 600 "$TARGET/.env"

# --- nginx, etap 1: sam port 80 -------------------------------------------
# Konfiguracja z `ssl_certificate` wskazującym na nieistniejący plik wywraca
# `nginx -t`, a wtedy nie działa ani nginx, ani certbot. Dlatego najpierw
# stawiamy serwer tylko po HTTP, z katalogiem na wyzwanie ACME.

mkdir -p "$WEBROOT/.well-known/acme-challenge"

if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "▸ nginx: tymczasowa konfiguracja na porcie 80"

  cat > "/etc/nginx/sites-available/$DOMAIN" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root $WEBROOT;
    }

    location / {
        return 200 'Chatwoot — instalacja w toku';
        add_header Content-Type text/plain;
    }
}
NGINX

  ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
  nginx -t && systemctl reload nginx

  # Miękkie sprawdzenie DNS — bez tego certbot wywala nieczytelny błąd
  # wyzwania ACME, a prawdziwym powodem jest brak rekordu A.
  DNS_IP="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
  HOST_IP="$(curl -s -m 10 https://api.ipify.org || true)"
  if [ -n "$DNS_IP" ] && [ -n "$HOST_IP" ] && [ "$DNS_IP" != "$HOST_IP" ]; then
    echo "  ! $DOMAIN wskazuje na $DNS_IP, a serwer ma $HOST_IP —"
    echo "    popraw rekord A i uruchom skrypt ponownie."
    exit 1
  fi

  echo "▸ certyfikat Let's Encrypt dla $DOMAIN"
  certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" \
    --non-interactive --agree-tos -m "$EMAIL"
else
  echo "▸ certyfikat dla $DOMAIN już jest — pomijam certbota"
fi

# --- nginx, etap 2: docelowa konfiguracja z TLS ---------------------------
echo "▸ nginx: konfiguracja docelowa (TLS + WebSocket)"
sed "s/chat\.marinero\.150197\.pl/$DOMAIN/g" "$SOURCE/nginx-chat.conf" \
  > "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t && systemctl reload nginx

# --- start ----------------------------------------------------------------
cd "$TARGET"
docker compose pull
docker compose run --rm rails bundle exec rails db:chatwoot_prepare
docker compose up -d

echo
echo "▸ gotowe. Panel: https://$DOMAIN"
echo
echo "  Pierwsze konto (wklej cały blok, zmień hasło):"
echo "    cd $TARGET && docker compose exec rails bundle exec rails runner \\"
echo "      \"u = User.create!(name: 'Marinero', email: 'info@marinero.pl', password: 'ZMIEN_TO'); \\"
echo "       u.confirm; a = Account.create!(name: 'Marinero'); \\"
echo "       AccountUser.create!(account: a, user: u, role: :administrator)\""
echo
echo "  Potem: Settings → Inboxes → Add Inbox → Website."
echo "  Skopiowany 'website token' wpisz w Directusie:"
echo "    Site Settings → chatwoot_url  = https://$DOMAIN"
echo "    Site Settings → chatwoot_token = <token>"
