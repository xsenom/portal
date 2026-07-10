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
