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

final class ServiceRequestContentController
{
    private const GLOBAL_ROLES = [
        'Dispatcher',
        'Manager',
        'Administrator',
    ];

    private const COMMENT_TYPES = [
        'Service',
        'Client',
        'System',
    ];

    private const ATTACHMENT_TYPES = [
        'BeforePhoto',
        'AfterPhoto',
        'ActPhoto',
        'Video',
        'Scheme',
        'Contract',
        'Other',
    ];

    private const MAX_FILE_SIZE = 104857600;

    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/heic' => 'heic',
        'image/heif' => 'heif',
        'video/mp4' => 'mp4',
        'video/quicktime' => 'mov',
        'video/webm' => 'webm',
        'application/pdf' => 'pdf',
    ];

    private static bool $archiveMaintenanceCompleted = false;

    public static function comments(
        int $id,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];

        $access = self::requestAccess($id, $userId);

        if ($access === null) {
            return HttpResponse::json([
                'message' => 'Заявка не найдена или недоступна',
            ], 404);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                rc.id,
                rc.comment_type,
                rc.message,
                rc.is_internal,
                rc.created_at,
                rc.updated_at,

                u.id AS author_id,
                u.first_name,
                u.last_name,
                u.middle_name,
                u.avatar_url,
                u.position

            FROM request_comments rc

            LEFT JOIN users u
                ON u.id = rc.author_user_id

            WHERE rc.request_id = :request_id

            ORDER BY rc.created_at, rc.id
            SQL);

        $statement->execute([
            'request_id' => $id,
        ]);

        $result = [];

        foreach ($statement->fetchAll() as $row) {
            $result[] = [
                'id' => (int)$row['id'],
                'type' => (string)$row['comment_type'],
                'message' => (string)$row['message'],
                'isInternal' => self::dbBool($row['is_internal']),

                'author' =>
                    $row['author_id'] !== null
                        ? [
                            'id' => (int)$row['author_id'],
                            'firstName' => (string)$row['first_name'],
                            'lastName' => (string)$row['last_name'],
                            'middleName' =>
                                $row['middle_name'] !== null
                                    ? (string)$row['middle_name']
                                    : null,
                            'avatarUrl' =>
                                $row['avatar_url'] !== null
                                    ? (string)$row['avatar_url']
                                    : null,
                            'position' =>
                                $row['position'] !== null
                                    ? (string)$row['position']
                                    : null,
                        ]
                        : null,

                'createdAt' => Values::dateTime(
                    (string)$row['created_at'],
                ),

                'updatedAt' => Values::dateTime(
                    (string)$row['updated_at'],
                ),
            ];
        }

        return HttpResponse::json($result);
    }

    public static function addComment(
        int $id,
        Request $request,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];
        $access = self::requestAccess($id, $userId);

        if ($access === null) {
            return HttpResponse::json([
                'message' => 'Заявка не найдена или недоступна',
            ], 404);
        }

        if ($access['isArchived']) {
            return HttpResponse::json([
                'message' => 'Архивная заявка доступна только для чтения',
            ], 400);
        }

        if (!$access['canWrite']) {
            return HttpResponse::json([
                'message' => 'Недостаточно прав для добавления комментария',
            ], 403);
        }

        $body = $request->json();

        $type = self::text($body, 'type', 30);

        if ($type === '') {
            $type = 'Service';
        }

        $message = self::text(
            $body,
            'message',
            10000,
        );

        if (!in_array($type, self::COMMENT_TYPES, true)) {
            return HttpResponse::json([
                'message' => 'Неизвестный тип комментария',
            ], 400);
        }

        if (
            $type === 'System'
            && !$access['isGlobal']
        ) {
            return HttpResponse::json([
                'message' => 'Системные комментарии может добавлять только диспетчер или руководитель',
            ], 403);
        }

        if (mb_strlen($message) < 1) {
            return HttpResponse::json([
                'message' => 'Введите комментарий',
            ], 400);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            INSERT INTO request_comments
            (
                request_id,
                author_user_id,
                comment_type,
                message,
                is_internal
            )
            VALUES
            (
                :request_id,
                :author_user_id,
                :comment_type,
                :message,
                :is_internal
            )
            RETURNING id, created_at
            SQL);

        $statement->execute([
            'request_id' => $id,
            'author_user_id' => $userId,
            'comment_type' => $type,
            'message' => $message,
            'is_internal' => $type !== 'Client',
        ]);

        $row = $statement->fetch();

        return HttpResponse::json([
            'success' => true,
            'id' => (int)$row['id'],
            'type' => $type,
            'message' => $message,
            'createdAt' => Values::dateTime(
                (string)$row['created_at'],
            ),
        ], 201);
    }

    public static function attachments(
        int $id,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];

        if (self::requestAccess($id, $userId) === null) {
            return HttpResponse::json([
                'message' => 'Заявка не найдена или недоступна',
            ], 404);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                ra.id,
                ra.attachment_type,
                ra.file_name,
                ra.original_name,
                ra.file_url,
                ra.mime_type,
                ra.file_size,
                ra.quality_score,
                ra.is_document_scan,
                ra.created_at,

                u.id AS uploader_id,
                u.first_name,
                u.last_name

            FROM request_attachments ra

            LEFT JOIN users u
                ON u.id = ra.uploaded_by_user_id

            WHERE ra.request_id = :request_id
              AND ra.deleted_at IS NULL

            ORDER BY
                CASE ra.attachment_type
                    WHEN 'BeforePhoto' THEN 1
                    WHEN 'AfterPhoto' THEN 2
                    WHEN 'ActPhoto' THEN 3
                    WHEN 'Video' THEN 4
                    ELSE 5
                END,
                ra.created_at,
                ra.id
            SQL);

        $statement->execute([
            'request_id' => $id,
        ]);

        $result = [];

        foreach ($statement->fetchAll() as $row) {
            $result[] = self::attachmentRow($row);
        }

        return HttpResponse::json($result);
    }

    public static function uploadAttachment(
        int $id,
        array $identity,
    ): HttpResponse {
        $userId = (int)$identity['userId'];
        $access = self::requestAccess($id, $userId);

        if ($access === null) {
            return HttpResponse::json([
                'message' => 'Заявка не найдена или недоступна',
            ], 404);
        }

        if ($access['isArchived']) {
            return HttpResponse::json([
                'message' => 'В архивную заявку нельзя добавлять файлы',
            ], 400);
        }

        if (!$access['canWrite']) {
            return HttpResponse::json([
                'message' => 'Недостаточно прав для загрузки файлов',
            ], 403);
        }

        $attachmentType = trim(
            (string)($_POST['attachmentType'] ?? 'Other'),
        );

        if (
            !in_array(
                $attachmentType,
                self::ATTACHMENT_TYPES,
                true,
            )
        ) {
            return HttpResponse::json([
                'message' => 'Неизвестный тип вложения',
            ], 400);
        }

        if (
            !isset($_FILES['file'])
            || !is_array($_FILES['file'])
        ) {
            return HttpResponse::json([
                'message' => 'Файл не передан',
            ], 400);
        }

        $file = $_FILES['file'];
        $uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($uploadError !== UPLOAD_ERR_OK) {
            return HttpResponse::json([
                'message' => self::uploadErrorMessage($uploadError),
            ], 400);
        }

        $temporaryPath = (string)($file['tmp_name'] ?? '');
        $fileSize = (int)($file['size'] ?? 0);

        if (
            $temporaryPath === ''
            || !is_uploaded_file($temporaryPath)
        ) {
            return HttpResponse::json([
                'message' => 'Получен некорректный файл',
            ], 400);
        }

        if ($fileSize <= 0) {
            return HttpResponse::json([
                'message' => 'Файл пустой',
            ], 400);
        }

        if ($fileSize > self::MAX_FILE_SIZE) {
            return HttpResponse::json([
                'message' => 'Размер файла превышает 100 МБ',
            ], 400);
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mimeType = (string)$finfo->file($temporaryPath);

        if (!isset(self::MIME_EXTENSIONS[$mimeType])) {
            return HttpResponse::json([
                'message' => 'Этот формат файла не поддерживается',
                'mimeType' => $mimeType,
            ], 400);
        }

        if (
            $attachmentType === 'Video'
            && !str_starts_with($mimeType, 'video/')
        ) {
            return HttpResponse::json([
                'message' => 'Для типа «Видео» необходимо выбрать видеофайл',
            ], 400);
        }

        if (
            $attachmentType !== 'Video'
            && str_starts_with($mimeType, 'video/')
        ) {
            return HttpResponse::json([
                'message' => 'Видеофайл необходимо загрузить с типом «Видео»',
            ], 400);
        }

        $originalName = self::safeOriginalName(
            (string)($file['name'] ?? 'file'),
        );

        $extension = self::MIME_EXTENSIONS[$mimeType];
        $storedName = bin2hex(random_bytes(24)) . '.' . $extension;

        $directory = sprintf(
            '/opt/portal/uploads/service-requests/%d',
            $id,
        );

        if (
            !is_dir($directory)
            && !mkdir($directory, 0755, true)
            && !is_dir($directory)
        ) {
            return HttpResponse::json([
                'message' => 'Не удалось подготовить каталог загрузки',
            ], 500);
        }

        $storagePath = $directory . '/' . $storedName;

        if (!move_uploaded_file($temporaryPath, $storagePath)) {
            return HttpResponse::json([
                'message' => 'Не удалось сохранить файл',
            ], 500);
        }

        chmod($storagePath, 0644);

        $sha256 = hash_file('sha256', $storagePath);

        if (!is_string($sha256)) {
            @unlink($storagePath);

            return HttpResponse::json([
                'message' => 'Не удалось проверить загруженный файл',
            ], 500);
        }

        $qualityScore = self::nullableFormNumber(
            'qualityScore',
        );

        if (
            $qualityScore !== null
            && ($qualityScore < 0 || $qualityScore > 100)
        ) {
            @unlink($storagePath);

            return HttpResponse::json([
                'message' => 'Оценка качества должна быть от 0 до 100',
            ], 400);
        }

        $isDocumentScan = self::formBool(
            'isDocumentScan',
        );

        $fileUrl = sprintf(
            '/portal-uploads/service-requests/%d/%s',
            $id,
            $storedName,
        );

        try {
            $statement = Database::connection()->prepare(<<<'SQL'
                INSERT INTO request_attachments
                (
                    request_id,
                    uploaded_by_user_id,
                    attachment_type,
                    file_name,
                    original_name,
                    file_url,
                    storage_path,
                    mime_type,
                    file_size,
                    quality_score,
                    is_document_scan,
                    sha256
                )
                VALUES
                (
                    :request_id,
                    :uploaded_by_user_id,
                    :attachment_type,
                    :file_name,
                    :original_name,
                    :file_url,
                    :storage_path,
                    :mime_type,
                    :file_size,
                    :quality_score,
                    :is_document_scan,
                    :sha256
                )
                RETURNING
                    id,
                    attachment_type,
                    file_name,
                    original_name,
                    file_url,
                    mime_type,
                    file_size,
                    quality_score,
                    is_document_scan,
                    created_at
                SQL);

            $statement->execute([
                'request_id' => $id,
                'uploaded_by_user_id' => $userId,
                'attachment_type' => $attachmentType,
                'file_name' => $storedName,
                'original_name' => $originalName,
                'file_url' => $fileUrl,
                'storage_path' => $storagePath,
                'mime_type' => $mimeType,
                'file_size' => $fileSize,
                'quality_score' => $qualityScore,
                'is_document_scan' => $isDocumentScan,
                'sha256' => $sha256,
            ]);

            $row = $statement->fetch();

            return HttpResponse::json([
                'success' => true,
                'attachment' => [
                    'id' => (int)$row['id'],
                    'type' => (string)$row['attachment_type'],
                    'fileName' => (string)$row['file_name'],
                    'originalName' =>
                        $row['original_name'] !== null
                            ? (string)$row['original_name']
                            : null,
                    'fileUrl' => (string)$row['file_url'],
                    'mimeType' => (string)$row['mime_type'],
                    'fileSize' => (int)$row['file_size'],
                    'qualityScore' =>
                        $row['quality_score'] !== null
                            ? (float)$row['quality_score']
                            : null,
                    'isDocumentScan' => self::dbBool(
                        $row['is_document_scan'],
                    ),
                    'createdAt' => Values::dateTime(
                        (string)$row['created_at'],
                    ),
                ],
            ], 201);
        } catch (Throwable $exception) {
            @unlink($storagePath);
            throw $exception;
        }
    }

    public static function close(
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
                'message' => 'Отсканируйте штрих-код акта',
            ], 400);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $access = self::lockRequestAccess(
                $pdo,
                $id,
                $userId,
            );

            if ($access === null) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Заявка не найдена или недоступна',
                ], 404);
            }

            if (!$access['isAssigned']) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Закрыть заявку может назначенный техник',
                ], 403);
            }

            if ($access['isArchived']) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Архивную заявку изменить нельзя',
                ], 400);
            }

            if ($access['status'] !== 'Completed') {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Закрыть можно только полностью выполненную заявку',
                ], 400);
            }

            $expectedBarcode = trim(
                (string)($access['expectedActBarcode'] ?? ''),
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
                    'message' => 'Штрих-код не относится к акту этой заявки',
                ], 400);
            }

            $attachmentsStatement = $pdo->prepare(<<<'SQL'
                SELECT id
                FROM request_attachments
                WHERE request_id = :request_id
                  AND attachment_type = 'ActPhoto'
                  AND deleted_at IS NULL
                ORDER BY created_at, id
                FOR UPDATE
                SQL);

            $attachmentsStatement->execute([
                'request_id' => $id,
            ]);

            $actAttachments = $attachmentsStatement->fetchAll();

            if ($actAttachments === []) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Перед закрытием загрузите хотя бы одну страницу акта',
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
                    'Act',
                    NULLIF(:barcode_format, ''),
                    :barcode_value,
                    :user_id,
                    :latitude,
                    :longitude,
                    :accuracy
                )
                RETURNING id
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

            $barcodeId = (int)$barcodeStatement->fetchColumn();

            $actStatement = $pdo->prepare(<<<'SQL'
                INSERT INTO request_acts
                (
                    request_id,
                    barcode_id,
                    status,
                    created_by_user_id,
                    validated_by_user_id,
                    validated_at
                )
                VALUES
                (
                    :request_id,
                    :barcode_id,
                    'Validated',
                    :user_id,
                    :user_id,
                    NOW()
                )
                ON CONFLICT (request_id)
                DO UPDATE SET
                    barcode_id = EXCLUDED.barcode_id,
                    status = 'Validated',
                    validated_by_user_id = EXCLUDED.validated_by_user_id,
                    validated_at = NOW(),
                    updated_at = NOW()
                RETURNING id
                SQL);

            $actStatement->execute([
                'request_id' => $id,
                'barcode_id' => $barcodeId,
                'user_id' => $userId,
            ]);

            $actId = (int)$actStatement->fetchColumn();

            $deletePagesStatement = $pdo->prepare(<<<'SQL'
                DELETE FROM request_act_pages
                WHERE act_id = :act_id
                SQL);

            $deletePagesStatement->execute([
                'act_id' => $actId,
            ]);

            $pageStatement = $pdo->prepare(<<<'SQL'
                INSERT INTO request_act_pages
                (
                    act_id,
                    attachment_id,
                    page_number
                )
                VALUES
                (
                    :act_id,
                    :attachment_id,
                    :page_number
                )
                SQL);

            foreach ($actAttachments as $index => $attachment) {
                $pageStatement->execute([
                    'act_id' => $actId,
                    'attachment_id' => $attachment['id'],
                    'page_number' => $index + 1,
                ]);
            }

            $updateStatement = $pdo->prepare(<<<'SQL'
                UPDATE service_requests
                SET
                    status = 'Closed',
                    progress_percent = 100,
                    closed_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
                  AND status = 'Completed'
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
                'Completed',
                'Closed',
                sprintf(
                    'Акт подтверждён. Загружено страниц: %d',
                    count($actAttachments),
                ),
                'Mobile',
                $geo['latitude'],
                $geo['longitude'],
                $geo['accuracy'],
            );

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'status' => 'Closed',
                'actId' => $actId,
                'barcodeId' => $barcodeId,
                'pagesCount' => count($actAttachments),
            ]);
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ($exception->getCode() === '23505') {
                return HttpResponse::json([
                    'message' => 'Этот штрих-код акта уже использован',
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

    public static function objectHistory(
        int $objectId,
        Request $request,
        array $identity,
    ): HttpResponse {
        return self::readObjectRequests(
            $objectId,
            $request,
            $identity,
            false,
        );
    }

    public static function objectArchive(
        int $objectId,
        Request $request,
        array $identity,
    ): HttpResponse {
        return self::readObjectRequests(
            $objectId,
            $request,
            $identity,
            true,
        );
    }

    private static function readObjectRequests(
        int $objectId,
        Request $request,
        array $identity,
        bool $archiveOnly,
    ): HttpResponse {
        self::archiveOldRequests();

        $userId = (int)$identity['userId'];

        if (!self::canAccessObject($objectId, $userId)) {
            return HttpResponse::json([
                'message' => 'Объект не найден или недоступен',
            ], 404);
        }

        $status = trim(
            (string)($request->queryString('status') ?? ''),
        );

        $search = trim(
            (string)($request->queryString('search') ?? ''),
        );

        $dateFrom = trim(
            (string)($request->queryString('dateFrom') ?? ''),
        );

        $dateTo = trim(
            (string)($request->queryString('dateTo') ?? ''),
        );

        if (
            $dateFrom !== ''
            && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) !== 1
        ) {
            return HttpResponse::json([
                'message' => 'Дата начала указана неверно',
            ], 400);
        }

        if (
            $dateTo !== ''
            && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo) !== 1
        ) {
            return HttpResponse::json([
                'message' => 'Дата окончания указана неверно',
            ], 400);
        }

        $conditions = [
            'sr.object_id = :object_id',
        ];

        $parameters = [
            'object_id' => $objectId,
        ];

        if ($archiveOnly) {
            $conditions[] = 'sr.is_archived = TRUE';
        }

        if ($status !== '') {
            $conditions[] = 'sr.status = :status';
            $parameters['status'] = $status;
        }

        if ($search !== '') {
            $conditions[] = <<<'SQL'
                (
                    sr.request_number ILIKE :search
                    OR sr.title ILIKE :search
                    OR sr.problem_type ILIKE :search
                    OR CONCAT_WS(
                        ' ',
                        technician.last_name,
                        technician.first_name,
                        technician.middle_name
                    ) ILIKE :search
                )
                SQL;

            $parameters['search'] = '%' . $search . '%';
        }

        if ($dateFrom !== '') {
            $conditions[] = 'sr.created_at >= :date_from::date';
            $parameters['date_from'] = $dateFrom;
        }

        if ($dateTo !== '') {
            $conditions[] =
                "sr.created_at < (:date_to::date + INTERVAL '1 day')";

            $parameters['date_to'] = $dateTo;
        }

        $where = implode("\n AND ", $conditions);

        $statement = Database::connection()->prepare(
            <<<SQL
            SELECT
                sr.id,
                sr.request_number,
                sr.title,
                sr.problem_type,
                sr.status,
                sr.priority,
                sr.progress_percent,
                sr.is_repeat,
                sr.is_defect,
                sr.is_archived,
                sr.source_request_id,
                sr.created_at,
                sr.completed_at,
                sr.closed_at,
                sr.archived_at,

                technician.id AS technician_id,
                technician.first_name AS technician_first_name,
                technician.last_name AS technician_last_name,
                technician.middle_name AS technician_middle_name,

                (
                    SELECT COUNT(*)
                    FROM request_attachments ra
                    WHERE ra.request_id = sr.id
                      AND ra.deleted_at IS NULL
                )::integer AS attachments_count,

                (
                    SELECT COUNT(*)
                    FROM request_comments rc
                    WHERE rc.request_id = sr.id
                )::integer AS comments_count

            FROM service_requests sr

            LEFT JOIN users technician
                ON technician.id = sr.primary_technician_id

            WHERE {$where}

            ORDER BY sr.created_at DESC, sr.id DESC
            SQL,
        );

        $statement->execute($parameters);

        $result = [];

        foreach ($statement->fetchAll() as $row) {
            $result[] = [
                'id' => (int)$row['id'],
                'requestNumber' => (string)$row['request_number'],
                'title' => (string)$row['title'],

                'problemType' =>
                    $row['problem_type'] !== null
                        ? (string)$row['problem_type']
                        : null,

                'status' => (string)$row['status'],
                'priority' => (string)$row['priority'],
                'progressPercent' => (float)$row['progress_percent'],

                'isRepeat' => self::dbBool($row['is_repeat']),
                'isDefect' => self::dbBool($row['is_defect']),
                'isArchived' => self::dbBool($row['is_archived']),
                'readOnly' => self::dbBool($row['is_archived']),

                'sourceRequestId' =>
                    $row['source_request_id'] !== null
                        ? (int)$row['source_request_id']
                        : null,

                'technician' =>
                    $row['technician_id'] !== null
                        ? [
                            'id' => (int)$row['technician_id'],
                            'firstName' =>
                                (string)$row['technician_first_name'],
                            'lastName' =>
                                (string)$row['technician_last_name'],
                            'middleName' =>
                                $row['technician_middle_name'] !== null
                                    ? (string)$row['technician_middle_name']
                                    : null,
                        ]
                        : null,

                'attachmentsCount' =>
                    (int)$row['attachments_count'],

                'commentsCount' =>
                    (int)$row['comments_count'],

                'createdAt' => Values::dateTime(
                    (string)$row['created_at'],
                ),

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

                'archivedAt' =>
                    $row['archived_at'] !== null
                        ? Values::dateTime(
                            (string)$row['archived_at'],
                        )
                        : null,
            ];
        }

        return HttpResponse::json([
            'objectId' => $objectId,
            'archiveOnly' => $archiveOnly,
            'items' => $result,
        ]);
    }

    private static function archiveOldRequests(): void
    {
        if (self::$archiveMaintenanceCompleted) {
            return;
        }

        self::$archiveMaintenanceCompleted = true;

        Database::connection()->exec(<<<'SQL'
            UPDATE service_requests
            SET
                is_archived = TRUE,
                archived_at = COALESCE(archived_at, NOW()),
                updated_at = NOW()
            WHERE is_archived = FALSE
              AND status IN ('Closed', 'Defect')
              AND COALESCE(
                    closed_at,
                    defect_at,
                    completed_at,
                    updated_at
                  ) < NOW() - INTERVAL '30 days'
            SQL);
    }

    private static function requestAccess(
        int $requestId,
        int $userId,
    ): ?array {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                sr.id,
                sr.status,
                sr.is_archived,

                u.service_role,

                (
                    sr.primary_technician_id = :primary_user_id
                    OR EXISTS (
                        SELECT 1
                        FROM request_assignees ra
                        WHERE ra.request_id = sr.id
                          AND ra.user_id = :assignee_user_id
                          AND ra.removed_at IS NULL
                    )
                ) AS is_assigned

            FROM service_requests sr

            JOIN users u
                ON u.id = :role_user_id
               AND u.is_active = TRUE

            WHERE sr.id = :request_id
            SQL);

        $statement->execute([
            'primary_user_id' => $userId,
            'assignee_user_id' => $userId,
            'role_user_id' => $userId,
            'request_id' => $requestId,
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            return null;
        }

        $isAssigned = self::dbBool($row['is_assigned']);

        $isGlobal = in_array(
            (string)$row['service_role'],
            self::GLOBAL_ROLES,
            true,
        );

        if (!$isAssigned && !$isGlobal) {
            return null;
        }

        return [
            'id' => (int)$row['id'],
            'status' => (string)$row['status'],
            'isArchived' => self::dbBool(
                $row['is_archived'],
            ),
            'isAssigned' => $isAssigned,
            'isGlobal' => $isGlobal,
            'canWrite' => $isAssigned || $isGlobal,
        ];
    }

    private static function lockRequestAccess(
        PDO $pdo,
        int $requestId,
        int $userId,
    ): ?array {
        $statement = $pdo->prepare(<<<'SQL'
            SELECT
                sr.id,
                sr.status,
                sr.is_archived,
                sr.expected_act_barcode,

                (
                    sr.primary_technician_id = :primary_user_id
                    OR EXISTS (
                        SELECT 1
                        FROM request_assignees ra
                        WHERE ra.request_id = sr.id
                          AND ra.user_id = :assignee_user_id
                          AND ra.removed_at IS NULL
                    )
                ) AS is_assigned

            FROM service_requests sr

            WHERE sr.id = :request_id

            FOR UPDATE
            SQL);

        $statement->execute([
            'primary_user_id' => $userId,
            'assignee_user_id' => $userId,
            'request_id' => $requestId,
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            return null;
        }

        return [
            'id' => (int)$row['id'],
            'status' => (string)$row['status'],
            'isArchived' => self::dbBool(
                $row['is_archived'],
            ),
            'isAssigned' => self::dbBool(
                $row['is_assigned'],
            ),
            'expectedActBarcode' =>
                $row['expected_act_barcode'] !== null
                    ? (string)$row['expected_act_barcode']
                    : null,
        ];
    }

    private static function canAccessObject(
        int $objectId,
        int $userId,
    ): bool {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                u.service_role,

                EXISTS (
                    SELECT 1
                    FROM service_requests sr
                    WHERE sr.object_id = :object_id
                      AND (
                          sr.primary_technician_id = :primary_user_id
                          OR EXISTS (
                              SELECT 1
                              FROM request_assignees ra
                              WHERE ra.request_id = sr.id
                                AND ra.user_id = :assignee_user_id
                          )
                      )
                ) AS has_access

            FROM users u

            WHERE u.id = :user_id
              AND u.is_active = TRUE
            SQL);

        $statement->execute([
            'object_id' => $objectId,
            'primary_user_id' => $userId,
            'assignee_user_id' => $userId,
            'user_id' => $userId,
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            return false;
        }

        return self::dbBool($row['has_access'])
            || in_array(
                (string)$row['service_role'],
                self::GLOBAL_ROLES,
                true,
            );
    }

    private static function attachmentRow(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'type' => (string)$row['attachment_type'],
            'fileName' => (string)$row['file_name'],

            'originalName' =>
                $row['original_name'] !== null
                    ? (string)$row['original_name']
                    : null,

            'fileUrl' => (string)$row['file_url'],

            'mimeType' =>
                $row['mime_type'] !== null
                    ? (string)$row['mime_type']
                    : null,

            'fileSize' =>
                $row['file_size'] !== null
                    ? (int)$row['file_size']
                    : null,

            'qualityScore' =>
                $row['quality_score'] !== null
                    ? (float)$row['quality_score']
                    : null,

            'isDocumentScan' => self::dbBool(
                $row['is_document_scan'],
            ),

            'uploadedBy' =>
                $row['uploader_id'] !== null
                    ? [
                        'id' => (int)$row['uploader_id'],
                        'firstName' => (string)$row['first_name'],
                        'lastName' => (string)$row['last_name'],
                    ]
                    : null,

            'createdAt' => Values::dateTime(
                (string)$row['created_at'],
            ),
        ];
    }

    private static function addStatusHistory(
        PDO $pdo,
        int $requestId,
        ?int $userId,
        ?string $oldStatus,
        string $newStatus,
        string $comment,
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
                :comment,
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
            'comment' => $comment,
            'source' => $source,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy' => $accuracy,
        ]);
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

    private static function safeOriginalName(string $name): string
    {
        $name = basename($name);

        $name = preg_replace(
            '/[\x00-\x1F\x7F]+/u',
            '',
            $name,
        ) ?? 'file';

        $name = trim($name);

        if ($name === '') {
            $name = 'file';
        }

        return mb_strlen($name) > 500
            ? mb_substr($name, 0, 500)
            : $name;
    }

    private static function uploadErrorMessage(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE,
            UPLOAD_ERR_FORM_SIZE =>
                'Размер файла превышает допустимый лимит',

            UPLOAD_ERR_PARTIAL =>
                'Файл был загружен не полностью',

            UPLOAD_ERR_NO_FILE =>
                'Файл не выбран',

            UPLOAD_ERR_NO_TMP_DIR =>
                'На сервере отсутствует временный каталог',

            UPLOAD_ERR_CANT_WRITE =>
                'Сервер не смог записать файл',

            UPLOAD_ERR_EXTENSION =>
                'Загрузка остановлена расширением PHP',

            default =>
                'Не удалось загрузить файл',
        };
    }

    private static function nullableFormNumber(
        string $key,
    ): ?float {
        if (
            !isset($_POST[$key])
            || $_POST[$key] === ''
        ) {
            return null;
        }

        return is_numeric($_POST[$key])
            ? (float)$_POST[$key]
            : null;
    }

    private static function formBool(string $key): bool
    {
        if (!isset($_POST[$key])) {
            return false;
        }

        return in_array(
            strtolower(trim((string)$_POST[$key])),
            ['1', 'true', 'yes', 'on'],
            true,
        );
    }

    private static function number(
        array $body,
        string $key,
    ): ?float {
        if (
            !array_key_exists($key, $body)
            || $body[$key] === null
            || $body[$key] === ''
            || !is_numeric($body[$key])
        ) {
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
        $value = self::text(
            $body,
            $key,
            $limit,
        );

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
