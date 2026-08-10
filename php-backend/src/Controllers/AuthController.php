<?php

declare(strict_types=1);

namespace Portal\Controllers;

use PDOException;
use Portal\AspNetPasswordHasher;
use Portal\Auth;
use Portal\Database;
use Portal\HttpResponse;
use Portal\Mapper;
use Portal\Request;
use Portal\Values;

final class AuthController
{
    public static function register(Request $request): HttpResponse
    {
        $body = $request->json();
        $login = Values::string($body, 'login');
        $email = Values::string($body, 'email');
        $firstName = Values::string($body, 'firstName');
        $lastName = Values::string($body, 'lastName');
        $middleName = Values::nullableString($body, 'middleName');
        $password = Values::string($body, 'password');

        if (Values::length($login) < 3) {
            return HttpResponse::json(['message' => 'Логин должен содержать не менее 3 символов'], 400);
        }

        if ($email === '' || !str_contains($email, '@')) {
            return HttpResponse::json(['message' => 'Введите корректный e-mail'], 400);
        }

        if (Values::length($firstName) < 2 || Values::length($lastName) < 2) {
            return HttpResponse::json(['message' => 'Введите имя и фамилию'], 400);
        }

        if (Values::length($password) < 6) {
            return HttpResponse::json(['message' => 'Пароль должен содержать не менее 6 символов'], 400);
        }

        $pdo = Database::connection();
        $sql = <<<'SQL'
            INSERT INTO users
            (
                login, normalized_login, email, normalized_email,
                first_name, last_name, middle_name, password_hash,
                role, is_active
            )
            VALUES
            (
                :login, :normalized_login, :email, :normalized_email,
                :first_name, :last_name, NULLIF(:middle_name, ''), :password_hash,
                'User', TRUE
            )
            RETURNING id
            SQL;

        try {
            $statement = $pdo->prepare($sql);
            $statement->execute([
                'login' => $login,
                'normalized_login' => Values::upper($login),
                'email' => $email,
                'normalized_email' => Values::upper($email),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'middle_name' => $middleName ?? '',
                'password_hash' => AspNetPasswordHasher::hash($password),
            ]);

            $userId = (int)$statement->fetchColumn();
            Auth::login($userId, $login, 'User');

            return HttpResponse::json([
                'id' => $userId,
                'login' => $login,
                'email' => $email,
                'firstName' => $firstName,
                'lastName' => $lastName,
                'middleName' => $middleName !== '' ? $middleName : null,
                'role' => 'User',
                'isActive' => true,
            ]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23505') {
                return HttpResponse::json([
                    'message' => 'Пользователь с таким логином или e-mail уже существует',
                ], 409);
            }

            throw $exception;
        }
    }

    /**
     * Первый этап новой авторизации.
     *
     * Пользователь вводит email, после чего реальная
     * Volga API отправляет ему код.
     */
    public static function requestEmailCode(
        Request $request
    ): HttpResponse {
        $body = $request->json();

        $email = trim(
            Values::string($body, 'email')
        );

        if (
            $email === ''
            || !str_contains($email, '@')
        ) {
            return HttpResponse::json([
                'message' =>
                    'Введите корректный e-mail',
            ], 400);
        }

        $user = self::findLocalUserByEmail(
            $email
        );

        if (!is_array($user)) {
            return HttpResponse::json([
                'message' =>
                    'Пользователь с такой почтой не найден',
            ], 404);
        }

        if (
            !Values::dbBool(
                $user['is_active']
            )
        ) {
            return HttpResponse::json([
                'message' => 'Аккаунт отключён',
            ], 403);
        }

        // DEV AUTH:
        // письмо временно не отправляем.
        // Код для входа: 0000.
        return HttpResponse::json([
            'ttl' => 60,
        ]);

        /*
        // Используем email из локальной базы,
        // чтобы регистр символов ввода не влиял
        // на запрос во внешнюю API.
        $remote = self::volgaPost(
            '/api/authentication',
            [
                'email' =>
                    (string)$user['email'],
            ],
        );

        $status =
            (int)$remote['status'];

        if ($status !== 200) {
            return self::volgaErrorResponse(
                $remote,
                'Не удалось отправить код',
            );
        }

        $remoteBody = $remote['body'];

        if (
            !is_array($remoteBody)
            || !array_key_exists(
                'ttl',
                $remoteBody
            )
        ) {
            return HttpResponse::json([
                'message' =>
                    'Сервер авторизации вернул некорректный ответ',
            ], 502);
        }

        return HttpResponse::json([
            'ttl' => (int)$remoteBody['ttl'],
        ]);
        */
    }


