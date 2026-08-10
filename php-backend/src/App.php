<?php

declare(strict_types=1);

namespace Portal;

use Portal\Database;

use Portal\Controllers\AuthController;
use Portal\Controllers\IndicatorController;
use Portal\Controllers\ServiceRequestController;
use Portal\Controllers\ServiceRequestContentController;
use Portal\Controllers\TaskController;
use Portal\Controllers\UserController;
use Portal\Controllers\WorkTimeController;
use Portal\Controllers\PortalOperationsController;

require_once __DIR__
    . '/Controllers/ServiceRequestController.php';

require_once __DIR__
    . '/Controllers/ServiceRequestContentController.php';

final class App
{
    public static function router(): Router
    {
        $router = new Router();

        $router->add('GET', '/api/portal/health', static fn(): HttpResponse => HttpResponse::json([
            'status' => 'ok',
            'service' => 'Portal.Api',
            'time' => gmdate('Y-m-d\\TH:i:s.u\\Z'),
        ]));

        $router->add('POST', '/api/portal/auth/register', static fn(Request $request): HttpResponse => AuthController::register($request));

        // Новая passwordless-авторизация через Volga API.
        $router->add(
            'POST',
            '/api/portal/authentication',
            static fn(Request $request): HttpResponse =>
                AuthController::requestEmailCode($request),
        );

        $router->add(
            'POST',
            '/api/portal/login',
            static fn(Request $request): HttpResponse =>
                AuthController::emailCodeLogin($request),
        );

        // Старый login/password временно оставляем.
        $router->add('POST', '/api/portal/auth/login', static fn(Request $request): HttpResponse => AuthController::login($request));
        $router->add('POST', '/api/portal/auth/logout', static fn(): HttpResponse => AuthController::logout());
        $router->add('GET', '/api/portal/auth/me', static fn(Request $request, array $params, array $identity): HttpResponse => AuthController::me($identity), true);
        $router->add('POST', '/api/portal/profile/avatar', static fn(Request $request, array $params, array $identity): HttpResponse => PortalOperationsController::updateAvatar($request, $identity), true);

        // PORTAL_OPERATIONS_PROFILE_V1
        $router->add(
            'GET',
            '/api/portal/profile/summary',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                PortalOperationsController::profileSummary(
                    $identity,
                ),
            true,
        );

        $router->add(
            'POST',
            '/api/portal/support/messages',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                PortalOperationsController::createMessage(
                    $request,
                    $identity,
                ),
            true,
        );

        $router->add(
            'GET',
            '/api/portal/support/messages',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                PortalOperationsController::ownMessages(
                    $identity,
                ),
            true,
        );


        $router->add('GET', '/api/portal/admin/users', static fn(): HttpResponse => UserController::all(), true, true);
        $router->add('GET', '/api/portal/admin/users/{id}', static fn(Request $request, array $params): HttpResponse => UserController::one($params['id']), true, true);
        $router->add('PUT', '/api/portal/admin/users/{id}', static fn(Request $request, array $params): HttpResponse => UserController::update($params['id'], $request), true, true);

        // PORTAL_OPERATIONS_ADMIN_V1
        $router->add(
            'GET',
            '/api/portal/admin/service-users',
            static fn(): HttpResponse =>
                PortalOperationsController::serviceUsers(),
            true,
            true,
        );

        $router->add(
            'PUT',
            '/api/portal/admin/users/{id}/service-role',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                PortalOperationsController::updateServiceRole(
                    (int)$params['id'],
                    $request,
                    $identity,
                ),
            true,
            true,
        );

        $router->add(
            'GET',
            '/api/portal/admin/support/messages',
            static fn(): HttpResponse =>
                PortalOperationsController::adminMessages(),
            true,
            true,
        );

        $router->add(
            'PUT',
            '/api/portal/admin/support/messages/{id}',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                PortalOperationsController::updateMessage(
                    (int)$params['id'],
                    $request,
                    $identity,
                ),
            true,
            true,
        );


        $router->add('GET', '/api/portal/tasks', static fn(Request $request, array $params, array $identity): HttpResponse => TaskController::currentTasks($request, $identity), true);
        $router->add('POST', '/api/portal/tasks/{id}/start', static fn(Request $request, array $params, array $identity): HttpResponse => TaskController::start($params['id'], $identity), true);
        $router->add('POST', '/api/portal/tasks/{id}/decline', static fn(Request $request, array $params, array $identity): HttpResponse => TaskController::decline($params['id'], $request, $identity), true);
        $router->add('POST', '/api/portal/tasks/{id}/submit', static fn(Request $request, array $params, array $identity): HttpResponse => TaskController::submit($params['id'], $request, $identity), true);
        $router->add('GET', '/api/portal/indicators/me', static fn(Request $request, array $params, array $identity): HttpResponse => IndicatorController::current($request, $identity), true);

        $router->add('GET', '/api/portal/admin/tasks', static fn(Request $request): HttpResponse => TaskController::adminTasks($request), true, true);
        $router->add('POST', '/api/portal/admin/tasks', static fn(Request $request, array $params, array $identity): HttpResponse => TaskController::create($request, $identity), true, true);
        $router->add('POST', '/api/portal/admin/tasks/{id}/approve', static fn(Request $request, array $params): HttpResponse => TaskController::approve($params['id'], $request), true, true);
        $router->add('POST', '/api/portal/admin/tasks/{id}/reject', static fn(Request $request, array $params): HttpResponse => TaskController::reject($params['id'], $request), true, true);
        $router->add('GET', '/api/portal/admin/users/{id}/pay-settings', static fn(Request $request, array $params): HttpResponse => TaskController::getPaySettings($params['id']), true, true);
        $router->add('PUT', '/api/portal/admin/users/{id}/pay-settings', static fn(Request $request, array $params): HttpResponse => TaskController::savePaySettings($params['id'], $request), true, true);
        $router->add('POST', '/api/portal/admin/users/{id}/events', static fn(Request $request, array $params, array $identity): HttpResponse => TaskController::createWorkEvent($params['id'], $request, $identity), true, true);
        $router->add('GET', '/api/portal/admin/users/{id}/indicators', static fn(Request $request, array $params): HttpResponse => IndicatorController::admin($params['id'], $request), true, true);
        $router->add('POST', '/api/portal/admin/users/{id}/indicators/recalculate', static fn(Request $request, array $params): HttpResponse => IndicatorController::recalculate($params['id'], $request), true, true);

        $router->add('GET', '/api/portal/time/dashboard', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::dashboard($request, $identity), true);
        $router->add('GET', '/api/portal/time/pause-reasons', static fn(): HttpResponse => WorkTimeController::pauseReasons(), true);
        $router->add('POST', '/api/portal/time/start', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::start($request, $identity), true);
        $router->add('POST', '/api/portal/time/pause', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::pause($request, $identity), true);
        $router->add('POST', '/api/portal/time/resume', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::resume($identity), true);
        $router->add('POST', '/api/portal/time/finish', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::finish($request, $identity), true);


        $router->add(
            'GET',
            '/api/portal/service-requests',
            static function (
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse {
                try {
                    $connection = Database::connection();
                    $userId = (int)$identity['userId'];

                    $status = trim(
                        (string)(
                            $request->queryString('status')
                            ?? ''
                        ),
                    );

                    $archiveInput = strtolower(
                        trim(
                            (string)(
                                $request->queryString('archive')
                                ?? ''
                            ),
                        ),
                    );

                    $search = trim(
                        (string)(
                            $request->queryString('search')
                            ?? ''
                        ),
                    );

                    $archive = in_array(
                        $archiveInput,
                        ['1', 'true', 'yes'],
                        true,
                    );

                    $userStatement =
                        $connection->prepare(
                            <<<'SQL'
                            SELECT
                                role,
                                service_role
                            FROM users
                            WHERE id = :user_id
                            LIMIT 1
                            SQL
                        );

                    $userStatement->execute([
                        'user_id' => $userId,
                    ]);

                    $user = $userStatement->fetch();

                    if (!is_array($user)) {
                        return HttpResponse::json([
                            'message' =>
                                'Пользователь не найден',
                        ], 404);
                    }

                    $authRole = trim(
                        (string)($user['role'] ?? ''),
                    );

                    $serviceRole = trim(
                        (string)(
                            $user['service_role'] ?? ''
                        ),
                    );

                    $globalAccess =
                        $authRole === 'Admin'
                        || in_array(
                            $serviceRole,
                            [
                                'Dispatcher',
                                'Manager',
                                'Administrator',
                            ],
                            true,
                        );

                    $conditions = [
                        $archive
                            ? 'sr.is_archived IS TRUE'
                            : 'sr.is_archived IS FALSE',
                    ];

                    $queryParameters = [
                        'assignment_primary_user_id' =>
                            $userId,

                        'assignment_assistant_user_id' =>
                            $userId,
                    ];

                    if (!$globalAccess) {
                        $conditions[] = <<<'SQL'
                            (
                                sr.primary_technician_id =
                                    :access_primary_user_id

                                OR EXISTS (
                                    SELECT 1
                                    FROM request_assignees access_ra
                                    WHERE
                                        access_ra.request_id =
                                            sr.id

                                        AND access_ra.user_id =
                                            :access_assistant_user_id

                                        AND access_ra.removed_at
                                            IS NULL
                                )
                            )
                            SQL;

                        $queryParameters[
                            'access_primary_user_id'
                        ] = $userId;

                        $queryParameters[
                            'access_assistant_user_id'
                        ] = $userId;
                    }

                    if ($status !== '') {
                        $conditions[] =
                            'sr.status = :request_status';

                        $queryParameters[
                            'request_status'
                        ] = $status;
                    }

                    if ($search !== '') {
                        $searchValue =
                            '%' . $search . '%';

                        $conditions[] = <<<'SQL'
                            (
                                sr.request_number ILIKE
                                    :search_number

                                OR sr.title ILIKE
                                    :search_title

                                OR COALESCE(
                                    so.name,
                                    ''
                                ) ILIKE :search_object

                                OR COALESCE(
                                    so.address,
                                    ''
                                ) ILIKE :search_address
                            )
                            SQL;

                        $queryParameters[
                            'search_number'
                        ] = $searchValue;

                        $queryParameters[
                            'search_title'
                        ] = $searchValue;

                        $queryParameters[
                            'search_object'
                        ] = $searchValue;

                        $queryParameters[
                            'search_address'
                        ] = $searchValue;
                    }

                    $where = implode(
                        "\nAND ",
                        $conditions,
                    );

                    $sql = <<<SQL
                        SELECT
                            sr.id,
                            sr.request_number,
                            sr.title,
                            sr.description,
                            sr.problem_type,
                            sr.priority,
                            sr.sla_deadline,
                            sr.status,
                            sr.progress_percent,
                            sr.is_repeat,
                            sr.is_defect,
                            sr.is_archived,
                            sr.primary_technician_id,
                            sr.created_at,
                            sr.updated_at,

                            so.id AS object_id,
                            so.name AS object_name,
                            so.address AS object_address,
                            so.latitude AS object_latitude,
                            so.longitude AS object_longitude,

                            CASE
                                WHEN
                                    sr.primary_technician_id =
                                    :assignment_primary_user_id
                                THEN 'Primary'

                                WHEN EXISTS (
                                    SELECT 1
                                    FROM request_assignees role_ra
                                    WHERE
                                        role_ra.request_id =
                                            sr.id

                                        AND role_ra.user_id =
                                            :assignment_assistant_user_id

                                        AND role_ra.removed_at
                                            IS NULL
                                )
                                THEN 'Assistant'

                                ELSE NULL
                            END AS assignment_role

                        FROM service_requests sr

                        LEFT JOIN service_objects so
                            ON so.id = sr.object_id

                        WHERE {$where}

                        ORDER BY
                            CASE sr.priority
                                WHEN 'Critical' THEN 1
                                WHEN 'High' THEN 2
                                WHEN 'Normal' THEN 3
                                WHEN 'Low' THEN 4
                                ELSE 5
                            END,

                            sr.sla_deadline NULLS LAST,
                            sr.created_at DESC

                        LIMIT 500
                        SQL;

                    $statement =
                        $connection->prepare($sql);

                    $statement->execute(
                        $queryParameters,
                    );

                    $rows = $statement->fetchAll();

                    $nullableString =
                        static function (
                            mixed $value
                        ): ?string {
                            if ($value === null) {
                                return null;
                            }

                            $result = trim(
                                (string)$value,
                            );

                            return $result !== ''
                                ? $result
                                : null;
                        };

                    $booleanValue =
                        static function (
                            mixed $value
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
                        };

                    $result = [];

                    foreach ($rows as $row) {
                        $objectId =
                            $row['object_id'] !== null
                                ? (int)$row['object_id']
                                : null;

                        $objectName =
                            $nullableString(
                                $row['object_name']
                                ?? null,
                            );

                        $objectAddress =
                            $nullableString(
                                $row['object_address']
                                ?? null,
                            );

                        $objectLatitude =
                            $row[
                                'object_latitude'
                            ] !== null
                                ? (float)$row[
                                    'object_latitude'
                                ]
                                : null;

                        $objectLongitude =
                            $row[
                                'object_longitude'
                            ] !== null
                                ? (float)$row[
                                    'object_longitude'
                                ]
                                : null;

                        $result[] = [
                            'id' =>
                                (int)$row['id'],

                            'requestNumber' =>
                                (string)$row[
                                    'request_number'
                                ],

                            'title' =>
                                (string)$row['title'],

                            'description' =>
                                $nullableString(
                                    $row['description']
                                    ?? null,
                                ),

                            'problemType' =>
                                $nullableString(
                                    $row['problem_type']
                                    ?? null,
                                ),

                            'priority' =>
                                (string)$row['priority'],

                            'slaDeadline' =>
                                $nullableString(
                                    $row['sla_deadline']
                                    ?? null,
                                ),

                            'status' =>
                                (string)$row['status'],

                            'progressPercent' =>
                                (float)$row[
                                    'progress_percent'
                                ],

                            'isRepeat' =>
                                $booleanValue(
                                    $row['is_repeat'],
                                ),

                            'isDefect' =>
                                $booleanValue(
                                    $row['is_defect'],
                                ),

                            'isArchived' =>
                                $booleanValue(
                                    $row['is_archived'],
                                ),

                            'assignmentRole' =>
                                $nullableString(
                                    $row['assignment_role']
                                    ?? null,
                                ),

                            'primaryTechnicianId' =>
                                $row[
                                    'primary_technician_id'
                                ] !== null
                                    ? (int)$row[
                                        'primary_technician_id'
                                    ]
                                    : null,

                            'createdAt' =>
                                (string)$row[
                                    'created_at'
                                ],

                            'updatedAt' =>
                                (string)$row[
                                    'updated_at'
                                ],

                            'objectId' =>
                                $objectId,

                            'objectName' =>
                                $objectName,

                            'objectAddress' =>
                                $objectAddress,

                            'objectLatitude' =>
                                $objectLatitude,

                            'objectLongitude' =>
                                $objectLongitude,

                            'object' => [
                                'id' =>
                                    $objectId,

                                'name' =>
                                    $objectName,

                                'address' =>
                                    $objectAddress,

                                'latitude' =>
                                    $objectLatitude,

                                'longitude' =>
                                    $objectLongitude,
                            ],
                        ];
                    }

                    return HttpResponse::json(
                        $result,
                    );
                } catch (\Throwable $exception) {
                    file_put_contents(
                        '/tmp/portal-service-request-route.log',
                        date('c')
                        . PHP_EOL
                        . get_class($exception)
                        . ': '
                        . $exception->getMessage()
                        . ' in '
                        . $exception->getFile()
                        . ':'
                        . $exception->getLine()
                        . PHP_EOL
                        . $exception->getTraceAsString()
                        . PHP_EOL
                        . PHP_EOL,
                        FILE_APPEND | LOCK_EX,
                    );

                    return HttpResponse::json([
                        'message' =>
                            'Не удалось загрузить заявки',
                    ], 500);
                }
            },
            true,
        );
        $router->add(
            'GET',
            '/api/portal/service-requests/wait-reasons',
            static function (
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse {
                try {
                    return ServiceRequestController::waitReasons();
                } catch (\Throwable $exception) {
                    file_put_contents(
                        '/opt/portal/php-backend/portal-route-error.log',
                        '[' . date('c') . '] [WAIT_REASONS_ROUTE] '
                        . get_class($exception)
                        . ': '
                        . $exception->getMessage()
                        . ' in '
                        . $exception->getFile()
                        . ':'
                        . $exception->getLine()
                        . PHP_EOL
                        . $exception->getTraceAsString()
                        . PHP_EOL
                        . PHP_EOL,
                        FILE_APPEND | LOCK_EX,
                    );

                    return HttpResponse::json([
                        'message' =>
                            'Ошибка причин ожидания: '
                            . get_class($exception)
                            . ': '
                            . $exception->getMessage()
                            . ' — '
                            . basename($exception->getFile())
                            . ':'
                            . $exception->getLine(),
                    ], 500);
                }
            },
            true,
        );
        $router->add(
            'GET',
            '/api/portal/service-requests/{id}',
            static function (
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse {
                try {
                    return ServiceRequestController::show(
                        (int)($params['id'] ?? 0),
                        $identity,
                    );
                } catch (\Throwable $exception) {
                    file_put_contents(
                        '/opt/portal/php-backend/portal-route-error.log',
                        '[' . date('c') . '] [SHOW_ROUTE] '
                        . 'raw_id='
                        . var_export($params['id'] ?? null, true)
                        . ' '
                        . get_class($exception)
                        . ': '
                        . $exception->getMessage()
                        . ' in '
                        . $exception->getFile()
                        . ':'
                        . $exception->getLine()
                        . PHP_EOL
                        . $exception->getTraceAsString()
                        . PHP_EOL
                        . PHP_EOL,
                        FILE_APPEND | LOCK_EX,
                    );

                    return HttpResponse::json([
                        'message' =>
                            'Не удалось открыть заявку',
                    ], 500);
                }
            },
            true,
        );

        $router->add('POST', '/api/portal/service-requests/{id}/accept', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestController::accept((int)$params['id'], $identity), true);
        $router->add('POST', '/api/portal/service-requests/{id}/arrive', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestController::arrive((int)$params['id'], $request, $identity), true);
        $router->add('POST', '/api/portal/service-requests/{id}/start-work', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestController::startWork((int)$params['id'], $identity), true);
        $router->add('POST', '/api/portal/service-requests/{id}/wait', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestController::wait((int)$params['id'], $request, $identity), true);
        $router->add('POST', '/api/portal/service-requests/{id}/partial', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestController::partial((int)$params['id'], $request, $identity), true);
        $router->add('POST', '/api/portal/service-requests/{id}/work-items/{itemId}/complete', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestController::completeWorkItem((int)$params['id'], (int)$params['itemId'], $identity), true);

        $router->add('POST', '/api/portal/admin/service-requests', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestController::create($request, $identity), true);


        $router->add('GET', '/api/portal/service-requests/{id}/comments', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestContentController::comments((int)$params['id'], $identity), true);
        $router->add('POST', '/api/portal/service-requests/{id}/comments', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestContentController::addComment((int)$params['id'], $request, $identity), true);

        $router->add('GET', '/api/portal/service-requests/{id}/attachments', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestContentController::attachments((int)$params['id'], $identity), true);
        $router->add('POST', '/api/portal/service-requests/{id}/attachments', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestContentController::uploadAttachment((int)$params['id'], $identity), true);

        $router->add('POST', '/api/portal/service-requests/{id}/close', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestContentController::close((int)$params['id'], $request, $identity), true);

        $router->add('GET', '/api/portal/service-objects/{id}/history', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestContentController::objectHistory((int)$params['id'], $request, $identity), true);
        $router->add('GET', '/api/portal/service-objects/{id}/archive', static fn(Request $request, array $params, array $identity): HttpResponse => ServiceRequestContentController::objectArchive((int)$params['id'], $request, $identity), true);


        // PORTAL_SUPPORT_UNREAD_V1
        $router->add(
            'GET',
            '/api/portal/support/unread',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                \Portal\Controllers\SupportController::unreadSummary(
                    $identity,
                ),
            true,
        );

        // PORTAL_SUPPORT_THREADS_V1
        $router->add(
            'GET',
            '/api/portal/support/threads',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                \Portal\Controllers\SupportController::userThreads(
                    $identity,
                ),
            true,
        );

        $router->add(
            'POST',
            '/api/portal/support/threads',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                \Portal\Controllers\SupportController::createThread(
                    $request,
                    $identity,
                ),
            true,
        );

        $router->add(
            'GET',
            '/api/portal/support/threads/{id}',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                \Portal\Controllers\SupportController::userThread(
                    (int)$params['id'],
                    $identity,
                ),
            true,
        );

        $router->add(
            'POST',
            '/api/portal/support/threads/{id}/messages',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                \Portal\Controllers\SupportController::addUserMessage(
                    (int)$params['id'],
                    $request,
                    $identity,
                ),
            true,
        );

        $router->add(
            'GET',
            '/api/portal/admin/support/threads',
            static fn(): HttpResponse =>
                \Portal\Controllers\SupportController::adminThreads(),
            true,
            true,
        );

        $router->add(
            'GET',
            '/api/portal/admin/support/threads/{id}',
            static fn(
                Request $request,
                array $params,
            ): HttpResponse =>
                \Portal\Controllers\SupportController::adminThread(
                    (int)$params['id'],
                ),
            true,
            true,
        );

        $router->add(
            'POST',
            '/api/portal/admin/support/threads/{id}/messages',
            static fn(
                Request $request,
                array $params,
                array $identity,
            ): HttpResponse =>
                \Portal\Controllers\SupportController::addAdminMessage(
                    (int)$params['id'],
                    $request,
                    $identity,
                ),
            true,
            true,
        );

        $router->add(
            'PUT',
            '/api/portal/admin/support/threads/{id}',
            static fn(
                Request $request,
                array $params,
            ): HttpResponse =>
                \Portal\Controllers\SupportController::updateStatus(
                    (int)$params['id'],
                    $request,
                ),
            true,
            true,
        );

        return $router;
    }
}
