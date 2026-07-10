#!/usr/bin/env bash

set -a
. /opt/portal/.secrets/postgres.env
. /opt/portal/.secrets/admin.env
set +a

export COOKIE_SECURE=true

TARGET="/opt/portal/php-backend"
FPM_BIN="/usr/sbin/php-fpm8.3"

cd "$TARGET"

mkdir -p storage/sessions
chown -R portalphp:portalphp storage
chmod 700 storage storage/sessions

php bin/bootstrap.php
BOOTSTRAP_CODE=$?

echo "PHP FPM BOOTSTRAP CODE: $BOOTSTRAP_CODE"

if [ "$BOOTSTRAP_CODE" -eq 0 ]; then
    exec "$FPM_BIN" \
      -F \
      -y "$TARGET/fpm/php-fpm.conf"
else
    echo "PHP-FPM не запущен: bootstrap завершился с ошибкой."
    sleep 30
fi