    /**
     * Второй этап новой авторизации.
     *
     * Код проверяется реальной Volga API.
     * После успешной проверки создаём существующую
     * portal.auth-сессию для старых endpoint'ов.
     */
    public static function emailCodeLogin(
        Request $request
    ): HttpResponse {
        $body = $request->json();

        $email = trim(
            Values::string($body, 'email')
        );

        if (
            $email === ''
            || !str_contains($email, '@')
        ) {
            return HttpResponse::json([
                'message' =>
                    'Введите корректный e-mail',
            ], 400);
        }

        $rawCode =
            $body['code'] ?? null;

        // DEV AUTH:
        // временный код 0000.
        $isDevCode =
            (string)$rawCode === '0000';

        if (
            is_int($rawCode)
        ) {
            $code = $rawCode;
        } elseif (
            is_string($rawCode)
            && ctype_digit($rawCode)
        ) {
            $code = (int)$rawCode;
        } else {
            return HttpResponse::json([
                'message' =>
                    'Введите корректный код',
            ], 400);
        }

        if ($code <= 0 && !$isDevCode) {
            return HttpResponse::json([
                'message' =>
                    'Введите корректный код',
            ], 400);
        }

        $rawDeviceName =
            $body['device_name']
            ?? $body['deviceName']
            ?? null;

        $deviceName =
            is_string($rawDeviceName)
                ? trim($rawDeviceName)
                : '';

        if ($deviceName === '') {
            $deviceName =
                'VolgaShield mobile';
        }

        $user = self::findLocalUserByEmail(
            $email
        );

        if (!is_array($user)) {
            return HttpResponse::json([
                'message' =>
                    'Пользователь с такой почтой не найден',
            ], 404);
        }

        if (
            !Values::dbBool(
                $user['is_active']
            )
        ) {
            return HttpResponse::json([
                'message' => 'Аккаунт отключён',
            ], 403);
        }

        if ($isDevCode) {
            Auth::login(
                (int)$user['id'],
                (string)$user['login'],
                (string)$user['role'],
            );

            return HttpResponse::json([
                'id' => (int)$user['id'],
                'login' => (string)$user['login'],
                'email' => (string)$user['email'],
                'firstName' => (string)$user['first_name'],
                'lastName' => (string)$user['last_name'],
                'middleName' =>
                    $user['middle_name'] !== null
                        ? (string)$user['middle_name']
                        : null,
                'role' => (string)$user['role'],
                'isActive' =>
                    Values::dbBool(
                        $user['is_active']
                    ),

                // Временный DEV token.
                'token' => 'dev-0000',
                'remoteUserId' => 0,
            ]);
        }

        $remote = self::volgaPost(
            '/api/login',
            [
                'email' =>
                    (string)$user['email'],

                'code' => $code,

                'device_name' =>
                    $deviceName,
            ],
        );

        $status =
            (int)$remote['status'];

        if ($status !== 200) {
            return self::volgaErrorResponse(
                $remote,
                'Неверный или просроченный код',
            );
        }

        $remoteBody =
            $remote['body'];

        if (
            !is_array($remoteBody)
            || empty($remoteBody['token'])
            || !array_key_exists(
                'id',
                $remoteBody
            )
        ) {
            return HttpResponse::json([
                'message' =>
                    'Сервер авторизации не вернул токен',
            ], 502);
        }

        // Код подтверждён реальной API.
        // Создаём текущую PHP portal.auth session.
        Auth::login(
            (int)$user['id'],
            (string)$user['login'],
            (string)$user['role'],
        );

        return HttpResponse::json([
            'id' =>
                (int)$user['id'],

            'login' =>
                (string)$user['login'],

            'email' =>
                (string)$user['email'],

            'firstName' =>
                (string)$user['first_name'],

            'lastName' =>
                (string)$user['last_name'],

            'middleName' =>
                $user['middle_name'] !== null
                    ? (string)$user['middle_name']
                    : null,

            'role' =>
                (string)$user['role'],

            'isActive' =>
                Values::dbBool(
                    $user['is_active']
                ),

            // Настоящий Sanctum token.
            // Mobile сохранит его в SecureStore.
            'token' =>
                (string)$remoteBody['token'],

            'remoteUserId' =>
                (int)$remoteBody['id'],
        ]);
    }


    /**
     * Находим существующего пользователя портала
     * по email.
     */
    private static function findLocalUserByEmail(
        string $email
    ): array|false {
        $statement =
            Database::connection()->prepare(
                <<<'SQL'
                SELECT
                    id,
                    login,
                    email,
                    first_name,
                    last_name,
                    middle_name,
                    role,
                    is_active
                FROM users
                WHERE normalized_email = :normalized_email
                LIMIT 1
                SQL
            );

        $statement->execute([
            'normalized_email' =>
                Values::upper($email),
        ]);

        return $statement->fetch();
    }


