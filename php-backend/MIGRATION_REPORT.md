# Отчёт о переносе Portal.Api на PHP

## Исходная система

- .NET backend: `/opt/portal/backend/Portal.Api`
- PostgreSQL через прямые SQL-запросы Npgsql
- Cookie-аутентификация `portal.auth`, срок 30 дней
- frontend обращается к `/api/portal/...`

## Реализованные маршруты

### Авторизация и пользователи

- `GET /api/portal/health`
- `POST /api/portal/auth/register`
- `POST /api/portal/auth/login`
- `POST /api/portal/auth/logout`
- `GET /api/portal/auth/me`
- `GET /api/portal/admin/users`
- `GET /api/portal/admin/users/{id}`
- `PUT /api/portal/admin/users/{id}`

### Задачи и показатели

- `GET /api/portal/tasks`
- `POST /api/portal/tasks/{id}/start`
- `POST /api/portal/tasks/{id}/decline`
- `POST /api/portal/tasks/{id}/submit`
- `GET /api/portal/indicators/me`
- `GET /api/portal/admin/tasks`
- `POST /api/portal/admin/tasks`
- `POST /api/portal/admin/tasks/{id}/approve`
- `POST /api/portal/admin/tasks/{id}/reject`
- `GET /api/portal/admin/users/{id}/pay-settings`
- `PUT /api/portal/admin/users/{id}/pay-settings`
- `POST /api/portal/admin/users/{id}/events`
- `GET /api/portal/admin/users/{id}/indicators`
- `POST /api/portal/admin/users/{id}/indicators/recalculate`

### Учёт времени

- `GET /api/portal/time/dashboard`
- `POST /api/portal/time/start`
- `POST /api/portal/time/pause`
- `POST /api/portal/time/resume`
- `POST /api/portal/time/finish`

## Совместимость

- Сохранены пути, методы, основные HTTP-коды, русские сообщения об ошибках и camelCase JSON.
- Сохранена работа с существующими таблицами PostgreSQL.
- Реализована проверка Identity V2/V3 и генерация Identity V3-хешей. Новые и изменённые в PHP пароли останутся совместимыми с .NET при откате.
- Сессии PHP хранятся серверно, cookie имеет прежнее имя `portal.auth`. Существующую зашифрованную .NET-cookie PHP расшифровать не может, поэтому после переключения потребуется один повторный вход.

## Проверки до подключения к рабочей БД

- PHP lint: пройден для всех файлов.
- Самотест генерации и проверки паролей: пройден.
- Проверка известного ASP.NET Identity V3-хеша: пройдена.
- HTTP health: `200`.
- Защищённые маршруты без cookie: `401`.
- Неизвестный маршрут: `404`.

## Что требует проверки на сервере

- наличие `pdo_pgsql`;
- запуск bootstrap на копии/рабочей схеме;
- вход существующего пользователя;
- сравнение JSON .NET:5080 и PHP:5081;
- только после этого переключение Nginx.
