#!/bin/sh
set -eu
password=$(printf '%s' "$PULSECART_APP_PASSWORD" | sed "s/'/''/g")
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "ALTER ROLE pulsecart_app WITH PASSWORD '$password';"
