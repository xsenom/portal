<?php

declare(strict_types=1);

namespace Portal\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use PDOException;
use Portal\Database;
use Portal\HttpResponse;
use Portal\Mapper;
use Portal\Request;

final class WorkTimeController
{
    public static function dashboard(Request $request, array $identity): HttpResponse
    {
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $year = $request->queryInt('year');
        $month = $request->queryInt('month');
        $selectedYear = $year !== null && $year >= 2000 && $year <= 2200 ? $year : (int)$now->format('Y');
        $selectedMonth = $month !== null && $month >= 1 && $month <= 12 ? $month : (int)$now->format('n');
        $periodStart = new DateTimeImmutable(sprintf('%04d-%02d-01 00:00:00', $selectedYear, $selectedMonth), new DateTimeZone('UTC'));
        $periodEnd = $periodStart->modify('+1 month');

        $activeShift = self::readActiveShift($identity['userId']);

        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                COALESCE((
                    SELECT SUM(
                        ws.work_seconds +
                        CASE
                            WHEN ws.status = 'Working' AND ws.current_segment_started_at IS NOT NULL
                            THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ws.current_segment_started_at))::bigint)
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

        $seconds = (int)$row['monthly_work_seconds'];

        $monthlyHours = round(
            $seconds / 3600,
            2
        );

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
        ]);
    }

    public static function start(array $identity): HttpResponse
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            INSERT INTO work_shifts (user_id, status, started_at, current_segment_started_at)
            SELECT :user_id_insert, 'Working', NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM work_shifts
                WHERE user_id = :user_id_existing AND status IN ('Working', 'Paused')
            )
            RETURNING id
            SQL);

        try {
            $statement->execute([
                'user_id_insert' => $identity['userId'],
                'user_id_existing' => $identity['userId'],
            ]);
            $shiftId = $statement->fetchColumn();

            if ($shiftId === false) {
                return HttpResponse::json(['message' => 'Смена уже начата'], 400);
            }

            return HttpResponse::json(['success' => true, 'shiftId' => (int)$shiftId]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23505') {
                return HttpResponse::json(['message' => 'Смена уже начата'], 400);
            }

            throw $exception;
        }
    }

    public static function pause(array $identity): HttpResponse
    {
        return self::executeAction(<<<'SQL'
            UPDATE work_shifts
            SET
                work_seconds = work_seconds + GREATEST(
                    0, EXTRACT(EPOCH FROM (NOW() - current_segment_started_at))::bigint
                ),
                status = 'Paused',
                current_segment_started_at = NULL,
                current_pause_started_at = NOW(),
                pauses_count = pauses_count + 1
            WHERE user_id = :user_id
              AND status = 'Working'
              AND current_segment_started_at IS NOT NULL
            RETURNING id
            SQL, $identity['userId'], 'Активная смена не найдена');
    }

    public static function resume(array $identity): HttpResponse
    {
        return self::executeAction(<<<'SQL'
            UPDATE work_shifts
            SET
                pause_seconds = pause_seconds + GREATEST(
                    0, EXTRACT(EPOCH FROM (NOW() - current_pause_started_at))::bigint
                ),
                status = 'Working',
                current_pause_started_at = NULL,
                current_segment_started_at = NOW()
            WHERE user_id = :user_id
              AND status = 'Paused'
              AND current_pause_started_at IS NOT NULL
            RETURNING id
            SQL, $identity['userId'], 'Смена не находится на паузе');
    }

    public static function finish(array $identity): HttpResponse
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            UPDATE work_shifts
            SET
                work_seconds = work_seconds + CASE
                    WHEN status = 'Working' AND current_segment_started_at IS NOT NULL
                    THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - current_segment_started_at))::bigint)
                    ELSE 0
                END,
                pause_seconds = pause_seconds + CASE
                    WHEN status = 'Paused' AND current_pause_started_at IS NOT NULL
                    THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - current_pause_started_at))::bigint)
                    ELSE 0
                END,
                status = 'Completed',
                finished_at = NOW(),
                current_segment_started_at = NULL,
                current_pause_started_at = NULL
            WHERE user_id = :user_id AND status IN ('Working', 'Paused')
            RETURNING id, work_seconds, pause_seconds
            SQL);
        $statement->execute(['user_id' => $identity['userId']]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return HttpResponse::json(['message' => 'Активная смена не найдена'], 400);
        }

        return HttpResponse::json([
            'success' => true,
            'shiftId' => (int)$row['id'],
            'workSeconds' => (int)$row['work_seconds'],
            'pauseSeconds' => (int)$row['pause_seconds'],
        ]);
    }

    private static function executeAction(string $sql, int $userId, string $errorMessage): HttpResponse
    {
        $statement = Database::connection()->prepare($sql);
        $statement->execute(['user_id' => $userId]);

        return $statement->fetchColumn() === false
            ? HttpResponse::json(['message' => $errorMessage], 400)
            : HttpResponse::json(['success' => true]);
    }

    private static function readActiveShift(int $userId): ?array
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                id, status, started_at, work_seconds, pause_seconds,
                current_segment_started_at, current_pause_started_at, pauses_count
            FROM work_shifts
            WHERE user_id = :user_id AND status IN ('Working', 'Paused')
            ORDER BY id DESC
            LIMIT 1
            SQL);
        $statement->execute(['user_id' => $userId]);
        $row = $statement->fetch();

        return is_array($row) ? Mapper::activeShift($row) : null;
    }
}
