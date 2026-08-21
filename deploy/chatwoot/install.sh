#!/usr/bin/env bash
# Instalacja Chatwoota na VPS. Uruchamiać jako root:
#
#   bash /opt/marinero-frontend/deploy/chatwoot/install.sh
#
# Skrypt jest bezpieczny do powtórzenia — nie nadpisuje istniejącego `.env`
# ani certyfikatu.

set -euo pipefail

DOMAIN="${CHATWOOT_DOMAIN:-chat.marinero.150197.pl}"
TARGET="/opt/chatwoot"
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▸ Chatwoot → $TARGET (domena: $DOMAIN)"

mkdir -p "$TARGET"
cp "$SOURCE/docker-compose.yml" "$TARGET/docker-compose.yml"

# --- .env: hasła generujemy raz i zostawiamy w spokoju --------------------
if [ ! -f "$TARGET/.env" ]; then
  echo "▸ generuję $TARGET/.env"

  SECRET="$(openssl rand -hex 64)"
  PG_PASS="$(openssl rand -hex 24)"
  REDIS_PASS="$(openssl rand -hex 24)"

  sed \
    -e "s|^SECRET_KEY_BASE=.*|SECRET_KEY_BASE=$SECRET|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG_PASS|" \
    -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_PASS|" \
    -e "s|^REDIS_URL=.*|REDIS_URL=redis://:$REDIS_PASS@redis:6379|" \
    -e "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" \
    "$SOURCE/env.example" > "$TARGET/.env"

  chmod 600 "$TARGET/.env"
else
  echo "▸ $TARGET/.env już istnieje — zostawiam"
fi

# docker compose czyta hasła kontenerów z tego samego pliku
set -a && . "$TARGET/.env" && set +a

# --- nginx + certyfikat ---------------------------------------------------
if [ ! -f "/etc/nginx/sites-available/$DOMAIN" ]; then
  echo "▸ konfiguracja nginx"
  sed "s/chat.marinero.150197.pl/$DOMAIN/g" "$SOURCE/nginx-chat.conf" \
    > "/etc/nginx/sites-available/$DOMAIN"
  ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
fi

if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "▸ certyfikat Let's Encrypt (wymaga wpisu A dla $DOMAIN)"
  certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m info@marinero.pl
fi

nginx -t && systemctl reload nginx

# --- start ----------------------------------------------------------------
cd "$TARGET"
docker compose pull
docker compose run --rm rails bundle exec rails db:chatwoot_prepare
docker compose up -d

echo
echo "▸ gotowe. Panel: https://$DOMAIN"
echo "  Pierwsze konto zakłada się poleceniem:"
echo "    cd $TARGET && docker compose exec rails bundle exec rails c"
echo "    > u = User.new(name: 'Marinero', email: 'info@marinero.pl', password: 'ZMIEN_TO')"
echo "    > u.skip_confirmation!; u.save!"
echo "    > a = Account.create!(name: 'Marinero'); AccountUser.create!(account: a, user: u, role: :administrator)"
echo
echo "  Potem: Settings → Inboxes → Add Inbox → Website, i skopiuj `websiteToken`"
echo "  do zmiennych frontu (CHATWOOT_TOKEN)."
