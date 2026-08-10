<?php

declare(strict_types=1);

namespace Portal\Controllers;

use Portal\Database;
use Portal\HttpResponse;
use Portal\Request;

final class PortalOperationsController
{
    private const SERVICE_ROLES = [
        'Technician',
        'CoTechnician',
        'Dispatcher',
        'Manager',
        'Administrator',
    ];

    private const MESSAGE_STATUSES = [
        'New',
        'InProgress',
        'Resolved',
        'Closed',
    ];

    public static function profileSummary(
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];
        $connection = Database::connection();

        $shiftStatement = $connection->prepare(
            <<<'SQL'
            SELECT
                COALESCE(
                    SUM(work_seconds),
                    0
                )::BIGINT AS work_seconds,

                COUNT(*) FILTER (
                    WHERE status = 'Completed'
                )::INTEGER AS completed_shifts

            FROM work_shifts

            WHERE user_id = :shift_user_id
              AND started_at >=
                    DATE_TRUNC('month', NOW())
              AND started_at <
                    DATE_TRUNC('month', NOW())
                    + INTERVAL '1 month'
            SQL
        );

        $shiftStatement->execute([
            'shift_user_id' => $userId,
        ]);

        $shiftRow = $shiftStatement->fetch();

        $activeStatement = $connection->prepare(
            <<<'SQL'
            SELECT
                id,
                status,
                started_at
            FROM work_shifts
            WHERE user_id = :active_user_id
              AND status IN (
                    'Working',
                    'Paused'
                  )
            ORDER BY id DESC
            LIMIT 1
            SQL
        );

        $activeStatement->execute([
            'active_user_id' => $userId,
        ]);

        $activeShift = $activeStatement->fetch();

        $eventStatement = $connection->prepare(
            <<<'SQL'
            SELECT
                COUNT(*)::INTEGER AS fines_count,

                COALESCE(
                    SUM(amount),
                    0
                )::NUMERIC AS fines_amount

            FROM work_events

            WHERE user_id = :event_user_id
              AND event_type = 'Fine'
              AND occurred_at >=
                    DATE_TRUNC('month', NOW())
              AND occurred_at <
                    DATE_TRUNC('month', NOW())
                    + INTERVAL '1 month'
            SQL
        );

        $eventStatement->execute([
            'event_user_id' => $userId,
        ]);

        $eventRow = $eventStatement->fetch();

        $requestStatement = $connection->prepare(
            <<<'SQL'
            SELECT
                COUNT(*) FILTER (
                    WHERE sr.status IN (
                        'New',
                        'Accepted',
                        'OnSite',
                        'InProgress',
                        'Waiting',
                        'PartiallyCompleted',
                        'Defect',
                        'Repeat'
                    )
                    AND sr.is_archived = FALSE
                )::INTEGER AS active_count,

                COUNT(*) FILTER (
                    WHERE sr.status IN (
                        'Completed',
                        'Closed'
                    )
                )::INTEGER AS completed_count,

                COUNT(*) FILTER (
                    WHERE sr.is_archived = TRUE
                )::INTEGER AS archive_count

            FROM service_requests sr

            WHERE
                sr.primary_technician_id =
                    :request_primary_user_id

                OR EXISTS (
                    SELECT 1
                    FROM request_assignees ra
                    WHERE ra.request_id = sr.id
                      AND ra.user_id =
                            :request_assistant_user_id
                      AND ra.removed_at IS NULL
                )
            SQL
        );

        $requestStatement->execute([
            'request_primary_user_id' =>
                $userId,

            'request_assistant_user_id' =>
                $userId,
        ]);

        $requestRow = $requestStatement->fetch();

        $payStatement = $connection->prepare(
            <<<'SQL'
            SELECT
                monthly_hours_norm,
                base_hourly_rate,
                tariff_rate,
                coefficient
            FROM user_pay_settings
            WHERE user_id = :pay_user_id
            LIMIT 1
            SQL
        );

        $payStatement->execute([
            'pay_user_id' => $userId,
        ]);

        $payRow = $payStatement->fetch();

        $workSeconds = (int)(
            $shiftRow['work_seconds']
            ?? 0
        );

        $baseRate = (float)(
            $payRow['base_hourly_rate']
            ?? 0
        );

        $tariffRate = (float)(
            $payRow['tariff_rate']
            ?? 0
        );

        $coefficient = (float)(
            $payRow['coefficient']
            ?? 1
        );

        $hourlyRate =
            $baseRate
            + ($tariffRate * $coefficient);

