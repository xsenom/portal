# Portal PHP backend

Полная PHP 8.2+ замена `/opt/portal/backend/Portal.Api` с сохранением API-контрактов frontend.

## Требования

- PHP 8.2 или новее
- расширения `pdo_pgsql`, `json`, `openssl`
- PostgreSQL
- переменные из `/opt/portal/.secrets/postgres.env` и `/opt/portal/.secrets/admin.env`

## Совместимость

- Все 27 маршрутов `/api/portal/...` сохранены.
- Имена JSON-полей и HTTP-коды повторяют .NET-версию.
- Используется та же PostgreSQL-база.
- Пароли создаются и проверяются в формате ASP.NET Core Identity V3. Это позволяет входить со старыми паролями и безопасно откатываться на .NET.
- Cookie сохраняет имя `portal.auth`, но старые ASP.NET cookie нельзя расшифровать в PHP. После переключения пользователю потребуется один повторный вход.

## Параллельный запуск

По умолчанию `run-api.sh` запускает PHP API на `127.0.0.1:5081`, не затрагивая .NET API на `5080`.

Встроенный PHP HTTP-сервер используется только для этапа параллельной проверки. После подтверждения контрактов рекомендуется перевести приложение на PHP-FPM.

## Проверки

```bash
find . -type f -name '*.php' -print0 | xargs -0 -n1 php -l
php tests/password_compat.php
```
