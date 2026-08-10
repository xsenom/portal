<?php

declare(strict_types=1);

namespace Portal\Controllers;

use PDO;
use PDOException;
use Portal\AspNetPasswordHasher;
use Portal\Database;
use Portal\HttpResponse;
use Portal\Mapper;
use Portal\Request;
use Portal\Values;

final class UserController
{
    private const USER_SELECT = <<<'SQL'
        SELECT
            id, login, email, first_name, last_name, middle_name,
            role, is_active, employment_date, position, category,
            avatar_url, created_at, updated_at
        FROM users
        SQL;

    public static function all(): HttpResponse
    {
        $rows = Database::connection()
            ->query(self::USER_SELECT . ' ORDER BY created_at DESC, id DESC')
            ->fetchAll();

        return HttpResponse::json(array_map([Mapper::class, 'user'], $rows));
    }


    public static function updateOwnAvatar(
        Request $request,
        array $identity,
    ): HttpResponse {
        $body = $request->json();

        $dataUrl = Values::string(
            $body,
            'avatarDataUrl',
        );

        if (
            $dataUrl === ''
            || preg_match(
                '#^data:image/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$#i',
                $dataUrl,
                $matches,
            ) !== 1
        ) {
            return HttpResponse::json(
                [
                    'message' =>
                        'Передано некорректное изображение',
                ],
                400,
            );
        }

        $base64 = preg_replace(
            '/\s+/',
            '',
            $matches[2],
        );

        if (!is_string($base64)) {
            return HttpResponse::json(
                ['message' => 'Не удалось обработать изображение'],
                400,
            );
        }

        $binary = base64_decode(
            $base64,
            true,
        );

        if ($binary === false) {
            return HttpResponse::json(
                ['message' => 'Не удалось обработать изображение'],
                400,
            );
        }

        if (strlen($binary) > 2000000) {
            return HttpResponse::json(
                [
                    'message' =>
                        'Размер фотографии превышает 2 МБ',
                ],
                400,
            );
        }

        $imageInfo = @getimagesizefromstring(
            $binary,
        );

        if ($imageInfo === false) {
            return HttpResponse::json(
                ['message' => 'Файл не является изображением'],
                400,
            );
        }

        $mime = (string)(
            $imageInfo['mime'] ?? ''
        );

        if (
            !in_array(
                $mime,
                [
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                ],
                true,
            )
        ) {
            return HttpResponse::json(
                ['message' => 'Формат изображения не поддерживается'],
                400,
            );
        }

        $normalizedDataUrl =
            'data:'
            . $mime
            . ';base64,'
            . base64_encode($binary);

        $statement = Database::connection()
            ->prepare(
                <<<'SQL'
                UPDATE users
                SET
                    avatar_url = :avatar_url,
                    updated_at = NOW()
                WHERE id = :id
                SQL
            );

        $statement->execute([
            'avatar_url' =>
                $normalizedDataUrl,
            'id' =>
                (int)$identity['userId'],
        ]);

        if ($statement->rowCount() === 0) {
            return HttpResponse::json(
                ['message' => 'Пользователь не найден'],
                404,
            );
        }

        return HttpResponse::json([
            'success' => true,
            'avatarUrl' =>
                $normalizedDataUrl,
        ]);
    }

    public static function one(int $id): HttpResponse
    {
        $pdo = Database::connection();
        $statement = $pdo->prepare(self::USER_SELECT . ' WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return HttpResponse::json(['message' => 'Пользователь не найден'], 404);
        }

        $contactsStatement = $pdo->prepare(<<<'SQL'
            SELECT id, type, value, is_primary, sort_order
            FROM user_contacts
            WHERE user_id = :user_id
            ORDER BY sort_order, id
            SQL);
        $contactsStatement->execute(['user_id' => $id]);

        $contacts = array_map(
            static fn(array $contact): array => [
                'id' => (int)$contact['id'],
                'type' => (string)$contact['type'],
                'value' => (string)$contact['value'],
                'isPrimary' => Values::dbBool($contact['is_primary']),
                'sortOrder' => (int)$contact['sort_order'],
            ],
            $contactsStatement->fetchAll(),
        );

        return HttpResponse::json([
            'user' => Mapper::user($row),
            'contacts' => $contacts,
        ]);
    }

