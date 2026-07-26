<?php

declare(strict_types=1);

namespace Portal\Controllers;

use PDO;
use PDOException;
use Portal\Database;
use Portal\HttpResponse;
use Portal\Request;
use Portal\Values;
use Throwable;

final class ServiceRequestController
{
    private const GLOBAL_ROLES = [
        'Dispatcher',
        'Manager',
        'Administrator',
    ];

    private const ACTIVE_STATUSES = [
        'New',
        'Accepted',
        'OnSite',
        'InProgress',
        'Waiting',
        'PartiallyCompleted',
        'Defect',
        'Repeat',
    ];

    private const PRIORITIES = [
        'Low',
        'Normal',
        'High',
        'Critical',
    ];

    public static function index(
        Request $request,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];

        try {
            $connection = Database::connection();

            $userStatement = $connection->prepare(
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

            $userRow = $userStatement->fetch();

            if (!is_array($userRow)) {
                return HttpResponse::json([
                    'message' => 'Пользователь не найден',
                ], 404);
            }

            $authRole = (string)(
                $userRow['role'] ?? 'User'
            );

            $serviceRole = trim(
                (string)(
                    $userRow['service_role'] ?? ''
                )
            );

            if ($serviceRole === '') {
                $serviceRole = $authRole === 'Admin'
                    ? 'Administrator'
                    : 'Technician';
            }

            $hasGlobalAccess =
                $authRole === 'Admin'
                || in_array(
                    $serviceRole,
                    self::GLOBAL_ROLES,
                    true,
                );

            $status = trim(
                (string)(
                    $request->queryString('status')
                    ?? ''
                ),
            );

            $archiveValue = strtolower(
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

            $isArchive = in_array(
                $archiveValue,
                ['1', 'true', 'yes'],
                true,
            );

            $conditions = [
                $isArchive
                    ? 'sr.is_archived IS TRUE'
                    : 'sr.is_archived IS FALSE',
            ];

            $parameters = [
                'role_primary_user_id' => $userId,
                'role_assistant_user_id' => $userId,
            ];

            if (!$hasGlobalAccess) {
                $conditions[] = <<<'SQL'
                    (
                        sr.primary_technician_id =
                            :access_primary_user_id

                        OR EXISTS (
                            SELECT 1
                            FROM request_assignees access_ra
                            WHERE
                                access_ra.request_id = sr.id
                                AND access_ra.user_id =
                                    :access_assistant_user_id
                                AND access_ra.removed_at IS NULL
                        )
                    )
                    SQL;

                $parameters['access_primary_user_id'] =
                    $userId;

                $parameters['access_assistant_user_id'] =
                    $userId;
            }

            if ($status !== '') {
                $conditions[] = 'sr.status = :status';
                $parameters['status'] = $status;
            }

            if ($search !== '') {
                $searchPattern = '%' . $search . '%';

                $conditions[] = <<<'SQL'
                    (
                        sr.request_number ILIKE
                            :search_request_number

                        OR sr.title ILIKE
                            :search_title

                        OR COALESCE(so.name, '') ILIKE
                            :search_object_name

                        OR COALESCE(so.address, '') ILIKE
                            :search_object_address
                    )
                    SQL;

                $parameters['search_request_number'] =
                    $searchPattern;

                $parameters['search_title'] =
                    $searchPattern;

                $parameters['search_object_name'] =
                    $searchPattern;

                $parameters['search_object_address'] =
                    $searchPattern;
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
                    sr.created_at,
                    sr.updated_at,

                    sr.primary_technician_id,

                    so.id AS object_id,
                    so.name AS object_name,
                    so.address AS object_address,
                    so.latitude AS object_latitude,
                    so.longitude AS object_longitude,

                    CASE
                        WHEN sr.primary_technician_id =
                            :role_primary_user_id
                        THEN 'Primary'

                        WHEN EXISTS (
                            SELECT 1
                            FROM request_assignees role_ra
                            WHERE
                                role_ra.request_id = sr.id
                                AND role_ra.user_id =
                                    :role_assistant_user_id
                                AND role_ra.removed_at IS NULL
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

                    CASE sr.status
                        WHEN 'Defect' THEN 1
                        WHEN 'Repeat' THEN 2
                        WHEN 'InProgress' THEN 3
                        WHEN 'OnSite' THEN 4
                        WHEN 'Accepted' THEN 5
                        WHEN 'New' THEN 6
                        WHEN 'Waiting' THEN 7
                        WHEN 'PartiallyCompleted' THEN 8
                        WHEN 'Completed' THEN 9
                        WHEN 'Closed' THEN 10
                        ELSE 11
                    END,

                    sr.sla_deadline NULLS LAST,
                    sr.created_at DESC

                LIMIT 500
                SQL;

            $statement = $connection->prepare($sql);
            $statement->execute($parameters);

            $rows = $statement->fetchAll();

            $toBool = static function (
                mixed $value
            ): bool {
                if (is_bool($value)) {
                    return $value;
                }

                if (is_int($value)) {
                    return $value === 1;
                }

                return in_array(
                    strtolower(
                        trim((string)$value),
                    ),
                    ['1', 't', 'true', 'yes', 'on'],
                    true,
                );
            };

            $nullableString = static function (
                mixed $value
            ): ?string {
                if ($value === null) {
                    return null;
                }

                $result = trim((string)$value);

                return $result !== ''
                    ? $result
                    : null;
            };

            $result = [];

            foreach ($rows as $row) {
                $objectLatitude =
                    $row['object_latitude'] !== null
                        ? (float)$row['object_latitude']
                        : null;

                $objectLongitude =
                    $row['object_longitude'] !== null
                        ? (float)$row['object_longitude']
                        : null;

                $object = [
                    'id' =>
                        $row['object_id'] !== null
                            ? (int)$row['object_id']
                            : null,

                    'name' =>
                        $nullableString(
                            $row['object_name'] ?? null,
                        ),

                    'address' =>
                        $nullableString(
                            $row['object_address'] ?? null,
                        ),

                    'latitude' => $objectLatitude,
                    'longitude' => $objectLongitude,
                ];

                $result[] = [
                    'id' => (int)$row['id'],

                    'requestNumber' =>
                        (string)$row['request_number'],

                    'title' =>
                        (string)$row['title'],

                    'description' =>
                        $nullableString(
                            $row['description'] ?? null,
                        ),

                    'problemType' =>
                        $nullableString(
                            $row['problem_type'] ?? null,
                        ),

                    'priority' =>
                        (string)$row['priority'],

                    'slaDeadline' =>
                        $nullableString(
                            $row['sla_deadline'] ?? null,
                        ),

                    'status' =>
                        (string)$row['status'],

                    'progressPercent' =>
                        (float)$row['progress_percent'],

                    'isRepeat' =>
                        $toBool($row['is_repeat']),

                    'isDefect' =>
                        $toBool($row['is_defect']),

                    'isArchived' =>
                        $toBool($row['is_archived']),

                    'assignmentRole' =>
                        $nullableString(
                            $row['assignment_role'] ?? null,
                        ),

                    'primaryTechnicianId' =>
                        $row['primary_technician_id'] !== null
                            ? (int)$row['primary_technician_id']
                            : null,

                    'createdAt' =>
                        (string)$row['created_at'],

                    'updatedAt' =>
                        (string)$row['updated_at'],

                    'objectId' => $object['id'],
                    'objectName' => $object['name'],
                    'objectAddress' => $object['address'],
                    'objectLatitude' =>
                        $object['latitude'],
                    'objectLongitude' =>
                        $object['longitude'],

                    'object' => $object,
                ];
            }

            return HttpResponse::json($result);
        } catch (\Throwable $exception) {
            error_log(
                '[SERVICE_REQUEST_INDEX] '
                . get_class($exception)
                . ': '
                . $exception->getMessage()
                . ' in '
                . $exception->getFile()
                . ':'
                . $exception->getLine()
            );

            return HttpResponse::json([
                'message' =>
                    'Не удалось загрузить заявки',
            ], 500);
        }
    }

    public static function show(
        int $id,
        array $identity,
    ): HttpResponse {
        $access = self::requestAccess(
            $id,
            (int)$identity['userId'],
        );

        if ($access === null) {
            return HttpResponse::json([
                'message' => 'Заявка не найдена или недоступна',
            ], 404);
        }

        return HttpResponse::json(
            self::detail(
                $id,
                (int)$identity['userId'],
            ),
        );
    }

    public static function create(
        Request $request,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];
        $role = self::serviceRole($userId);

        if (!in_array($role, self::GLOBAL_ROLES, true)) {
            return HttpResponse::json([
                'message' => 'Недостаточно прав для создания заявки',
            ], 403);
        }

        $body = $request->json();

        $requestNumber = self::text(
            $body,
            'requestNumber',
            100,
        );

        $title = self::text(
            $body,
            'title',
            500,
        );

        $description = self::nullableText(
            $body,
            'description',
            10000,
        );

        $problemType = self::nullableText(
            $body,
            'problemType',
            255,
        );

        $priority = self::text(
            $body,
            'priority',
            30,
        );

        if ($priority === '') {
            $priority = 'Normal';
        }

        $objectId = self::positiveInt(
            $body,
            'objectId',
        );

        $primaryTechnicianId = self::positiveInt(
            $body,
            'primaryTechnicianId',
        );

        $slaDeadlineInput = self::nullableText(
            $body,
            'slaDeadline',
            100,
        );

        $slaDeadline = $slaDeadlineInput !== null
            ? Values::inputDateTime($slaDeadlineInput)
            : null;

        $arrivalBarcode = self::nullableText(
            $body,
            'arrivalBarcode',
            500,
        );

        $actBarcode = self::nullableText(
            $body,
            'actBarcode',
            500,
        );

        $workItems = $body['workItems'] ?? null;

        if (mb_strlen($requestNumber) < 1) {
            return HttpResponse::json([
                'message' => 'Укажите номер заявки',
            ], 400);
        }

        if (mb_strlen($title) < 2) {
            return HttpResponse::json([
                'message' => 'Укажите название заявки',
            ], 400);
        }

        if ($objectId === null) {
            return HttpResponse::json([
                'message' => 'Укажите объект',
            ], 400);
        }

        if ($primaryTechnicianId === null) {
            return HttpResponse::json([
                'message' => 'Укажите основного техника',
            ], 400);
        }

        if (!in_array($priority, self::PRIORITIES, true)) {
            return HttpResponse::json([
                'message' => 'Неизвестный приоритет заявки',
            ], 400);
        }

        if (
            $slaDeadlineInput !== null
            && $slaDeadline === null
        ) {
            return HttpResponse::json([
                'message' => 'SLA-дедлайн указан неверно',
            ], 400);
        }

        $normalizedItems = self::normalizeWorkItems($workItems);

        if (isset($normalizedItems['error'])) {
            return HttpResponse::json([
                'message' => $normalizedItems['error'],
            ], 400);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $objectStatement = $pdo->prepare(<<<'SQL'
                SELECT id
                FROM service_objects
                WHERE id = :id
                  AND is_active = TRUE
                SQL);

            $objectStatement->execute([
                'id' => $objectId,
            ]);

            if ($objectStatement->fetchColumn() === false) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Объект не найден или отключён',
                ], 404);
            }

            $technicianStatement = $pdo->prepare(<<<'SQL'
                SELECT id
                FROM users
                WHERE id = :id
                  AND is_active = TRUE
                SQL);

            $technicianStatement->execute([
                'id' => $primaryTechnicianId,
            ]);

            if ($technicianStatement->fetchColumn() === false) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Техник не найден или отключён',
                ], 404);
            }

            $sourceRequestId = null;
            $isRepeat = false;
            $initialStatus = 'New';

            if ($problemType !== null && $problemType !== '') {
                $repeatStatement = $pdo->prepare(<<<'SQL'
                    SELECT id
                    FROM service_requests
                    WHERE object_id = :object_id
                      AND problem_type IS NOT NULL
                      AND LOWER(TRIM(problem_type))
                          = LOWER(TRIM(:problem_type))
                      AND created_at >= NOW() - INTERVAL '30 days'
                    ORDER BY created_at DESC
                    LIMIT 1
                    SQL);

                $repeatStatement->execute([
                    'object_id' => $objectId,
                    'problem_type' => $problemType,
                ]);

                $repeatId = $repeatStatement->fetchColumn();

                if ($repeatId !== false) {
                    $sourceRequestId = (int)$repeatId;
                    $isRepeat = true;
                    $initialStatus = 'Repeat';
                }
            }

            $insertStatement = $pdo->prepare(<<<'SQL'
                INSERT INTO service_requests
                (
                    request_number,
                    object_id,
                    created_by_user_id,
                    primary_technician_id,
                    source_request_id,
                    problem_type,
                    title,
                    description,
                    priority,
                    sla_deadline,
                    status,
                    progress_percent,
                    is_repeat,
                    expected_arrival_barcode,
                    expected_act_barcode,
                    source_system
                )
                VALUES
                (
                    :request_number,
                    :object_id,
                    :created_by_user_id,
                    :primary_technician_id,
                    :source_request_id,
                    NULLIF(:problem_type, ''),
                    :title,
                    NULLIF(:description, ''),
                    :priority,
                    :sla_deadline,
                    :status,
                    0,
                    :is_repeat,
                    NULLIF(:arrival_barcode, ''),
                    NULLIF(:act_barcode, ''),
                    'Portal'
                )
                RETURNING id
                SQL);

            $insertStatement->execute([
                'request_number' => $requestNumber,
                'object_id' => $objectId,
                'created_by_user_id' => $userId,
                'primary_technician_id' => $primaryTechnicianId,
                'source_request_id' => $sourceRequestId,
                'problem_type' => $problemType ?? '',
                'title' => $title,
                'description' => $description ?? '',
                'priority' => $priority,
                'sla_deadline' => $slaDeadline,
                'status' => $initialStatus,
                'is_repeat' => $isRepeat,
                'arrival_barcode' => $arrivalBarcode ?? '',
                'act_barcode' => $actBarcode ?? '',
            ]);

            $requestId = (int)$insertStatement->fetchColumn();

            $assigneeStatement = $pdo->prepare(<<<'SQL'
                INSERT INTO request_assignees
                (
                    request_id,
                    user_id,
                    assignment_role
                )
                VALUES
                (
                    :request_id,
                    :user_id,
                    'Primary'
                )
                SQL);

            $assigneeStatement->execute([
                'request_id' => $requestId,
                'user_id' => $primaryTechnicianId,
            ]);

            $itemStatement = $pdo->prepare(<<<'SQL'
                INSERT INTO request_work_items
                (
                    request_id,
                    work_type_id,
                    title,
                    weight,
                    sort_order
                )
                VALUES
                (
                    :request_id,
                    :work_type_id,
                    :title,
                    :weight,
                    :sort_order
                )
                SQL);

            foreach ($normalizedItems['items'] as $index => $item) {
                $itemStatement->execute([
                    'request_id' => $requestId,
                    'work_type_id' => $item['workTypeId'],
                    'title' => $item['title'],
                    'weight' => $item['weight'],
                    'sort_order' => $index,
                ]);
            }

            self::addStatusHistory(
                $pdo,
                $requestId,
                $userId,
                null,
                $initialStatus,
                $isRepeat
                    ? 'Автоматически определена повторная заявка'
                    : 'Заявка создана',
                'Portal',
                null,
                null,
                null,
            );

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'id' => $requestId,
                'status' => $initialStatus,
                'isRepeat' => $isRepeat,
                'sourceRequestId' => $sourceRequestId,
                'request' => self::detail(
                    $requestId,
                    $userId,
                ),
            ], 201);
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ($exception->getCode() === '23505') {
                return HttpResponse::json([
                    'message' => 'Заявка с таким номером уже существует',
                ], 409);
            }

            throw $exception;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    public static function accept(
        int $id,
        array $identity,
    ): HttpResponse {
        return self::simpleTransition(
            $id,
            (int)$identity['userId'],
            ['New', 'Repeat', 'Defect'],
            'Accepted',
            'Заявка принята техником',
            static function (
                PDO $pdo,
                int $requestId,
                int $userId,
            ): void {
                $statement = $pdo->prepare(<<<'SQL'
                    UPDATE service_requests
                    SET
                        accepted_at = NOW(),
                        updated_at = NOW()
                    WHERE id = :id
                    SQL);

                $statement->execute([
                    'id' => $requestId,
                ]);

                $assigneeStatement = $pdo->prepare(<<<'SQL'
                    UPDATE request_assignees
                    SET accepted_at = COALESCE(accepted_at, NOW())
                    WHERE request_id = :request_id
                      AND user_id = :user_id
                      AND removed_at IS NULL
                    SQL);

                $assigneeStatement->execute([
                    'request_id' => $requestId,
                    'user_id' => $userId,
                ]);
            },
        );
    }

    public static function arrive(
        int $id,
        Request $request,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];
        $body = $request->json();

        $barcodeValue = self::text(
            $body,
            'barcodeValue',
            500,
        );

        $barcodeFormat = self::nullableText(
            $body,
            'barcodeFormat',
            30,
        );

        $geo = self::geo($body);

        if (isset($geo['error'])) {
            return HttpResponse::json([
                'message' => $geo['error'],
            ], 400);
        }

        if (mb_strlen($barcodeValue) < 2) {
            return HttpResponse::json([
                'message' => 'Отсканируйте штрих-код объекта',
            ], 400);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $row = self::lockAssignedRequest(
                $pdo,
                $id,
                $userId,
            );

            if ($row === null) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Заявка не найдена или недоступна',
                ], 404);
            }

            if ($row['status'] !== 'Accepted') {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Прибытие можно зафиксировать только после принятия заявки',
                ], 400);
            }

            $expectedBarcode = trim(
                (string)($row['expected_arrival_barcode'] ?? ''),
            );

            if (
                $expectedBarcode !== ''
                && !hash_equals(
                    $expectedBarcode,
                    $barcodeValue,
                )
            ) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Штрих-код не относится к этой заявке',
                ], 400);
            }

            $barcodeStatement = $pdo->prepare(<<<'SQL'
                INSERT INTO request_barcodes
                (
                    request_id,
                    barcode_type,
                    barcode_format,
                    barcode_value,
                    scanned_by_user_id,
                    latitude,
                    longitude,
                    accuracy
                )
                VALUES
                (
                    :request_id,
                    'Arrival',
                    NULLIF(:barcode_format, ''),
                    :barcode_value,
                    :user_id,
                    :latitude,
                    :longitude,
                    :accuracy
                )
                SQL);

            $barcodeStatement->execute([
                'request_id' => $id,
                'barcode_format' => $barcodeFormat ?? '',
                'barcode_value' => $barcodeValue,
                'user_id' => $userId,
                'latitude' => $geo['latitude'],
                'longitude' => $geo['longitude'],
                'accuracy' => $geo['accuracy'],
            ]);

            $updateStatement = $pdo->prepare(<<<'SQL'
                UPDATE service_requests
                SET
                    status = 'OnSite',
                    arrival_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
                  AND status = 'Accepted'
                RETURNING id
                SQL);

            $updateStatement->execute([
                'id' => $id,
            ]);

            if ($updateStatement->fetchColumn() === false) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Состояние заявки уже изменилось',
                ], 409);
            }

            self::addStatusHistory(
                $pdo,
                $id,
                $userId,
                'Accepted',
                'OnSite',
                'Прибытие подтверждено штрих-кодом',
                'Mobile',
                $geo['latitude'],
                $geo['longitude'],
                $geo['accuracy'],
            );

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'status' => 'OnSite',
                'request' => self::detail($id, $userId),
            ]);
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ($exception->getCode() === '23505') {
                return HttpResponse::json([
                    'message' => 'Этот штрих-код уже был отсканирован',
                ], 409);
            }

            throw $exception;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    public static function startWork(
        int $id,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $row = self::lockAssignedRequest(
                $pdo,
                $id,
                $userId,
            );

            if ($row === null) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Заявка не найдена или недоступна',
                ], 404);
            }

            $oldStatus = (string)$row['status'];

            if (
                !in_array(
                    $oldStatus,
                    ['OnSite', 'Waiting', 'PartiallyCompleted'],
                    true,
                )
            ) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Начать или продолжить работы сейчас нельзя',
                ], 400);
            }

            if ($oldStatus === 'Waiting') {
                $waitStatement = $pdo->prepare(<<<'SQL'
                    UPDATE request_wait_periods
                    SET
                        finished_by_user_id = :user_id,
                        finished_at = NOW(),
                        duration_seconds = GREATEST(
                            0,
                            EXTRACT(
                                EPOCH FROM (
                                    NOW() - started_at
                                )
                            )::bigint
                        )
                    WHERE request_id = :request_id
                      AND finished_at IS NULL
                    SQL);

                $waitStatement->execute([
                    'user_id' => $userId,
                    'request_id' => $id,
                ]);
            }

            $updateStatement = $pdo->prepare(<<<'SQL'
                UPDATE service_requests
                SET
                    status = 'InProgress',
                    work_started_at = COALESCE(
                        work_started_at,
                        NOW()
                    ),
                    waiting_started_at = NULL,
                    updated_at = NOW()
                WHERE id = :id
                RETURNING id
                SQL);

            $updateStatement->execute([
                'id' => $id,
            ]);

            self::addStatusHistory(
                $pdo,
                $id,
                $userId,
                $oldStatus,
                'InProgress',
                $oldStatus === 'OnSite'
                    ? 'Работы начаты'
                    : 'Работы возобновлены',
                'Mobile',
                null,
                null,
                null,
            );

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'status' => 'InProgress',
                'request' => self::detail($id, $userId),
            ]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    public static function wait(
        int $id,
        Request $request,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];
        $body = $request->json();

        $reasonId = self::positiveInt(
            $body,
            'reasonId',
        );

        $comment = self::nullableText(
            $body,
            'comment',
            5000,
        );

        if ($reasonId === null) {
            return HttpResponse::json([
                'message' => 'Выберите причину ожидания',
            ], 400);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $reasonStatement = $pdo->prepare(<<<'SQL'
                SELECT id, title
                FROM request_wait_reasons
                WHERE id = :id
                  AND is_active = TRUE
                SQL);

            $reasonStatement->execute([
                'id' => $reasonId,
            ]);

            $reason = $reasonStatement->fetch();

            if (!is_array($reason)) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Причина ожидания недоступна',
                ], 400);
            }

            $row = self::lockAssignedRequest(
                $pdo,
                $id,
                $userId,
            );

            if ($row === null) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Заявка не найдена или недоступна',
                ], 404);
            }

            if ($row['status'] !== 'InProgress') {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'В ожидание можно перевести только выполняемую заявку',
                ], 400);
            }

            $waitStatement = $pdo->prepare(<<<'SQL'
                INSERT INTO request_wait_periods
                (
                    request_id,
                    reason_id,
                    started_by_user_id,
                    comment
                )
                VALUES
                (
                    :request_id,
                    :reason_id,
                    :user_id,
                    NULLIF(:comment, '')
                )
                SQL);

            $waitStatement->execute([
                'request_id' => $id,
                'reason_id' => $reasonId,
                'user_id' => $userId,
                'comment' => $comment ?? '',
            ]);

            $updateStatement = $pdo->prepare(<<<'SQL'
                UPDATE service_requests
                SET
                    status = 'Waiting',
                    waiting_started_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
                RETURNING id
                SQL);

            $updateStatement->execute([
                'id' => $id,
            ]);

            self::addStatusHistory(
                $pdo,
                $id,
                $userId,
                'InProgress',
                'Waiting',
                sprintf(
                    'Ожидание: %s%s',
                    (string)$reason['title'],
                    $comment !== null && $comment !== ''
                        ? '. ' . $comment
                        : '',
                ),
                'Mobile',
                null,
                null,
                null,
            );

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'status' => 'Waiting',
                'request' => self::detail($id, $userId),
            ]);
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ($exception->getCode() === '23505') {
                return HttpResponse::json([
                    'message' => 'Заявка уже находится в ожидании',
                ], 409);
            }

            throw $exception;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    public static function partial(
        int $id,
        Request $request,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];
        $body = $request->json();

        $comment = self::nullableText(
            $body,
            'comment',
            5000,
        );

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $row = self::lockAssignedRequest(
                $pdo,
                $id,
                $userId,
            );

            if ($row === null) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Заявка не найдена или недоступна',
                ], 404);
            }

            if ($row['status'] !== 'InProgress') {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Частично выполнить можно только активную заявку',
                ], 400);
            }

            $progress = (float)$row['progress_percent'];

            if ($progress <= 0 || $progress >= 100) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Для частичного выполнения прогресс должен быть от 1% до 99%',
                ], 400);
            }

            $updateStatement = $pdo->prepare(<<<'SQL'
                UPDATE service_requests
                SET
                    status = 'PartiallyCompleted',
                    updated_at = NOW()
                WHERE id = :id
                RETURNING id
                SQL);

            $updateStatement->execute([
                'id' => $id,
            ]);

            self::addStatusHistory(
                $pdo,
                $id,
                $userId,
                'InProgress',
                'PartiallyCompleted',
                $comment !== null && $comment !== ''
                    ? $comment
                    : 'Заявка выполнена частично',
                'Mobile',
                null,
                null,
                null,
            );

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'status' => 'PartiallyCompleted',
                'progressPercent' => $progress,
                'request' => self::detail($id, $userId),
            ]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    public static function completeWorkItem(
        int $id,
        int $itemId,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $requestRow = self::lockAssignedRequest(
                $pdo,
                $id,
                $userId,
            );

            if ($requestRow === null) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Заявка не найдена или недоступна',
                ], 404);
            }

            if ($requestRow['status'] !== 'InProgress') {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Отмечать работы можно только в заявке со статусом «В работе»',
                ], 400);
            }

            $itemStatement = $pdo->prepare(<<<'SQL'
                UPDATE request_work_items
                SET
                    is_completed = TRUE,
                    completed_by_user_id = :user_id,
                    completed_at = NOW()
                WHERE id = :item_id
                  AND request_id = :request_id
                  AND is_completed = FALSE
                RETURNING id, title, weight
                SQL);

            $itemStatement->execute([
                'user_id' => $userId,
                'item_id' => $itemId,
                'request_id' => $id,
            ]);

            $item = $itemStatement->fetch();

            if (!is_array($item)) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Пункт уже выполнен или не найден',
                ], 409);
            }

            $progressStatement = $pdo->prepare(<<<'SQL'
                SELECT
                    COALESCE(
                        SUM(weight) FILTER (
                            WHERE is_completed = TRUE
                        ),
                        0
                    )::numeric(5, 2) AS progress
                FROM request_work_items
                WHERE request_id = :request_id
                SQL);

            $progressStatement->execute([
                'request_id' => $id,
            ]);

            $progress = min(
                100,
                (float)$progressStatement->fetchColumn(),
            );

            $newStatus = $progress >= 100
                ? 'Completed'
                : 'InProgress';

            $updateStatement = $pdo->prepare(<<<'SQL'
                UPDATE service_requests
                SET
                    progress_percent = :progress,
                    status = :status,
                    completed_at = CASE
                        WHEN :status_for_completed = 'Completed'
                        THEN COALESCE(completed_at, NOW())
                        ELSE completed_at
                    END,
                    updated_at = NOW()
                WHERE id = :id
                RETURNING id
                SQL);

            $updateStatement->execute([
                'progress' => $progress,
                'status' => $newStatus,
                'status_for_completed' => $newStatus,
                'id' => $id,
            ]);

            if ($newStatus === 'Completed') {
                self::addStatusHistory(
                    $pdo,
                    $id,
                    $userId,
                    'InProgress',
                    'Completed',
                    'Все пункты работ выполнены',
                    'System',
                    null,
                    null,
                    null,
                );
            }

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'itemId' => (int)$item['id'],
                'itemTitle' => (string)$item['title'],
                'itemWeight' => (float)$item['weight'],
                'progressPercent' => $progress,
                'status' => $newStatus,
                'request' => self::detail($id, $userId),
            ]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    public static function waitReasons(): HttpResponse
    {
        $statement = Database::connection()->query(<<<'SQL'
            SELECT id, code, title
            FROM request_wait_reasons
            WHERE is_active = TRUE
            ORDER BY sort_order, id
            SQL);

        $result = [];

        foreach ($statement->fetchAll() as $row) {
            $result[] = [
                'id' => (int)$row['id'],
                'code' => (string)$row['code'],
                'title' => (string)$row['title'],
            ];
        }

        return HttpResponse::json($result);
    }

    private static function simpleTransition(
        int $id,
        int $userId,
        array $allowedStatuses,
        string $newStatus,
        string $comment,
        ?callable $afterUpdate = null,
    ): HttpResponse {
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $row = self::lockAssignedRequest(
                $pdo,
                $id,
                $userId,
            );

            if ($row === null) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Заявка не найдена или недоступна',
                ], 404);
            }

            $oldStatus = (string)$row['status'];

            if (!in_array($oldStatus, $allowedStatuses, true)) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Переход в этот статус сейчас недоступен',
                ], 400);
            }

            $statement = $pdo->prepare(<<<'SQL'
                UPDATE service_requests
                SET
                    status = :status,
                    updated_at = NOW()
                WHERE id = :id
                RETURNING id
                SQL);

            $statement->execute([
                'status' => $newStatus,
                'id' => $id,
            ]);

            if ($afterUpdate !== null) {
                $afterUpdate($pdo, $id, $userId);
            }

            self::addStatusHistory(
                $pdo,
                $id,
                $userId,
                $oldStatus,
                $newStatus,
                $comment,
                'Mobile',
                null,
                null,
                null,
            );

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'status' => $newStatus,
                'request' => self::detail($id, $userId),
            ]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    private static function detail(
        int $id,
        int $userId,
    ): array {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                sr.*,

                so.id AS object_id,
                so.name AS object_name,
                so.address AS object_address,
                so.latitude AS object_latitude,
                so.longitude AS object_longitude,
                so.control_panel_numbers,
                so.description AS object_description,

                dr.title AS defect_reason_title

            FROM service_requests sr

            JOIN service_objects so
                ON so.id = sr.object_id

            LEFT JOIN defect_reasons dr
                ON dr.id = sr.defect_reason_id

            WHERE sr.id = :id
            SQL);

        $statement->execute([
            'id' => $id,
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            return [];
        }

        $workStatement = Database::connection()->prepare(<<<'SQL'
            SELECT
                rwi.id,
                rwi.work_type_id,
                rwi.title,
                rwi.weight,
                rwi.sort_order,
                rwi.is_completed,
                rwi.completed_at,
                rwi.completed_by_user_id,

                u.first_name AS completed_first_name,
                u.last_name AS completed_last_name

            FROM request_work_items rwi

            LEFT JOIN users u
                ON u.id = rwi.completed_by_user_id

            WHERE rwi.request_id = :request_id

            ORDER BY rwi.sort_order, rwi.id
            SQL);

        $workStatement->execute([
            'request_id' => $id,
        ]);

        $workItems = [];

        foreach ($workStatement->fetchAll() as $item) {
            $workItems[] = [
                'id' => (int)$item['id'],

                'workTypeId' =>
                    $item['work_type_id'] !== null
                        ? (int)$item['work_type_id']
                        : null,

                'title' => (string)$item['title'],
                'weight' => (float)$item['weight'],
                'isCompleted' => self::dbBool(
                    $item['is_completed'],
                ),

                'completedAt' =>
                    $item['completed_at'] !== null
                        ? Values::dateTime(
                            (string)$item['completed_at'],
                        )
                        : null,

                'completedBy' =>
                    $item['completed_by_user_id'] !== null
                        ? [
                            'id' => (int)$item['completed_by_user_id'],
                            'firstName' => (string)$item['completed_first_name'],
                            'lastName' => (string)$item['completed_last_name'],
                        ]
                        : null,
            ];
        }

        $assigneeStatement = Database::connection()->prepare(<<<'SQL'
            SELECT
                ra.user_id,
                ra.assignment_role,
                ra.assigned_at,
                ra.accepted_at,

                u.first_name,
                u.last_name,
                u.middle_name,
                u.avatar_url,
                u.position

            FROM request_assignees ra

            JOIN users u
                ON u.id = ra.user_id

            WHERE ra.request_id = :request_id
              AND ra.removed_at IS NULL

            ORDER BY
                CASE ra.assignment_role
                    WHEN 'Primary' THEN 1
                    ELSE 2
                END,
                u.last_name,
                u.first_name
            SQL);

        $assigneeStatement->execute([
            'request_id' => $id,
        ]);

        $assignees = [];

        foreach ($assigneeStatement->fetchAll() as $assignee) {
            $assignees[] = [
                'userId' => (int)$assignee['user_id'],
                'role' => (string)$assignee['assignment_role'],
                'firstName' => (string)$assignee['first_name'],
                'lastName' => (string)$assignee['last_name'],
                'middleName' =>
                    $assignee['middle_name'] !== null
                        ? (string)$assignee['middle_name']
                        : null,
                'avatarUrl' =>
                    $assignee['avatar_url'] !== null
                        ? (string)$assignee['avatar_url']
                        : null,
                'position' =>
                    $assignee['position'] !== null
                        ? (string)$assignee['position']
                        : null,
                'assignedAt' => Values::dateTime(
                    (string)$assignee['assigned_at'],
                ),
                'acceptedAt' =>
                    $assignee['accepted_at'] !== null
                        ? Values::dateTime(
                            (string)$assignee['accepted_at'],
                        )
                        : null,
            ];
        }

        $contactStatement = Database::connection()->prepare(<<<'SQL'
            SELECT
                id,
                full_name,
                position,
                phone,
                email,
                comment,
                is_primary
            FROM object_contacts
            WHERE object_id = :object_id
            ORDER BY is_primary DESC, id
            SQL);

        $contactStatement->execute([
            'object_id' => $row['object_id'],
        ]);

        $contacts = [];

        foreach ($contactStatement->fetchAll() as $contact) {
            $contacts[] = [
                'id' => (int)$contact['id'],
                'fullName' =>
                    $contact['full_name'] !== null
                        ? (string)$contact['full_name']
                        : null,
                'position' =>
                    $contact['position'] !== null
                        ? (string)$contact['position']
                        : null,
                'phone' =>
                    $contact['phone'] !== null
                        ? (string)$contact['phone']
                        : null,
                'email' =>
                    $contact['email'] !== null
                        ? (string)$contact['email']
                        : null,
                'comment' =>
                    $contact['comment'] !== null
                        ? (string)$contact['comment']
                        : null,
                'isPrimary' => self::dbBool(
                    $contact['is_primary'],
                ),
            ];
        }

        $historyStatement = Database::connection()->prepare(<<<'SQL'
            SELECT
                rsh.id,
                rsh.old_status,
                rsh.new_status,
                rsh.comment,
                rsh.source,
                rsh.latitude,
                rsh.longitude,
                rsh.created_at,

                u.id AS user_id,
                u.first_name,
                u.last_name

            FROM request_status_history rsh

            LEFT JOIN users u
                ON u.id = rsh.changed_by_user_id

            WHERE rsh.request_id = :request_id

            ORDER BY rsh.created_at DESC, rsh.id DESC
            SQL);

        $historyStatement->execute([
            'request_id' => $id,
        ]);

        $history = [];

        foreach ($historyStatement->fetchAll() as $historyRow) {
            $history[] = [
                'id' => (int)$historyRow['id'],
                'oldStatus' =>
                    $historyRow['old_status'] !== null
                        ? (string)$historyRow['old_status']
                        : null,
                'newStatus' => (string)$historyRow['new_status'],
                'comment' =>
                    $historyRow['comment'] !== null
                        ? (string)$historyRow['comment']
                        : null,
                'source' => (string)$historyRow['source'],
                'latitude' =>
                    $historyRow['latitude'] !== null
                        ? (float)$historyRow['latitude']
                        : null,
                'longitude' =>
                    $historyRow['longitude'] !== null
                        ? (float)$historyRow['longitude']
                        : null,
                'createdAt' => Values::dateTime(
                    (string)$historyRow['created_at'],
                ),
                'user' =>
                    $historyRow['user_id'] !== null
                        ? [
                            'id' => (int)$historyRow['user_id'],
                            'firstName' => (string)$historyRow['first_name'],
                            'lastName' => (string)$historyRow['last_name'],
                        ]
                        : null,
            ];
        }

        return [
            'id' => (int)$row['id'],
            'requestNumber' => (string)$row['request_number'],
            'title' => (string)$row['title'],
            'description' =>
                $row['description'] !== null
                    ? (string)$row['description']
                    : null,
            'problemType' =>
                $row['problem_type'] !== null
                    ? (string)$row['problem_type']
                    : null,
            'priority' => (string)$row['priority'],
            'status' => (string)$row['status'],
            'progressPercent' => (float)$row['progress_percent'],
            'slaDeadline' =>
                $row['sla_deadline'] !== null
                    ? Values::dateTime(
                        (string)$row['sla_deadline'],
                    )
                    : null,

            'isRepeat' => self::dbBool($row['is_repeat']),
            'isDefect' => self::dbBool($row['is_defect']),
            'isArchived' => self::dbBool($row['is_archived']),

            'sourceRequestId' =>
                $row['source_request_id'] !== null
                    ? (int)$row['source_request_id']
                    : null,

            'expectedArrivalBarcodeConfigured' =>
                trim(
                    (string)($row['expected_arrival_barcode'] ?? ''),
                ) !== '',

            'expectedActBarcodeConfigured' =>
                trim(
                    (string)($row['expected_act_barcode'] ?? ''),
                ) !== '',

            'object' => [
                'id' => (int)$row['object_id'],
                'name' => (string)$row['object_name'],
                'address' => (string)$row['object_address'],
                'latitude' =>
                    $row['object_latitude'] !== null
                        ? (float)$row['object_latitude']
                        : null,
                'longitude' =>
                    $row['object_longitude'] !== null
                        ? (float)$row['object_longitude']
                        : null,
                'controlPanelNumbers' =>
                    $row['control_panel_numbers'] !== null
                        ? (string)$row['control_panel_numbers']
                        : null,
                'description' =>
                    $row['object_description'] !== null
                        ? (string)$row['object_description']
                        : null,
                'contacts' => $contacts,
            ],

            'assignees' => $assignees,
            'workItems' => $workItems,
            'statusHistory' => $history,

            'defect' =>
                self::dbBool($row['is_defect'])
                    ? [
                        'reasonId' =>
                            $row['defect_reason_id'] !== null
                                ? (int)$row['defect_reason_id']
                                : null,
                        'reasonTitle' =>
                            $row['defect_reason_title'] !== null
                                ? (string)$row['defect_reason_title']
                                : null,
                        'comment' =>
                            $row['defect_comment'] !== null
                                ? (string)$row['defect_comment']
                                : null,
                    ]
                    : null,

            'acceptedAt' =>
                $row['accepted_at'] !== null
                    ? Values::dateTime(
                        (string)$row['accepted_at'],
                    )
                    : null,

            'arrivalAt' =>
                $row['arrival_at'] !== null
                    ? Values::dateTime(
                        (string)$row['arrival_at'],
                    )
                    : null,

            'workStartedAt' =>
                $row['work_started_at'] !== null
                    ? Values::dateTime(
                        (string)$row['work_started_at'],
                    )
                    : null,

            'completedAt' =>
                $row['completed_at'] !== null
                    ? Values::dateTime(
                        (string)$row['completed_at'],
                    )
                    : null,

            'closedAt' =>
                $row['closed_at'] !== null
                    ? Values::dateTime(
                        (string)$row['closed_at'],
                    )
                    : null,

            'createdAt' => Values::dateTime(
                (string)$row['created_at'],
            ),

            'updatedAt' => Values::dateTime(
                (string)$row['updated_at'],
            ),

            'currentUserId' => $userId,
        ];
    }

    private static function summary(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'requestNumber' => (string)$row['request_number'],
            'title' => (string)$row['title'],
            'description' =>
                $row['description'] !== null
                    ? (string)$row['description']
                    : null,
            'problemType' =>
                $row['problem_type'] !== null
                    ? (string)$row['problem_type']
                    : null,
            'priority' => (string)$row['priority'],
            'status' => (string)$row['status'],
            'progressPercent' => (float)$row['progress_percent'],
            'isRepeat' => self::dbBool($row['is_repeat']),
            'isDefect' => self::dbBool($row['is_defect']),
            'isArchived' => self::dbBool($row['is_archived']),
            'slaDeadline' =>
                $row['sla_deadline'] !== null
                    ? Values::dateTime(
                        (string)$row['sla_deadline'],
                    )
                    : null,
            'object' => [
                'id' => (int)$row['object_id'],
                'name' => (string)$row['object_name'],
                'address' => (string)$row['object_address'],
                'latitude' =>
                    $row['object_latitude'] !== null
                        ? (float)$row['object_latitude']
                        : null,
                'longitude' =>
                    $row['object_longitude'] !== null
                        ? (float)$row['object_longitude']
                        : null,
            ],
            'assignmentRole' =>
                $row['assignment_role'] !== null
                    ? (string)$row['assignment_role']
                    : null,
            'createdAt' => Values::dateTime(
                (string)$row['created_at'],
            ),
            'updatedAt' => Values::dateTime(
                (string)$row['updated_at'],
            ),
        ];
    }

    private static function requestAccess(
        int $requestId,
        int $userId,
    ): ?array {
        $role = self::serviceRole($userId);

        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                sr.id,
                sr.primary_technician_id,

                EXISTS (
                    SELECT 1
                    FROM request_assignees ra
                    WHERE ra.request_id = sr.id
                      AND ra.user_id = :user_id
                      AND ra.removed_at IS NULL
                ) AS is_assigned

            FROM service_requests sr
            WHERE sr.id = :request_id
            SQL);

        $statement->execute([
            'user_id' => $userId,
            'request_id' => $requestId,
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            return null;
        }

        $assigned =
            (int)($row['primary_technician_id'] ?? 0) === $userId
            || self::dbBool($row['is_assigned']);

        if (
            !$assigned
            && !in_array($role, self::GLOBAL_ROLES, true)
        ) {
            return null;
        }

        return [
            'id' => (int)$row['id'],
            'isAssigned' => $assigned,
            'serviceRole' => $role,
        ];
    }

    private static function lockAssignedRequest(
        PDO $pdo,
        int $requestId,
        int $userId,
    ): ?array {
        $statement = $pdo->prepare(<<<'SQL'
            SELECT
                sr.id,
                sr.status,
                sr.progress_percent,
                sr.primary_technician_id,
                sr.expected_arrival_barcode,
                sr.expected_act_barcode

            FROM service_requests sr

            WHERE sr.id = :request_id
              AND (
                  sr.primary_technician_id = :primary_user_id
                  OR EXISTS (
                      SELECT 1
                      FROM request_assignees ra
                      WHERE ra.request_id = sr.id
                        AND ra.user_id = :assignee_user_id
                        AND ra.removed_at IS NULL
                  )
              )

            FOR UPDATE
            SQL);

        $statement->execute([
            'request_id' => $requestId,
            'primary_user_id' => $userId,
            'assignee_user_id' => $userId,
        ]);

        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    private static function addStatusHistory(
        PDO $pdo,
        int $requestId,
        ?int $userId,
        ?string $oldStatus,
        string $newStatus,
        ?string $comment,
        string $source,
        ?float $latitude,
        ?float $longitude,
        ?float $accuracy,
    ): void {
        $statement = $pdo->prepare(<<<'SQL'
            INSERT INTO request_status_history
            (
                request_id,
                changed_by_user_id,
                old_status,
                new_status,
                comment,
                source,
                latitude,
                longitude,
                accuracy
            )
            VALUES
            (
                :request_id,
                :user_id,
                :old_status,
                :new_status,
                NULLIF(:comment, ''),
                :source,
                :latitude,
                :longitude,
                :accuracy
            )
            SQL);

        $statement->execute([
            'request_id' => $requestId,
            'user_id' => $userId,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'comment' => $comment ?? '',
            'source' => $source,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy' => $accuracy,
        ]);
    }

    private static function normalizeWorkItems(
        mixed $items,
    ): array {
        if (!is_array($items) || $items === []) {
            return [
                'error' => 'Добавьте хотя бы один тип работ',
            ];
        }

        $result = [];
        $weightSum = 0.0;

        foreach ($items as $index => $item) {
            if (!is_array($item)) {
                return [
                    'error' => sprintf(
                        'Пункт работ №%d заполнен неверно',
                        $index + 1,
                    ),
                ];
            }

            $title = self::text(
                $item,
                'title',
                255,
            );

            $weight = self::number(
                $item,
                'weight',
            );

            $workTypeId = self::positiveInt(
                $item,
                'workTypeId',
            );

            if (mb_strlen($title) < 2) {
                return [
                    'error' => sprintf(
                        'Укажите название пункта №%d',
                        $index + 1,
                    ),
                ];
            }

            if (
                $weight === null
                || $weight <= 0
                || $weight > 100
            ) {
                return [
                    'error' => sprintf(
                        'Вес пункта №%d должен быть от 0 до 100',
                        $index + 1,
                    ),
                ];
            }

            $weightSum += $weight;

            $result[] = [
                'title' => $title,
                'weight' => $weight,
                'workTypeId' => $workTypeId,
            ];
        }

        if (abs($weightSum - 100) > 0.01) {
            return [
                'error' => sprintf(
                    'Сумма весов должна быть 100%%. Сейчас: %s%%',
                    rtrim(
                        rtrim(
                            number_format(
                                $weightSum,
                                2,
                                '.',
                                '',
                            ),
                            '0',
                        ),
                        '.',
                    ),
                ),
            ];
        }

        return [
            'items' => $result,
        ];
    }

    private static function serviceRole(int $userId): string
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT service_role
            FROM users
            WHERE id = :id
              AND is_active = TRUE
            SQL);

        $statement->execute([
            'id' => $userId,
        ]);

        $role = $statement->fetchColumn();

        return $role !== false
            ? (string)$role
            : 'Technician';
    }

    private static function geo(array $body): array
    {
        $latitude = self::number($body, 'latitude');
        $longitude = self::number($body, 'longitude');
        $accuracy = self::number($body, 'accuracy');

        if (($latitude === null) !== ($longitude === null)) {
            return [
                'error' => 'Широта и долгота должны передаваться вместе',
            ];
        }

        if (
            $latitude !== null
            && ($latitude < -90 || $latitude > 90)
        ) {
            return [
                'error' => 'Широта должна быть от -90 до 90',
            ];
        }

        if (
            $longitude !== null
            && ($longitude < -180 || $longitude > 180)
        ) {
            return [
                'error' => 'Долгота должна быть от -180 до 180',
            ];
        }

        if ($accuracy !== null && $accuracy < 0) {
            return [
                'error' => 'Точность не может быть отрицательной',
            ];
        }

        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy' => $accuracy,
        ];
    }

    private static function positiveInt(
        array $body,
        string $key,
    ): ?int {
        if (
            !array_key_exists($key, $body)
            || $body[$key] === null
            || $body[$key] === ''
            || !is_numeric($body[$key])
        ) {
            return null;
        }

        $value = (int)$body[$key];

        return $value > 0 ? $value : null;
    }

    private static function number(
        array $body,
        string $key,
    ): ?float {
        if (
            !array_key_exists($key, $body)
            || $body[$key] === null
            || $body[$key] === ''
        ) {
            return null;
        }

        if (!is_numeric($body[$key])) {
            return null;
        }

        return (float)$body[$key];
    }

    private static function text(
        array $body,
        string $key,
        int $limit,
    ): string {
        $value = array_key_exists($key, $body)
            ? trim((string)$body[$key])
            : '';

        return mb_strlen($value) > $limit
            ? mb_substr($value, 0, $limit)
            : $value;
    }

    private static function nullableText(
        array $body,
        string $key,
        int $limit,
    ): ?string {
        $value = self::text($body, $key, $limit);

        return $value !== '' ? $value : null;
    }

    private static function dbBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        return in_array(
            strtolower((string)$value),
            ['1', 't', 'true', 'yes', 'on'],
            true,
        );
    }
}
