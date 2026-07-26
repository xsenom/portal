<?php

declare(strict_types=1);

namespace Portal\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PDOException;
use Portal\Database;
use Portal\HttpResponse;
use Portal\Request;
use Portal\Values;
use Throwable;

final class WorkTimeController
{
    public static function dashboard(Request $request, array $identity): HttpResponse
    {
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));

        $year = $request->queryInt('year');
        $month = $request->queryInt('month');

        $selectedYear = $year !== null && $year >= 2000 && $year <= 2200
            ? $year
            : (int)$now->format('Y');

        $selectedMonth = $month !== null && $month >= 1 && $month <= 12
            ? $month
            : (int)$now->format('n');

        $periodStart = new DateTimeImmutable(
            sprintf('%04d-%02d-01 00:00:00', $selectedYear, $selectedMonth),
            new DateTimeZone('UTC'),
        );

        $periodEnd = $periodStart->modify('+1 month');

        $activeShift = self::readActiveShift((int)$identity['userId']);

        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                COALESCE((
                    SELECT SUM(
                        ws.work_seconds +
                        CASE
                            WHEN ws.status = 'Working'
                                 AND ws.current_segment_started_at IS NOT NULL
                            THEN GREATEST(
                                0,
                                EXTRACT(
                                    EPOCH FROM (
                                        NOW() - ws.current_segment_started_at
                                    )
                                )::bigint
                            )
                            ELSE 0
                        END
                    )
                    FROM work_shifts ws
                    WHERE ws.user_id = :user_id_shifts
                      AND ws.started_at >= :period_start_shifts
                      AND ws.started_at < :period_end_shifts
                ), 0)::bigint AS monthly_work_seconds,

                COALESCE((
                    SELECT SUM(t.reward_amount)
                    FROM tasks t
                    WHERE t.assigned_user_id = :user_id_earnings
                      AND t.status = 'Approved'
                      AND t.approved_at >= :period_start_earnings
                      AND t.approved_at < :period_end_earnings
                ), 0)::numeric(12, 2) AS monthly_earnings,

                (
                    SELECT COUNT(*)
                    FROM tasks t
                    WHERE t.assigned_user_id = :user_id_in_work
                      AND t.status IN ('InProgress', 'Submitted')
                )::integer AS tasks_in_work,

                (
                    SELECT COUNT(*)
                    FROM tasks t
                    WHERE t.assigned_user_id = :user_id_approved
                      AND t.status = 'Approved'
                      AND t.approved_at >= :period_start_approved
                      AND t.approved_at < :period_end_approved
                )::integer AS approved_tasks_count
            SQL);

        $statement->execute([
            'user_id_shifts' => $identity['userId'],
            'user_id_earnings' => $identity['userId'],
            'user_id_in_work' => $identity['userId'],
            'user_id_approved' => $identity['userId'],

            'period_start_shifts' => $periodStart->format('Y-m-d H:i:sP'),
            'period_end_shifts' => $periodEnd->format('Y-m-d H:i:sP'),

            'period_start_earnings' => $periodStart->format('Y-m-d H:i:sP'),
            'period_end_earnings' => $periodEnd->format('Y-m-d H:i:sP'),

            'period_start_approved' => $periodStart->format('Y-m-d H:i:sP'),
            'period_end_approved' => $periodEnd->format('Y-m-d H:i:sP'),
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            $row = [
                'monthly_work_seconds' => 0,
                'monthly_earnings' => 0,
                'tasks_in_work' => 0,
                'approved_tasks_count' => 0,
            ];
        }

        $serviceStatement = Database::connection()->prepare(<<<'SQL'
            SELECT COUNT(DISTINCT sr.id)
            FROM service_requests sr
            WHERE sr.status IN (
                'New',
                'Accepted',
                'OnSite',
                'InProgress',
                'Waiting',
                'PartiallyCompleted',
                'Repeat',
                'Defect'
            )
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
            SQL);

        $serviceStatement->execute([
            'primary_user_id' => $identity['userId'],
            'assignee_user_id' => $identity['userId'],
        ]);

        $serviceRequestsCount = (int)$serviceStatement->fetchColumn();
        $seconds = (int)$row['monthly_work_seconds'];

        $monthlyHours = round($seconds / 3600, 2);

        if (floor($monthlyHours) === $monthlyHours) {
            $monthlyHours = (int)$monthlyHours;
        }

        return HttpResponse::json([
            'year' => $selectedYear,
            'month' => $selectedMonth,
            'activeShift' => $activeShift,
            'monthlyWorkSeconds' => $seconds,
            'monthlyHours' => $monthlyHours,
            'monthlyEarnings' => (float)$row['monthly_earnings'],
            'tasksInWork' => (int)$row['tasks_in_work'],
            'approvedTasksCount' => (int)$row['approved_tasks_count'],
            'serviceRequestsCount' => $serviceRequestsCount,
        ]);
    }

    public static function pauseReasons(): HttpResponse
    {
        $statement = Database::connection()->query(<<<'SQL'
            SELECT id, code, title
            FROM pause_reasons
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

    public static function start(
        Request $request,
        array $identity
    ): HttpResponse {
        $body = $request->json();

        $number = static function (
            array $source,
            string $key
        ): ?float {
            if (!array_key_exists($key, $source)) {
                return null;
            }

            $value = $source[$key];

            if (
                $value === null
                || $value === ''
                || !is_numeric($value)
            ) {
                return null;
            }

            return (float)$value;
        };

        $string = static function (
            array $source,
            string $key
        ): ?string {
            if (
                !array_key_exists($key, $source)
                || !is_string($source[$key])
            ) {
                return null;
            }

            $value = trim($source[$key]);

            return $value !== ''
                ? $value
                : null;
        };

        $latitude = $number(
            $body,
            'latitude'
        );

        $longitude = $number(
            $body,
            'longitude'
        );

        $accuracy = $number(
            $body,
            'accuracy'
        );

        $device = $string(
            $body,
            'device'
        );

        $photoUrl =
            $string($body, 'photoUrl')
            ?? $string($body, 'photo_url')
            ?? $string($body, 'photo');

        if (
            ($latitude === null)
            !== ($longitude === null)
        ) {
            return HttpResponse::json([
                'message' =>
                    'Необходимо передать широту и долготу',
            ], 400);
        }

        if (
            $latitude !== null
            && (
                $latitude < -90
                || $latitude > 90
            )
        ) {
            return HttpResponse::json([
                'message' =>
                    'Широта указана неверно',
            ], 400);
        }

        if (
            $longitude !== null
            && (
                $longitude < -180
                || $longitude > 180
            )
        ) {
            return HttpResponse::json([
                'message' =>
                    'Долгота указана неверно',
            ], 400);
        }

        if (
            $accuracy !== null
            && $accuracy < 0
        ) {
            $accuracy = null;
        }

        if ($device !== null) {
            $device = substr(
                $device,
                0,
                500
            );
        }

        if ($photoUrl !== null) {
            $photoUrl = substr(
                $photoUrl,
                0,
                2048
            );
        }

        $statement = Database::connection()->prepare(
            <<<'SQL'
            INSERT INTO work_shifts
            (
                user_id,
                status,
                started_at,
                current_segment_started_at,
                start_latitude,
                start_longitude,
                start_accuracy,
                start_device,
                start_photo_url,
                created_at,
                updated_at
            )
            VALUES
            (
                :user_id,
                'Working',
                NOW(),
                NOW(),
                :start_latitude,
                :start_longitude,
                :start_accuracy,
                NULLIF(:start_device, ''),
                NULLIF(:start_photo_url, ''),
                NOW(),
                NOW()
            )
            ON CONFLICT DO NOTHING
            RETURNING id
            SQL
        );

        try {
            $statement->execute([
                'user_id' =>
                    (int)$identity['userId'],

                'start_latitude' =>
                    $latitude,

                'start_longitude' =>
                    $longitude,

                'start_accuracy' =>
                    $accuracy,

                'start_device' =>
                    $device ?? '',

                'start_photo_url' =>
                    $photoUrl ?? '',
            ]);

            $shiftId =
                $statement->fetchColumn();

            if ($shiftId === false) {
                return HttpResponse::json([
                    'message' =>
                        'Смена уже начата',
                ], 400);
            }

            return HttpResponse::json([
                'success' => true,
                'shiftId' => (int)$shiftId,
                'status' => 'Working',
            ]);
        } catch (\Throwable $exception) {
            error_log(
                '[PORTAL_TIME_START] '
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
                    'Не удалось начать смену',
            ], 500);
        }
    }

    public static function pause(Request $request, array $identity): HttpResponse
    {
        $body = $request->json();

        $reasonId = self::optionalPositiveInt($body, 'reasonId');
        $comment = self::optionalText($body, 'comment', 2000);

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            if ($reasonId === null) {
                $reasonStatement = $pdo->prepare(<<<'SQL'
                    SELECT id
                    FROM pause_reasons
                    WHERE code = 'other'
                      AND is_active = TRUE
                    LIMIT 1
                    SQL);

                $reasonStatement->execute();
                $reasonId = (int)$reasonStatement->fetchColumn();
            } else {
                $reasonStatement = $pdo->prepare(<<<'SQL'
                    SELECT id
                    FROM pause_reasons
                    WHERE id = :id
                      AND is_active = TRUE
                    LIMIT 1
                    SQL);

                $reasonStatement->execute([
                    'id' => $reasonId,
                ]);

                if ($reasonStatement->fetchColumn() === false) {
                    $pdo->rollBack();

                    return HttpResponse::json([
                        'message' => 'Выбранная причина паузы недоступна',
                    ], 400);
                }
            }

            if ($reasonId <= 0) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Не удалось определить причину паузы',
                ], 500);
            }

            $shiftStatement = $pdo->prepare(<<<'SQL'
                SELECT id, status
                FROM work_shifts
                WHERE user_id = :user_id
                  AND status IN ('Working', 'Paused')
                ORDER BY id DESC
                LIMIT 1
                FOR UPDATE
                SQL);

            $shiftStatement->execute([
                'user_id' => $identity['userId'],
            ]);

            $shift = $shiftStatement->fetch();

            if (!is_array($shift) || $shift['status'] !== 'Working') {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Активная рабочая смена не найдена',
                ], 400);
            }

            $updateStatement = $pdo->prepare(<<<'SQL'
                UPDATE work_shifts
                SET
                    work_seconds = work_seconds + CASE
                        WHEN current_segment_started_at IS NOT NULL
                        THEN GREATEST(
                            0,
                            EXTRACT(
                                EPOCH FROM (
                                    NOW() - current_segment_started_at
                                )
                            )::bigint
                        )
                        ELSE 0
                    END,
                    status = 'Paused',
                    current_segment_started_at = NULL,
                    current_pause_started_at = NOW(),
                    current_pause_reason_id = :reason_id,
                    pauses_count = pauses_count + 1,
                    updated_at = NOW()
                WHERE id = :shift_id
                  AND status = 'Working'
                RETURNING id
                SQL);

            $updateStatement->execute([
                'reason_id' => $reasonId,
                'shift_id' => $shift['id'],
            ]);

            if ($updateStatement->fetchColumn() === false) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Состояние смены уже изменилось',
                ], 409);
            }

            $pauseStatement = $pdo->prepare(<<<'SQL'
                INSERT INTO shift_pauses
                (
                    shift_id,
                    user_id,
                    reason_id,
                    comment,
                    started_at
                )
                VALUES
                (
                    :shift_id,
                    :user_id,
                    :reason_id,
                    NULLIF(:comment, ''),
                    NOW()
                )
                RETURNING id
                SQL);

            $pauseStatement->execute([
                'shift_id' => $shift['id'],
                'user_id' => $identity['userId'],
                'reason_id' => $reasonId,
                'comment' => $comment,
            ]);

            $pauseId = (int)$pauseStatement->fetchColumn();

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'pauseId' => $pauseId,
                'activeShift' => self::readActiveShift(
                    (int)$identity['userId'],
                ),
            ]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    public static function resume(array $identity): HttpResponse
    {
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $shiftStatement = $pdo->prepare(<<<'SQL'
                SELECT id, status
                FROM work_shifts
                WHERE user_id = :user_id
                  AND status IN ('Working', 'Paused')
                ORDER BY id DESC
                LIMIT 1
                FOR UPDATE
                SQL);

            $shiftStatement->execute([
                'user_id' => $identity['userId'],
            ]);

            $shift = $shiftStatement->fetch();

            if (!is_array($shift) || $shift['status'] !== 'Paused') {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Смена не находится на паузе',
                ], 400);
            }

            $closePauseStatement = $pdo->prepare(<<<'SQL'
                UPDATE shift_pauses
                SET
                    duration_seconds = GREATEST(
                        0,
                        EXTRACT(
                            EPOCH FROM (
                                NOW() - started_at
                            )
                        )::bigint
                    ),
                    finished_at = NOW()
                WHERE shift_id = :shift_id
                  AND finished_at IS NULL
                SQL);

            $closePauseStatement->execute([
                'shift_id' => $shift['id'],
            ]);

            $updateStatement = $pdo->prepare(<<<'SQL'
                UPDATE work_shifts
                SET
                    pause_seconds = pause_seconds + CASE
                        WHEN current_pause_started_at IS NOT NULL
                        THEN GREATEST(
                            0,
                            EXTRACT(
                                EPOCH FROM (
                                    NOW() - current_pause_started_at
                                )
                            )::bigint
                        )
                        ELSE 0
                    END,
                    status = 'Working',
                    current_pause_started_at = NULL,
                    current_pause_reason_id = NULL,
                    current_segment_started_at = NOW(),
                    updated_at = NOW()
                WHERE id = :shift_id
                  AND status = 'Paused'
                RETURNING id
                SQL);

            $updateStatement->execute([
                'shift_id' => $shift['id'],
            ]);

            if ($updateStatement->fetchColumn() === false) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Состояние смены уже изменилось',
                ], 409);
            }

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'activeShift' => self::readActiveShift(
                    (int)$identity['userId'],
                ),
            ]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    public static function finish(Request $request, array $identity): HttpResponse
    {
        $body = $request->json();
        $geo = self::readGeo($body);

        if (isset($geo['error'])) {
            return HttpResponse::json([
                'message' => $geo['error'],
            ], 400);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $shiftStatement = $pdo->prepare(<<<'SQL'
                SELECT id, status
                FROM work_shifts
                WHERE user_id = :user_id
                  AND status IN ('Working', 'Paused')
                ORDER BY id DESC
                LIMIT 1
                FOR UPDATE
                SQL);

            $shiftStatement->execute([
                'user_id' => $identity['userId'],
            ]);

            $shift = $shiftStatement->fetch();

            if (!is_array($shift)) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Активная смена не найдена',
                ], 400);
            }

            $activeRequestStatement = $pdo->prepare(<<<'SQL'
                SELECT sr.id, sr.request_number
                FROM service_requests sr
                WHERE sr.status IN ('OnSite', 'InProgress')
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
                ORDER BY sr.id
                LIMIT 1
                SQL);

            $activeRequestStatement->execute([
                'primary_user_id' => $identity['userId'],
                'assignee_user_id' => $identity['userId'],
            ]);

            $activeRequest = $activeRequestStatement->fetch();

            if (is_array($activeRequest)) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => sprintf(
                        'Сначала завершите работу с заявкой №%s',
                        (string)$activeRequest['request_number'],
                    ),
                    'requestId' => (int)$activeRequest['id'],
                    'requestNumber' => (string)$activeRequest['request_number'],
                ], 400);
            }

            if ($shift['status'] === 'Paused') {
                $closePauseStatement = $pdo->prepare(<<<'SQL'
                    UPDATE shift_pauses
                    SET
                        duration_seconds = GREATEST(
                            0,
                            EXTRACT(
                                EPOCH FROM (
                                    NOW() - started_at
                                )
                            )::bigint
                        ),
                        finished_at = NOW()
                    WHERE shift_id = :shift_id
                      AND finished_at IS NULL
                    SQL);

                $closePauseStatement->execute([
                    'shift_id' => $shift['id'],
                ]);
            }

            $finishStatement = $pdo->prepare(<<<'SQL'
                UPDATE work_shifts
                SET
                    work_seconds = work_seconds + CASE
                        WHEN status = 'Working'
                             AND current_segment_started_at IS NOT NULL
                        THEN GREATEST(
                            0,
                            EXTRACT(
                                EPOCH FROM (
                                    NOW() - current_segment_started_at
                                )
                            )::bigint
                        )
                        ELSE 0
                    END,

                    pause_seconds = pause_seconds + CASE
                        WHEN status = 'Paused'
                             AND current_pause_started_at IS NOT NULL
                        THEN GREATEST(
                            0,
                            EXTRACT(
                                EPOCH FROM (
                                    NOW() - current_pause_started_at
                                )
                            )::bigint
                        )
                        ELSE 0
                    END,

                    status = 'Completed',
                    finished_at = NOW(),

                    finish_latitude = :latitude,
                    finish_longitude = :longitude,
                    finish_accuracy = :accuracy,

                    current_segment_started_at = NULL,
                    current_pause_started_at = NULL,
                    current_pause_reason_id = NULL,
                    updated_at = NOW()

                WHERE id = :shift_id
                  AND status IN ('Working', 'Paused')

                RETURNING id, work_seconds, pause_seconds
                SQL);

            $finishStatement->execute([
                'shift_id' => $shift['id'],
                'latitude' => $geo['latitude'],
                'longitude' => $geo['longitude'],
                'accuracy' => $geo['accuracy'],
            ]);

            $result = $finishStatement->fetch();

            if (!is_array($result)) {
                $pdo->rollBack();

                return HttpResponse::json([
                    'message' => 'Состояние смены уже изменилось',
                ], 409);
            }

            $pdo->commit();

            return HttpResponse::json([
                'success' => true,
                'shiftId' => (int)$result['id'],
                'workSeconds' => (int)$result['work_seconds'],
                'pauseSeconds' => (int)$result['pause_seconds'],
            ]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }

    private static function readActiveShift(int $userId): ?array
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                ws.id,
                ws.status,
                ws.started_at,
                ws.work_seconds,
                ws.pause_seconds,
                ws.current_segment_started_at,
                ws.current_pause_started_at,
                ws.pauses_count,

                ws.start_latitude,
                ws.start_longitude,
                ws.start_accuracy,
                ws.start_device,
                ws.start_photo_url,

                ws.current_pause_reason_id,
                pr.code AS pause_reason_code,
                pr.title AS pause_reason_title

            FROM work_shifts ws

            LEFT JOIN pause_reasons pr
                ON pr.id = ws.current_pause_reason_id

            WHERE ws.user_id = :user_id
              AND ws.status IN ('Working', 'Paused')

            ORDER BY ws.id DESC
            LIMIT 1
            SQL);

        $statement->execute([
            'user_id' => $userId,
        ]);

        $row = $statement->fetch();

        if (!is_array($row)) {
            return null;
        }

        return [
            'id' => (int)$row['id'],
            'status' => (string)$row['status'],
            'startedAt' => Values::dateTime((string)$row['started_at']),
            'workSeconds' => (int)$row['work_seconds'],
            'pauseSeconds' => (int)$row['pause_seconds'],

            'currentSegmentStartedAt' =>
                $row['current_segment_started_at'] !== null
                    ? Values::dateTime(
                        (string)$row['current_segment_started_at'],
                    )
                    : null,

            'currentPauseStartedAt' =>
                $row['current_pause_started_at'] !== null
                    ? Values::dateTime(
                        (string)$row['current_pause_started_at'],
                    )
                    : null,

            'pausesCount' => (int)$row['pauses_count'],

            'startLatitude' =>
                $row['start_latitude'] !== null
                    ? (float)$row['start_latitude']
                    : null,

            'startLongitude' =>
                $row['start_longitude'] !== null
                    ? (float)$row['start_longitude']
                    : null,

            'startAccuracy' =>
                $row['start_accuracy'] !== null
                    ? (float)$row['start_accuracy']
                    : null,

            'startDevice' =>
                $row['start_device'] !== null
                    ? (string)$row['start_device']
                    : null,

            'startPhotoUrl' =>
                $row['start_photo_url'] !== null
                    ? (string)$row['start_photo_url']
                    : null,

            'pauseReason' =>
                $row['current_pause_reason_id'] !== null
                    ? [
                        'id' => (int)$row['current_pause_reason_id'],
                        'code' => (string)$row['pause_reason_code'],
                        'title' => (string)$row['pause_reason_title'],
                    ]
                    : null,
        ];
    }

    private static function readGeo(array $body): array
    {
        $latitudeResult = self::optionalNumber($body, 'latitude');
        $longitudeResult = self::optionalNumber($body, 'longitude');
        $accuracyResult = self::optionalNumber($body, 'accuracy');

        if (isset($latitudeResult['error'])) {
            return ['error' => 'Широта указана неверно'];
        }

        if (isset($longitudeResult['error'])) {
            return ['error' => 'Долгота указана неверно'];
        }

        if (isset($accuracyResult['error'])) {
            return ['error' => 'Точность геолокации указана неверно'];
        }

        $latitude = $latitudeResult['value'];
        $longitude = $longitudeResult['value'];
        $accuracy = $accuracyResult['value'];

        if (($latitude === null) !== ($longitude === null)) {
            return [
                'error' => 'Широта и долгота должны передаваться вместе',
            ];
        }

        if (
            $latitude !== null
            && ($latitude < -90 || $latitude > 90)
        ) {
            return ['error' => 'Широта должна быть от -90 до 90'];
        }

        if (
            $longitude !== null
            && ($longitude < -180 || $longitude > 180)
        ) {
            return ['error' => 'Долгота должна быть от -180 до 180'];
        }

        if ($accuracy !== null && $accuracy < 0) {
            return [
                'error' => 'Точность геолокации не может быть отрицательной',
            ];
        }

        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy' => $accuracy,
        ];
    }

    private static function optionalNumber(
        array $body,
        string $key,
    ): array {
        if (
            !array_key_exists($key, $body)
            || $body[$key] === null
            || $body[$key] === ''
        ) {
            return ['value' => null];
        }

        if (!is_numeric($body[$key])) {
            return ['error' => true];
        }

        return [
            'value' => (float)$body[$key],
        ];
    }

    private static function optionalPositiveInt(
        array $body,
        string $key,
    ): ?int {
        if (
            !array_key_exists($key, $body)
            || $body[$key] === null
            || $body[$key] === ''
        ) {
            return null;
        }

        if (
            !is_numeric($body[$key])
            || (int)$body[$key] <= 0
        ) {
            return null;
        }

        return (int)$body[$key];
    }

    private static function optionalText(
        array $body,
        string $key,
        int $maximumLength,
    ): string {
        if (!array_key_exists($key, $body)) {
            return '';
        }

        $value = trim((string)$body[$key]);

        if (mb_strlen($value) > $maximumLength) {
            return mb_substr($value, 0, $maximumLength);
        }

        return $value;
    }
}
