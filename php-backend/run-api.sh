#!/usr/bin/env bash

set -a
. /opt/portal/.secrets/postgres.env
. /opt/portal/.secrets/admin.env
set +a

export APP_HOST="${APP_HOST:-127.0.0.1}"
export APP_PORT="${APP_PORT:-5081}"
export COOKIE_SECURE="${COOKIE_SECURE:-true}"

PHP_BIN="${PHP_BIN:-$(command -v php)}"

cd /opt/portal/php-backend

mkdir -p storage/sessions
chmod 700 storage/sessions

"$PHP_BIN" bin/bootstrap.php
BOOTSTRAP_CODE=$?

echo "PHP BOOTSTRAP CODE: $BOOTSTRAP_CODE"

if [ "$BOOTSTRAP_CODE" -eq 0 ]; then
    export PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-4}"

    exec "$PHP_BIN" \
      -d expose_php=0 \
      -d display_errors=0 \
      -d log_errors=1 \
      -d error_log=/opt/portal/php-backend/storage/php-error.log \
      -S "${APP_HOST}:${APP_PORT}" \
      -t public \
      public/router.php
else
    echo "PHP backend не запущен: bootstrap завершился с ошибкой."
    sleep 30
fi
