<?php

declare(strict_types=1);

namespace Portal\Controllers;

use Portal\Database;
use Portal\HttpResponse;
use Portal\Request;

final class SupportController
{
    private const STATUSES = [
        'New',
        'InProgress',
        'Resolved',
        'Closed',
    ];

    public static function unreadSummary(
        array $identity,
    ): HttpResponse {
        $statement = Database::connection()->prepare(
            <<<'SQL'
            SELECT
                COUNT(stm.id)::INTEGER AS unread_count
            FROM support_threads st

            JOIN support_thread_messages stm
                ON stm.thread_id = st.id

            WHERE st.user_id = :user_id
              AND stm.sender_type = 'Admin'
              AND stm.id >
                    st.user_last_read_message_id
            SQL
        );

        $statement->execute([
            'user_id' =>
                (int)$identity['userId'],
        ]);

        $row = $statement->fetch();

        return HttpResponse::json([
            'unreadCount' =>
                (int)(
                    $row['unread_count']
                    ?? 0
                ),
        ]);
    }

    public static function userThreads(
        array $identity,
    ): HttpResponse {
        $statement = Database::connection()->prepare(
            <<<'SQL'
            SELECT
                st.id,
                st.subject,
                st.status,

                TO_CHAR(
                    st.created_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS created_at,

                TO_CHAR(
                    st.updated_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS updated_at,

                lm.message AS last_message,
                lm.sender_type AS last_sender_type,

                TO_CHAR(
                    lm.created_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS last_message_at,

                (
                    SELECT COUNT(*)::INTEGER
                    FROM support_thread_messages unread_message
                    WHERE
                        unread_message.thread_id = st.id

                        AND unread_message.sender_type =
                            'Admin'

                        AND unread_message.id >
                            st.user_last_read_message_id
                ) AS unread_count,

                (
                    SELECT COUNT(*)::INTEGER
                    FROM support_thread_messages count_message
                    WHERE count_message.thread_id = st.id
                ) AS messages_count

            FROM support_threads st

            LEFT JOIN LATERAL (
                SELECT
                    stm.message,
                    stm.sender_type,
                    stm.created_at
                FROM support_thread_messages stm
                WHERE stm.thread_id = st.id
                ORDER BY
                    stm.created_at DESC,
                    stm.id DESC
                LIMIT 1
            ) lm ON TRUE

            WHERE st.user_id = :user_id

            ORDER BY
                st.updated_at DESC,
                st.id DESC
            SQL
        );

        $statement->execute([
            'user_id' =>
                (int)$identity['userId'],
        ]);

        return HttpResponse::json(
            self::mapThreads(
                $statement->fetchAll(),
                false,
            ),
        );
    }

    public static function adminThreads(): HttpResponse
    {
        $statement = Database::connection()->query(
            <<<'SQL'
            SELECT
                st.id,
                st.user_id,
                st.subject,
                st.status,

                TO_CHAR(
                    st.created_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS created_at,

                TO_CHAR(
                    st.updated_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS updated_at,

                u.login,
                u.first_name,
                u.last_name,
                u.middle_name,

                lm.message AS last_message,
                lm.sender_type AS last_sender_type,

                TO_CHAR(
                    lm.created_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS last_message_at,

                (
                    SELECT COUNT(*)::INTEGER
                    FROM support_thread_messages count_message
                    WHERE count_message.thread_id = st.id
                ) AS messages_count

            FROM support_threads st

            JOIN users u
                ON u.id = st.user_id

            LEFT JOIN LATERAL (
                SELECT
                    stm.message,
                    stm.sender_type,
                    stm.created_at
                FROM support_thread_messages stm
                WHERE stm.thread_id = st.id
                ORDER BY
                    stm.created_at DESC,
                    stm.id DESC
                LIMIT 1
            ) lm ON TRUE

            ORDER BY
                CASE st.status
                    WHEN 'New' THEN 1
                    WHEN 'InProgress' THEN 2
                    WHEN 'Resolved' THEN 3
                    ELSE 4
                END,

                st.updated_at DESC,
                st.id DESC
            SQL
        );

        return HttpResponse::json(
            self::mapThreads(
                $statement->fetchAll(),
                true,
            ),
        );
    }

    public static function createThread(
        Request $request,
        array $identity,
    ): HttpResponse {
        $body = $request->json();

        $subject = trim(
            (string)(
                $body['subject']
                ?? ''
            ),
        );

        $message = trim(
            (string)(
                $body['message']
                ?? ''
            ),
        );

        if (
            $subject === ''
            || strlen($subject) < 2
        ) {
            return HttpResponse::json([
                'message' =>
                    'Введите тему диалога',
            ], 400);
        }

        if (strlen($subject) > 255) {
            return HttpResponse::json([
                'message' =>
                    'Тема слишком длинная',
            ], 400);
        }

        if ($message === '') {
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

        $connection = Database::connection();
        $connection->beginTransaction();

        try {
            $threadStatement =
                $connection->prepare(
                    <<<'SQL'
                    INSERT INTO support_threads
                    (
                        user_id,
                        subject,
                        status,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        :user_id,
                        :subject,
                        'New',
                        NOW(),
                        NOW()
                    )
                    RETURNING id
                    SQL
                );

            $threadStatement->execute([
                'user_id' =>
                    (int)$identity['userId'],

                'subject' =>
                    $subject,
            ]);

            $threadId =
                (int)$threadStatement->fetchColumn();

            $messageStatement =
                $connection->prepare(
                    <<<'SQL'
                    INSERT INTO support_thread_messages
                    (
                        thread_id,
                        sender_user_id,
                        sender_type,
                        message,
                        created_at
                    )
                    VALUES
                    (
                        :thread_id,
                        :sender_user_id,
                        'User',
                        :message,
                        NOW()
                    )
                    RETURNING id
                    SQL
                );

            $messageStatement->execute([
                'thread_id' =>
                    $threadId,

                'sender_user_id' =>
                    (int)$identity['userId'],

                'message' =>
                    $message,
            ]);

            $messageId =
                (int)$messageStatement->fetchColumn();

            $connection->commit();

            return HttpResponse::json([
                'success' => true,
                'id' => $threadId,
                'messageId' => $messageId,
            ]);
        } catch (\Throwable $exception) {
            if ($connection->inTransaction()) {
                $connection->rollBack();
            }

            throw $exception;
        }
    }

    public static function userThread(
        int $threadId,
        array $identity,
    ): HttpResponse {
        $userId =
            (int)$identity['userId'];

        $statement = Database::connection()->prepare(
            <<<'SQL'
            UPDATE support_threads
            SET
                user_last_read_message_id =
                    GREATEST(
                        user_last_read_message_id,

                        COALESCE(
                            (
                                SELECT MAX(stm.id)
                                FROM support_thread_messages stm
                                WHERE stm.thread_id =
                                    support_threads.id
                            ),
                            0
                        )
                    )

            WHERE id = :thread_id
              AND user_id = :user_id
            SQL
        );

        $statement->execute([
            'thread_id' =>
                $threadId,

            'user_id' =>
                $userId,
        ]);

        return self::thread(
            $threadId,
            $userId,
            false,
        );
    }

    public static function adminThread(
        int $threadId,
    ): HttpResponse {
        return self::thread(
            $threadId,
            null,
            true,
        );
    }

    public static function addUserMessage(
        int $threadId,
        Request $request,
        array $identity,
    ): HttpResponse {
        return self::addMessage(
            $threadId,
            $request,
            (int)$identity['userId'],
            false,
        );
    }

    public static function addAdminMessage(
        int $threadId,
        Request $request,
        array $identity,
    ): HttpResponse {
        return self::addMessage(
            $threadId,
            $request,
            (int)$identity['userId'],
            true,
        );
    }

    public static function updateStatus(
        int $threadId,
        Request $request,
    ): HttpResponse {
        $body = $request->json();

        $status = trim(
            (string)(
                $body['status']
                ?? ''
            ),
        );

        if (
            !in_array(
                $status,
                self::STATUSES,
                true,
            )
        ) {
            return HttpResponse::json([
                'message' =>
                    'Указан неизвестный статус',
            ], 400);
        }

        $statement = Database::connection()->prepare(
            <<<'SQL'
            UPDATE support_threads
            SET
                status =
                    :status,

                closed_at =
                    CASE
                        WHEN :closed_status = '1'
                        THEN NOW()
                        ELSE NULL
                    END,

                updated_at =
                    NOW()

            WHERE id =
                :thread_id

            RETURNING id
            SQL
        );

        $statement->execute([
            'status' =>
                $status,

            'closed_status' =>
                $status === 'Closed'
                    ? '1'
                    : '0',

            'thread_id' =>
                $threadId,
        ]);

        if ($statement->fetchColumn() === false) {
            return HttpResponse::json([
                'message' =>
                    'Диалог не найден',
            ], 404);
        }

        return HttpResponse::json([
            'success' => true,
            'status' => $status,
        ]);
    }

    private static function thread(
        int $threadId,
        ?int $ownerUserId,
        bool $admin,
    ): HttpResponse {
        $connection = Database::connection();

        if ($admin) {
            $statement = $connection->prepare(
                <<<'SQL'
                SELECT
                    st.id,
                    st.user_id,
                    st.subject,
                    st.status,

                    TO_CHAR(
                        st.created_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ) AS created_at,

                    TO_CHAR(
                        st.updated_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ) AS updated_at,

                    u.login,
                    u.first_name,
                    u.last_name,
                    u.middle_name

                FROM support_threads st

                JOIN users u
                    ON u.id = st.user_id

                WHERE st.id =
                    :thread_id

                LIMIT 1
                SQL
            );

            $statement->execute([
                'thread_id' =>
                    $threadId,
            ]);
        } else {
            $statement = $connection->prepare(
                <<<'SQL'
                SELECT
                    st.id,
                    st.user_id,
                    st.subject,
                    st.status,

                    TO_CHAR(
                        st.created_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ) AS created_at,

                    TO_CHAR(
                        st.updated_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ) AS updated_at

                FROM support_threads st

                WHERE st.id =
                    :thread_id

                  AND st.user_id =
                    :owner_user_id

                LIMIT 1
                SQL
            );

            $statement->execute([
                'thread_id' =>
                    $threadId,

                'owner_user_id' =>
                    $ownerUserId,
            ]);
        }

        $thread = $statement->fetch();

        if (!is_array($thread)) {
            return HttpResponse::json([
                'message' =>
                    'Диалог не найден',
            ], 404);
        }

        $messagesStatement =
            $connection->prepare(
                <<<'SQL'
                SELECT
                    stm.id,
                    stm.sender_user_id,
                    stm.sender_type,
                    stm.message,

                    TO_CHAR(
                        stm.created_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ) AS created_at,

                    u.first_name,
                    u.last_name,
                    u.middle_name

                FROM support_thread_messages stm

                LEFT JOIN users u
                    ON u.id = stm.sender_user_id

                WHERE stm.thread_id =
                    :message_thread_id

                ORDER BY
                    stm.created_at,
                    stm.id
                SQL
            );

        $messagesStatement->execute([
            'message_thread_id' =>
                $threadId,
        ]);

        $messages = [];

        foreach (
            $messagesStatement->fetchAll()
            as $message
        ) {
            $messages[] = [
                'id' =>
                    (int)$message['id'],

                'senderUserId' =>
                    $message[
                        'sender_user_id'
                    ] !== null
                        ? (int)$message[
                            'sender_user_id'
                        ]
                        : null,

                'senderType' =>
                    (string)$message[
                        'sender_type'
                    ],

                'message' =>
                    (string)$message[
                        'message'
                    ],

                'createdAt' =>
                    (string)$message[
                        'created_at'
                    ],

                'senderName' =>
                    trim(
                        implode(
                            ' ',
                            array_filter([
                                $message[
                                    'last_name'
                                ] ?? null,

                                $message[
                                    'first_name'
                                ] ?? null,

                                $message[
                                    'middle_name'
                                ] ?? null,
                            ]),
                        ),
                    ),
            ];
        }

        $result = [
            'id' =>
                (int)$thread['id'],

            'userId' =>
                (int)$thread['user_id'],

            'subject' =>
                (string)$thread['subject'],

            'status' =>
                (string)$thread['status'],

            'createdAt' =>
                (string)$thread['created_at'],

            'updatedAt' =>
                (string)$thread['updated_at'],

            'messages' =>
                $messages,
        ];

        if ($admin) {
            $result['user'] = [
                'login' =>
                    (string)$thread['login'],

                'firstName' =>
                    (string)$thread[
                        'first_name'
                    ],

                'lastName' =>
                    (string)$thread[
                        'last_name'
                    ],

                'middleName' =>
                    $thread[
                        'middle_name'
                    ] !== null
                        ? (string)$thread[
                            'middle_name'
                        ]
                        : null,
            ];
        }

        return HttpResponse::json($result);
    }

    private static function addMessage(
        int $threadId,
        Request $request,
        int $senderUserId,
        bool $admin,
    ): HttpResponse {
        $body = $request->json();

        $message = trim(
            (string)(
                $body['message']
                ?? ''
            ),
        );

        if ($message === '') {
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

        $connection = Database::connection();
        $connection->beginTransaction();

        try {
            if ($admin) {
                $threadStatement =
                    $connection->prepare(
                        <<<'SQL'
                        SELECT id
                        FROM support_threads
                        WHERE id = :thread_id
                        FOR UPDATE
                        SQL
                    );

                $threadStatement->execute([
                    'thread_id' =>
                        $threadId,
                ]);
            } else {
                $threadStatement =
                    $connection->prepare(
                        <<<'SQL'
                        SELECT id
                        FROM support_threads
                        WHERE id = :thread_id
                          AND user_id =
                                :owner_user_id
                        FOR UPDATE
                        SQL
                    );

                $threadStatement->execute([
                    'thread_id' =>
                        $threadId,

                    'owner_user_id' =>
                        $senderUserId,
                ]);
            }

            if (
                $threadStatement->fetchColumn()
                === false
            ) {
                $connection->rollBack();

                return HttpResponse::json([
                    'message' =>
                        'Диалог не найден',
                ], 404);
            }

            $messageStatement =
                $connection->prepare(
                    <<<'SQL'
                    INSERT INTO support_thread_messages
                    (
                        thread_id,
                        sender_user_id,
                        sender_type,
                        message,
                        created_at
                    )
                    VALUES
                    (
                        :thread_id,
                        :sender_user_id,
                        :sender_type,
                        :message,
                        NOW()
                    )
                    RETURNING id
                    SQL
                );

            $messageStatement->execute([
                'thread_id' =>
                    $threadId,

                'sender_user_id' =>
                    $senderUserId,

                'sender_type' =>
                    $admin
                        ? 'Admin'
                        : 'User',

                'message' =>
                    $message,
            ]);

            $messageId =
                (int)$messageStatement->fetchColumn();

            $updateStatement =
                $connection->prepare(
                    <<<'SQL'
                    UPDATE support_threads
                    SET
                        status =
                            CASE
                                WHEN :is_admin = '1'
                                     AND status = 'New'
                                THEN 'InProgress'

                                WHEN :is_user = '1'
                                     AND status IN (
                                        'Resolved',
                                        'Closed'
                                     )
                                THEN 'InProgress'

                                ELSE status
                            END,

                        closed_at =
                            CASE
                                WHEN :clear_closed = '1'
                                THEN NULL
                                ELSE closed_at
                            END,

                        updated_at =
                            NOW()

                    WHERE id =
                        :update_thread_id
                    SQL
                );

            $updateStatement->execute([
                'is_admin' =>
                    $admin ? '1' : '0',

                'is_user' =>
                    $admin ? '0' : '1',

                'clear_closed' =>
                    $admin ? '0' : '1',

                'update_thread_id' =>
                    $threadId,
            ]);

            $connection->commit();

            return HttpResponse::json([
                'success' => true,
                'id' => $messageId,
            ]);
        } catch (\Throwable $exception) {
            if ($connection->inTransaction()) {
                $connection->rollBack();
            }

            throw $exception;
        }
    }

    private static function mapThreads(
        array $rows,
        bool $includeUser,
    ): array {
        $result = [];

        foreach ($rows as $row) {
            $item = [
                'id' =>
                    (int)$row['id'],

                'subject' =>
                    (string)$row['subject'],

                'status' =>
                    (string)$row['status'],

                'lastMessage' =>
                    $row['last_message'] !== null
                        ? (string)$row[
                            'last_message'
                        ]
                        : null,

                'lastSenderType' =>
                    $row[
                        'last_sender_type'
                    ] !== null
                        ? (string)$row[
                            'last_sender_type'
                        ]
                        : null,

                'lastMessageAt' =>
                    $row[
                        'last_message_at'
                    ] !== null
                        ? (string)$row[
                            'last_message_at'
                        ]
                        : null,

                'messagesCount' =>
                    (int)$row[
                        'messages_count'
                    ],

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
                    (string)$row[
                        'first_name'
                    ];

                $item['lastName'] =
                    (string)$row[
                        'last_name'
                    ];

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
}