    public static function update(int $id, Request $request): HttpResponse
    {
        $body = $request->json();
        $login = Values::string($body, 'login');
        $email = Values::string($body, 'email');
        $firstName = Values::string($body, 'firstName');
        $lastName = Values::string($body, 'lastName');
        $middleName = Values::nullableString($body, 'middleName') ?? '';
        $roleInput = Values::string($body, 'role');
        $role = strcasecmp($roleInput, 'Admin') === 0 ? 'Admin' : 'User';
        $isActive = Values::bool($body, 'isActive');
        $employmentDate = Values::nullableString($body, 'employmentDate') ?? '';
        $position = Values::nullableString($body, 'position') ?? '';
        $category = Values::nullableString($body, 'category') ?? '';
        $avatarUrl = Values::nullableString($body, 'avatarUrl') ?? '';
        $newPassword = Values::nullableString($body, 'newPassword');
        $contacts = Values::get($body, 'contacts', null, []);

        if (
            Values::length($login) < 3
            || Values::length($firstName) < 2
            || Values::length($lastName) < 2
            || !str_contains($email, '@')
        ) {
            return HttpResponse::json(['message' => 'Проверьте логин, e-mail и ФИО'], 400);
        }

        if (!Values::validDate($employmentDate)) {
            return HttpResponse::json(['message' => 'Дата трудоустройства указана неверно'], 400);
        }

        $passwordHash = '';
        if ($newPassword !== null && $newPassword !== '') {
            if (Values::length($newPassword) < 6) {
                return HttpResponse::json(['message' => 'Новый пароль должен содержать не менее 6 символов'], 400);
            }

            $passwordHash = AspNetPasswordHasher::hash($newPassword);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $update = $pdo->prepare(<<<'SQL'
                UPDATE users
                SET
                    login = :login,
                    normalized_login = :normalized_login,
                    email = :email,
                    normalized_email = :normalized_email,
                    first_name = :first_name,
                    last_name = :last_name,
                    middle_name = NULLIF(:middle_name, ''),
                    role = :role,
                    is_active = :is_active,
                    employment_date = CAST(NULLIF(:employment_date, '') AS date),
                    position = NULLIF(:position, ''),
                    category = NULLIF(:category, ''),
                    avatar_url = NULLIF(:avatar_url, ''),
                    password_hash = COALESCE(NULLIF(:password_hash, ''), password_hash),
                    updated_at = NOW()
                WHERE id = :id
                SQL);
            $update->bindValue('id', $id, PDO::PARAM_INT);
            $update->bindValue('login', $login);
            $update->bindValue('normalized_login', Values::upper($login));
            $update->bindValue('email', $email);
            $update->bindValue('normalized_email', Values::upper($email));
            $update->bindValue('first_name', $firstName);
            $update->bindValue('last_name', $lastName);
            $update->bindValue('middle_name', $middleName);
            $update->bindValue('role', $role);
            $update->bindValue('is_active', $isActive, PDO::PARAM_BOOL);
            $update->bindValue('employment_date', $employmentDate);
            $update->bindValue('position', $position);
            $update->bindValue('category', $category);
            $update->bindValue('avatar_url', $avatarUrl);
            $update->bindValue('password_hash', $passwordHash);
            $update->execute();

            if ($update->rowCount() === 0) {
                $pdo->rollBack();
                return HttpResponse::json(['message' => 'Пользователь не найден'], 404);
            }

            $delete = $pdo->prepare('DELETE FROM user_contacts WHERE user_id = :user_id');
            $delete->execute(['user_id' => $id]);

            if (is_array($contacts)) {
                $insert = $pdo->prepare(<<<'SQL'
                    INSERT INTO user_contacts
                        (user_id, type, value, is_primary, sort_order)
                    VALUES
                        (:user_id, :type, :value, :is_primary, :sort_order)
                    SQL);

                foreach ($contacts as $contact) {
                    if (!is_array($contact)) {
                        continue;
                    }

                    $type = Values::string($contact, 'type');
                    $value = Values::string($contact, 'value');
                    if ($type === '' || $value === '') {
                        continue;
                    }

                    $insert->bindValue('user_id', $id, PDO::PARAM_INT);
                    $insert->bindValue('type', $type);
                    $insert->bindValue('value', $value);
                    $insert->bindValue('is_primary', Values::bool($contact, 'isPrimary'), PDO::PARAM_BOOL);
                    $insert->bindValue('sort_order', Values::int($contact, 'sortOrder'), PDO::PARAM_INT);
                    $insert->execute();
                }
            }

            $pdo->commit();
            return HttpResponse::json(['success' => true]);
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ($exception->getCode() === '23505') {
                return HttpResponse::json(['message' => 'Логин или e-mail уже используется'], 409);
            }

            throw $exception;
        }
    }
}