    /**
     * POST JSON в реальную Volga API.
     *
     * PHP curl не требуется:
     * используем HTTPS stream wrapper.
     */
    private static function volgaPost(
        string $path,
        array $payload
    ): array {
        try {
            $json = json_encode(
                $payload,
                JSON_UNESCAPED_UNICODE
                | JSON_UNESCAPED_SLASHES
                | JSON_THROW_ON_ERROR,
            );
        } catch (\JsonException) {
            return [
                'status' => 0,
                'body' => null,
            ];
        }

        $context =
            stream_context_create([
                'http' => [
                    'method' => 'POST',

                    'header' =>
                        "Accept: application/json\r\n"
                        . "Content-Type: application/json\r\n",

                    'content' => $json,

                    'ignore_errors' => true,

                    'timeout' => 15,
                ],
            ]);

        $response = @file_get_contents(
            'https://volga.qq-agency.ru'
            . $path,
            false,
            $context,
        );

        $status = 0;

        if (
            isset($http_response_header)
            && is_array(
                $http_response_header
            )
        ) {
            foreach (
                $http_response_header
                as $header
            ) {
                if (
                    preg_match(
                        '#^HTTP/\S+\s+(\d{3})#',
                        $header,
                        $matches,
                    ) === 1
                ) {
                    $status =
                        (int)$matches[1];
                    break;
                }
            }
        }

        $decoded = null;

        if (
            is_string($response)
            && $response !== ''
        ) {
            try {
                $decoded = json_decode(
                    $response,
                    true,
                    512,
                    JSON_THROW_ON_ERROR,
                );
            } catch (\JsonException) {
                $decoded = null;
            }
        }

        return [
            'status' => $status,
            'body' =>
                is_array($decoded)
                    ? $decoded
                    : null,
        ];
    }


    /**
     * Не отдаём пользователю Laravel stack trace.
     */
    private static function volgaErrorResponse(
        array $remote,
        string $fallback
    ): HttpResponse {
        $status =
            (int)($remote['status'] ?? 0);

        if ($status === 404) {
            return HttpResponse::json([
                'message' =>
                    'Пользователь с такой почтой не найден',
            ], 404);
        }

        if ($status === 429) {
            return HttpResponse::json([
                'message' =>
                    'Слишком много попыток. Попробуйте позже',
            ], 429);
        }

        if (
            $status === 400
            || $status === 401
            || $status === 403
            || $status === 422
        ) {
            return HttpResponse::json([
                'message' => $fallback,
            ], $status);
        }

        return HttpResponse::json([
            'message' =>
                'Сервер авторизации временно недоступен',
        ], 502);
    }


    public static function login(Request $request): HttpResponse
    {
        $body = $request->json();
        $loginInput = Values::string($body, 'login');
        $password = Values::string($body, 'password');

        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                id, login, email, first_name, last_name, middle_name,
                password_hash, role, is_active
            FROM users
            WHERE normalized_login = :normalized_login
            LIMIT 1
            SQL);
        $statement->execute(['normalized_login' => Values::upper($loginInput)]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return HttpResponse::empty(401);
        }

        if (!Values::dbBool($row['is_active'])) {
            return HttpResponse::json(['message' => 'Аккаунт отключён'], 403);
        }

        if (!AspNetPasswordHasher::verify((string)$row['password_hash'], $password)) {
            return HttpResponse::empty(401);
        }

        Auth::login((int)$row['id'], (string)$row['login'], (string)$row['role']);

        return HttpResponse::json([
            'id' => (int)$row['id'],
            'login' => (string)$row['login'],
            'email' => (string)$row['email'],
            'firstName' => (string)$row['first_name'],
            'lastName' => (string)$row['last_name'],
            'middleName' => $row['middle_name'] !== null ? (string)$row['middle_name'] : null,
            'role' => (string)$row['role'],
            'isActive' => Values::dbBool($row['is_active']),
        ]);
    }

    public static function logout(): HttpResponse
    {
        Auth::logout();
        return HttpResponse::json(['success' => true]);
    }

    public static function me(array $identity): HttpResponse
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                id, login, email, first_name, last_name, middle_name,
                role, is_active, employment_date, position, category,
                avatar_url, created_at, updated_at
            FROM users
            WHERE id = :id
            LIMIT 1
            SQL);
        $statement->execute(['id' => $identity['userId']]);
        $row = $statement->fetch();

        return is_array($row)
            ? HttpResponse::json(Mapper::user($row))
            : HttpResponse::empty(401);
    }
}
