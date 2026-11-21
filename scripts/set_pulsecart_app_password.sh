#!/bin/sh
set -eu

: "${PULSECART_APP_PASSWORD:?PULSECART_APP_PASSWORD must be set}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=app_password="$PULSECART_APP_PASSWORD" \
  --file=- <<'SQL'
ALTER ROLE pulsecart_app WITH PASSWORD :'app_password';
SQL
