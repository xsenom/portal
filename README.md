# Portal

Корпоративный портал для управления пользователями, задачами, рабочим временем и показателями.

## Состав репозитория

- `frontend/` — интерфейс на Next.js.
- `php-backend/` — основной backend на PHP 8.3 и PHP-FPM.

Старый backend на .NET в репозиторий не включён.

## Production

- Frontend: `127.0.0.1:3020`
- PHP-FPM: `127.0.0.1:5082`
- Домен: `https://test.xsenom.ru`
- API prefix: `/api/portal/`

## Секреты

Секреты хранятся только на сервере:

- `/opt/portal/.secrets/postgres.env`
- `/opt/portal/.secrets/admin.env`

Секреты, сессии, логи и production-сборки не добавляются в Git.

## Проверка API

```bash
curl -i https://test.xsenom.ru/api/portal/health
```

Ожидаемый HTTP-код: `200`.