        return HttpResponse::json([
            'month' =>
                (int)date('n'),

            'year' =>
                (int)date('Y'),

            'workSeconds' =>
                $workSeconds,

            'hoursWorked' =>
                round(
                    $workSeconds / 3600,
                    2,
                ),

            'hoursNorm' =>
                $payRow !== false
                    && $payRow[
                        'monthly_hours_norm'
                    ] !== null
                        ? (float)$payRow[
                            'monthly_hours_norm'
                        ]
                        : null,

            'hourlyRate' =>
                round($hourlyRate, 2),

            'completedShifts' =>
                (int)(
                    $shiftRow[
                        'completed_shifts'
                    ]
                    ?? 0
                ),

            'finesCount' =>
                (int)(
                    $eventRow['fines_count']
                    ?? 0
                ),

            'finesAmount' =>
                (float)(
                    $eventRow['fines_amount']
                    ?? 0
                ),

            'activeRequests' =>
                (int)(
                    $requestRow['active_count']
                    ?? 0
                ),

            'completedRequests' =>
                (int)(
                    $requestRow[
                        'completed_count'
                    ]
                    ?? 0
                ),

            'archiveRequests' =>
                (int)(
                    $requestRow['archive_count']
                    ?? 0
                ),

            'activeShift' =>
                is_array($activeShift)
                    ? [
                        'id' =>
                            (int)$activeShift['id'],

                        'status' =>
                            (string)$activeShift[
                                'status'
                            ],

                        'startedAt' =>
                            (string)$activeShift[
                                'started_at'
                            ],
                    ]
                    : null,
        ]);
    }

    public static function serviceUsers(): HttpResponse
    {
        $statement = Database::connection()->query(
            <<<'SQL'
            SELECT
                id,
                login,
                email,
                first_name,
                last_name,
                middle_name,
                role,
                service_role,
                is_active,
                employment_date,
                position,
                category,
                avatar_url
            FROM users
            ORDER BY
                last_name,
                first_name,
                id
            SQL
        );

        $result = [];

        foreach ($statement->fetchAll() as $row) {
            $result[] = [
                'id' =>
                    (int)$row['id'],

                'login' =>
                    (string)$row['login'],

                'email' =>
                    (string)$row['email'],

                'firstName' =>
                    (string)$row['first_name'],

                'lastName' =>
                    (string)$row['last_name'],

                'middleName' =>
                    $row['middle_name'] !== null
                        ? (string)$row[
                            'middle_name'
                        ]
                        : null,

                'role' =>
                    (string)$row['role'],

                'serviceRole' =>
                    (string)$row[
                        'service_role'
                    ],

                'isActive' =>
                    self::dbBool(
                        $row['is_active'],
                    ),

                'employmentDate' =>
                    $row[
                        'employment_date'
                    ] !== null
                        ? (string)$row[
                            'employment_date'
                        ]
                        : null,

                'position' =>
                    $row['position'] !== null
                        ? (string)$row[
                            'position'
                        ]
                        : null,

                'category' =>
                    $row['category'] !== null
                        ? (string)$row[
                            'category'
                        ]
                        : null,

                'avatarUrl' =>
                    $row['avatar_url'] !== null
                        ? (string)$row[
                            'avatar_url'
                        ]
                        : null,
            ];
        }

        return HttpResponse::json($result);
    }

    public static function updateServiceRole(
        int $id,
        Request $request,
        array $identity,
    ): HttpResponse {
        $body = $request->json();

        $serviceRole = trim(
            (string)(
                $body['serviceRole']
                ?? ''
            ),
        );

        if (
            !in_array(
                $serviceRole,
                self::SERVICE_ROLES,
                true,
            )
        ) {
            return HttpResponse::json([
                'message' =>
                    'Указана неизвестная роль',
            ], 400);
        }

        if (
            $id === (int)$identity['userId']
            && $serviceRole !== 'Administrator'
        ) {
            return HttpResponse::json([
                'message' =>
                    'Нельзя снять роль администратора у своей учётной записи',
            ], 400);
        }

        $statement = Database::connection()->prepare(
            <<<'SQL'
            UPDATE users
            SET
                service_role =
                    :service_role,

                role =
                    CASE
                        WHEN :auth_role_value =
                            'Administrator'
                        THEN 'Admin'
                        ELSE 'User'
                    END,

                updated_at =
                    NOW()

            WHERE id = :user_id

            RETURNING
                id,
                role,
                service_role
            SQL
        );

        $statement->execute([
            'service_role' =>
                $serviceRole,

            'auth_role_value' =>
                $serviceRole,

            'user_id' =>
                $id,
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            return HttpResponse::json([
                'message' =>
                    'Пользователь не найден',
            ], 404);
        }

        return HttpResponse::json([
            'success' => true,
            'id' => (int)$row['id'],
            'role' => (string)$row['role'],
            'serviceRole' =>
                (string)$row['service_role'],
        ]);
    }

    public static function createMessage(
        Request $request,
        array $identity,
    ): HttpResponse {
        $body = $request->json();

        $message = trim(
            (string)(
                $body['message']
                ?? ''
            ),
        );

        if (strlen($message) < 2) {
            return HttpResponse::json([
                'message' =>
                    'Введите сообщение',
            ], 400);
        }

        if (strlen($message) > 5000) {
            return HttpResponse::json([
                'message' =>
                    'Сообщение слишком длинное',
            ], 400);
        }

        $statement = Database::connection()->prepare(
            <<<'SQL'
            INSERT INTO support_messages
            (
                user_id,
                message,
                status,
                created_at,
                updated_at
            )
            VALUES
            (
                :user_id,
                :message,
                'New',
                NOW(),
                NOW()
            )
            RETURNING
                id,
                status,
                created_at
            SQL
        );

        $statement->execute([
            'user_id' =>
                (int)$identity['userId'],

            'message' =>
                $message,
        ]);

        $row = $statement->fetch();

        return HttpResponse::json([
            'success' => true,
            'id' => (int)$row['id'],
            'status' =>
                (string)$row['status'],

            'createdAt' =>
                (string)$row['created_at'],
        ]);
    }

    public static function ownMessages(
        array $identity,
    ): HttpResponse {
        $statement = Database::connection()->prepare(
            <<<'SQL'
            SELECT
                id,
                message,
                status,
                admin_reply,
                answered_at,
                created_at,
                updated_at
            FROM support_messages
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 200
            SQL
        );

        $statement->execute([
            'user_id' =>
                (int)$identity['userId'],
        ]);

        return HttpResponse::json(
            self::mapMessages(
                $statement->fetchAll(),
                false,
            ),
        );
    }

    public static function adminMessages(): HttpResponse
    {
        $statement = Database::connection()->query(
            <<<'SQL'
            SELECT
                sm.id,
                sm.user_id,
                sm.message,
                sm.status,
                sm.admin_reply,
                sm.answered_at,
                sm.created_at,
                sm.updated_at,

                u.login,
                u.first_name,
                u.last_name,
                u.middle_name

            FROM support_messages sm

            JOIN users u
                ON u.id = sm.user_id

            ORDER BY
                CASE sm.status
                    WHEN 'New' THEN 1
                    WHEN 'InProgress' THEN 2
                    WHEN 'Resolved' THEN 3
                    ELSE 4
                END,

                sm.created_at DESC

            LIMIT 500
            SQL
        );

        return HttpResponse::json(
            self::mapMessages(
                $statement->fetchAll(),
                true,
            ),
        );
    }

    public static function updateMessage(
        int $id,
        Request $request,
        array $identity,
    ): HttpResponse {
        $body = $request->json();

        $status = trim(
            (string)(
                $body['status']
                ?? ''
            ),
        );

        $reply = trim(
            (string)(
                $body['reply']
                ?? ''
            ),
        );

        if (
            !in_array(
                $status,
                self::MESSAGE_STATUSES,
                true,
            )
        ) {
            return HttpResponse::json([
                'message' =>
                    'Указан неизвестный статус',
            ], 400);
        }

        if (strlen($reply) > 5000) {
            return HttpResponse::json([
                'message' =>
                    'Ответ слишком длинный',
            ], 400);
        }

        $statement = Database::connection()->prepare(
            <<<'SQL'
            UPDATE support_messages
            SET
                status =
                    :status,

                admin_reply =
                    NULLIF(
                        :admin_reply,
                        ''
                    ),

                answered_by_user_id =
                    CASE
                        WHEN :reply_present = '1'
                        THEN :answered_by_user_id
                        ELSE answered_by_user_id
                    END,

                answered_at =
                    CASE
                        WHEN :answer_timestamp = '1'
                        THEN NOW()
                        ELSE answered_at
                    END,

                updated_at =
                    NOW()

            WHERE id = :message_id

            RETURNING id
            SQL
        );

        $hasReply = $reply !== '';

        $statement->execute([
            'status' =>
                $status,

            'admin_reply' =>
                $reply,

            'reply_present' =>
                $hasReply ? '1' : '0',

            'answered_by_user_id' =>
                (int)$identity['userId'],

            'answer_timestamp' =>
                $hasReply ? '1' : '0',

            'message_id' =>
                $id,
        ]);

        if ($statement->fetchColumn() === false) {
            return HttpResponse::json([
                'message' =>
                    'Сообщение не найдено',
            ], 404);
        }

        return HttpResponse::json([
            'success' => true,
        ]);
    }

    public static function updateAvatar(
        Request $request,
        array $identity,
    ): HttpResponse {
        $body = $request->json();

        $dataUrl = trim(
            (string)(
                $body['dataUrl']
                ?? ''
            ),
        );

        if (
            !preg_match(
                '#^data:(image/jpeg|image/png|image/webp);base64,(.+)$#s',
                $dataUrl,
                $matches,
            )
        ) {
            return HttpResponse::json([
                'message' =>
                    'Не удалось прочитать изображение',
            ], 400);
        }

        $mime = $matches[1];

        $encoded = str_replace(
            [
                "\r",
                "\n",
                ' ',
            ],
            '',
            $matches[2],
        );

        $binary = base64_decode(
            $encoded,
            true,
        );

        if ($binary === false) {
            return HttpResponse::json([
                'message' =>
                    'Изображение повреждено',
            ], 400);
        }

        if (strlen($binary) > 12 * 1024 * 1024) {
            return HttpResponse::json([
                'message' =>
                    'Размер изображения превышает 12 МБ',
            ], 400);
        }

        $extension = match ($mime) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };

        $directory =
            '/opt/portal/uploads/avatars';

        if (
            !is_dir($directory)
            && !mkdir(
                $directory,
                0775,
                true,
            )
            && !is_dir($directory)
        ) {
            return HttpResponse::json([
                'message' =>
                    'Не удалось создать каталог аватаров',
            ], 500);
        }

        $fileName = sprintf(
            'user-%d-%s.%s',
            (int)$identity['userId'],
            date('YmdHis'),
            $extension,
        );

        $filePath =
            $directory
            . '/'
            . $fileName;

        if (
            file_put_contents(
                $filePath,
                $binary,
                LOCK_EX,
            ) === false
        ) {
            return HttpResponse::json([
                'message' =>
                    'Не удалось сохранить аватар',
            ], 500);
        }

        chmod($filePath, 0644);

        $avatarUrl =
            '/portal-uploads/avatars/'
            . $fileName;

        $statement = Database::connection()->prepare(
            <<<'SQL'
            UPDATE users
            SET
                avatar_url =
                    :avatar_url,

                updated_at =
                    NOW()

            WHERE id = :user_id
            SQL
        );

        $statement->execute([
            'avatar_url' =>
                $avatarUrl,

            'user_id' =>
                (int)$identity['userId'],
        ]);

        return HttpResponse::json([
            'success' => true,
            'avatarUrl' => $avatarUrl,
        ]);
    }

    private static function mapMessages(
        array $rows,
        bool $includeUser,
    ): array {
        $result = [];

        foreach ($rows as $row) {
            $item = [
                'id' =>
                    (int)$row['id'],

                'message' =>
                    (string)$row['message'],

                'status' =>
                    (string)$row['status'],

                'adminReply' =>
                    $row['admin_reply'] !== null
                        ? (string)$row[
                            'admin_reply'
                        ]
                        : null,

                'answeredAt' =>
                    $row['answered_at'] !== null
                        ? (string)$row[
                            'answered_at'
                        ]
                        : null,

                'createdAt' =>
                    (string)$row['created_at'],

                'updatedAt' =>
                    (string)$row['updated_at'],
            ];

            if ($includeUser) {
                $item['userId'] =
                    (int)$row['user_id'];

                $item['login'] =
                    (string)$row['login'];

                $item['firstName'] =
                    (string)$row['first_name'];

                $item['lastName'] =
                    (string)$row['last_name'];

                $item['middleName'] =
                    $row['middle_name'] !== null
                        ? (string)$row[
                            'middle_name'
                        ]
                        : null;
            }

            $result[] = $item;
        }

        return $result;
    }

    private static function dbBool(
        mixed $value,
    ): bool {
        if (is_bool($value)) {
            return $value;
        }

        return in_array(
            strtolower(
                trim((string)$value),
            ),
            [
                '1',
                't',
                'true',
                'yes',
                'on',
            ],
            true,
        );
    }
}
