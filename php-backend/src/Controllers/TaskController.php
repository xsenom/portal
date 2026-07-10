<?php

declare(strict_types=1);

namespace Portal\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Portal\Database;
use Portal\HttpResponse;
use Portal\Mapper;
use Portal\Request;
use Portal\Values;

final class TaskController
{
    private const TASK_COLUMNS = <<<'SQL'
        t.id, t.title, t.description, t.category, t.status,
        t.planned_hours, t.actual_hours, t.reward_amount,
        t.initiative_points, t.execution_points, t.responsibility_points,
        t.due_at, t.submitted_at, t.approved_at, t.rejected_at,
        t.submission_comment, t.approval_comment, t.created_at, t.updated_at
        SQL;

    private const EVENT_TYPES = ['Fine', 'Accident', 'Late', 'Downtime', 'Bonus'];

    public static function currentTasks(Request $request, array $identity): HttpResponse
    {
        $status = $request->queryString('status');
        $sql = 'SELECT ' . self::TASK_COLUMNS . ' FROM tasks t WHERE t.assigned_user_id = :user_id';
        $params = ['user_id' => $identity['userId']];

        if ($status !== null && $status !== '') {
            $sql .= ' AND t.status = :status';
            $params['status'] = $status;
        }

        $sql .= "\n" . <<<'SQL'
            ORDER BY
                CASE
                    WHEN t.status = 'Submitted' THEN 1
                    WHEN t.status = 'InProgress' THEN 2
                    WHEN t.status = 'Assigned' THEN 3
                    ELSE 4
                END,
                t.due_at NULLS LAST,
                t.created_at DESC
            SQL;

        $statement = Database::connection()->prepare($sql);
        $statement->execute($params);

        return HttpResponse::json(array_map([Mapper::class, 'task'], $statement->fetchAll()));
    }

    public static function adminTasks(Request $request): HttpResponse
    {
        $userId = $request->queryInt('userId');
        $status = $request->queryString('status');
        $year = $request->queryInt('year');
        $month = $request->queryInt('month');

        $sql = 'SELECT ' . self::TASK_COLUMNS . <<<'SQL'
            , u.id AS user_id, u.login, u.first_name, u.last_name, u.middle_name
            FROM tasks t
            JOIN users u ON u.id = t.assigned_user_id
            WHERE TRUE
            SQL;
        $params = [];

        if ($userId !== null) {
            $sql .= ' AND t.assigned_user_id = :user_id';
            $params['user_id'] = $userId;
        }
        if ($status !== null && $status !== '') {
            $sql .= ' AND t.status = :status';
            $params['status'] = $status;
        }
        if ($year !== null) {
            $sql .= ' AND EXTRACT(YEAR FROM COALESCE(t.due_at, t.created_at)) = :year';
            $params['year'] = $year;
        }
        if ($month !== null) {
            $sql .= ' AND EXTRACT(MONTH FROM COALESCE(t.due_at, t.created_at)) = :month';
            $params['month'] = $month;
        }

        $sql .= "\n" . <<<'SQL'
            ORDER BY
                CASE
                    WHEN t.status = 'Submitted' THEN 1
                    WHEN t.status = 'InProgress' THEN 2
                    WHEN t.status = 'Assigned' THEN 3
                    ELSE 4
                END,
                t.due_at NULLS LAST,
                t.created_at DESC
            SQL;

        $statement = Database::connection()->prepare($sql);
        $statement->execute($params);

        $result = [];
        foreach ($statement->fetchAll() as $row) {
            $result[] = [
                'task' => Mapper::task($row),
                'userId' => (int)$row['user_id'],
                'login' => (string)$row['login'],
                'firstName' => (string)$row['first_name'],
                'lastName' => (string)$row['last_name'],
                'middleName' => $row['middle_name'] !== null ? (string)$row['middle_name'] : null,
            ];
        }

        return HttpResponse::json($result);
    }

    public static function create(Request $request, array $identity): HttpResponse
    {
        $body = $request->json();
        $assignedUserId = Values::int($body, 'assignedUserId');
        $title = Values::string($body, 'title');
        $description = Values::nullableString($body, 'description') ?? '';
        $category = Values::nullableString($body, 'category') ?? '';
        $plannedHours = Values::nullableFloat($body, 'plannedHours');
        $rewardAmount = Values::nullableFloat($body, 'rewardAmount');
        $dueAtInput = Values::nullableString($body, 'dueAt');
        $dueAt = Values::inputDateTime($dueAtInput);

        if (Values::length($title) < 2) {
            return HttpResponse::json(['message' => 'Введите название задания'], 400);
        }

        if (($plannedHours !== null && $plannedHours < 0) || ($rewardAmount !== null && $rewardAmount < 0)) {
            return HttpResponse::json(['message' => 'Часы и сумма не могут быть отрицательными'], 400);
        }

        if ($rewardAmount === null || $rewardAmount <= 0) {
            return HttpResponse::json(['message' => 'Укажите стоимость задания больше 0'], 400);
        }

        if ($dueAtInput !== null && $dueAtInput !== '' && $dueAt === null) {
            return HttpResponse::json(['message' => 'Срок задания указан неверно'], 400);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            INSERT INTO tasks
                (assigned_user_id, created_by_user_id, title, description, category,
                 status, planned_hours, reward_amount, due_at)
            SELECT
                u.id, :admin_id, :title, NULLIF(:description, ''), NULLIF(:category, ''),
                'Assigned', :planned_hours, :reward_amount, :due_at
            FROM users u
            WHERE u.id = :assigned_user_id AND u.is_active = TRUE
            RETURNING id, created_at
            SQL);
        $statement->execute([
            'assigned_user_id' => $assignedUserId,
            'admin_id' => $identity['userId'],
            'title' => $title,
            'description' => $description,
            'category' => $category,
            'planned_hours' => $plannedHours,
            'reward_amount' => $rewardAmount,
            'due_at' => $dueAt,
        ]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return HttpResponse::json(['message' => 'Активный пользователь не найден'], 404);
        }

        return HttpResponse::json([
            'id' => (int)$row['id'],
            'createdAt' => Values::dateTime((string)$row['created_at']),
        ]);
    }

    public static function start(int $id, array $identity): HttpResponse
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            UPDATE tasks
            SET status = 'InProgress', rejected_at = NULL
            WHERE id = :id AND assigned_user_id = :user_id AND status = 'Assigned'
            RETURNING id
            SQL);
        $statement->execute(['id' => $id, 'user_id' => $identity['userId']]);

        if ($statement->fetchColumn() === false) {
            return HttpResponse::json(['message' => 'Задание уже принято или недоступно'], 400);
        }

        return HttpResponse::json(['success' => true, 'status' => 'InProgress']);
    }

    public static function decline(int $id, Request $request, array $identity): HttpResponse
    {
        $reason = Values::string($request->json(), 'reason');
        if (Values::length($reason) < 2) {
            return HttpResponse::json(['message' => 'Выберите причину отказа'], 400);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            UPDATE tasks
            SET status = 'Cancelled', submission_comment = :reason
            WHERE id = :id
              AND assigned_user_id = :user_id
              AND status IN ('Assigned', 'InProgress')
            RETURNING id
            SQL);
        $statement->execute([
            'id' => $id,
            'user_id' => $identity['userId'],
            'reason' => $reason,
        ]);

        if ($statement->fetchColumn() === false) {
            return HttpResponse::json(['message' => 'Отказ от этого задания недоступен'], 400);
        }

        return HttpResponse::json(['success' => true, 'status' => 'Cancelled']);
    }

    public static function submit(int $id, Request $request, array $identity): HttpResponse
    {
        $body = $request->json();
        $actualHours = Values::float($body, 'actualHours');
        $comment = Values::nullableString($body, 'comment') ?? '';

        if ($actualHours < 0) {
            return HttpResponse::json(['message' => 'Количество часов указано неверно'], 400);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            UPDATE tasks
            SET
                status = 'Submitted', actual_hours = :actual_hours,
                submission_comment = NULLIF(:comment, ''), submitted_at = NOW(),
                rejected_at = NULL
            WHERE id = :id
              AND assigned_user_id = :user_id
              AND status IN ('Assigned', 'InProgress', 'Rejected')
            RETURNING id
            SQL);
        $statement->execute([
            'id' => $id,
            'user_id' => $identity['userId'],
            'actual_hours' => $actualHours,
            'comment' => $comment,
        ]);

        if ($statement->fetchColumn() === false) {
            return HttpResponse::json(['message' => 'Задание нельзя отправить на проверку'], 400);
        }

        return HttpResponse::json(['success' => true, 'status' => 'Submitted']);
    }

    public static function approve(int $id, Request $request): HttpResponse
    {
        $body = $request->json();
        $initiative = Values::int($body, 'initiativePoints');
        $execution = Values::int($body, 'executionPoints');
        $responsibility = Values::int($body, 'responsibilityPoints');
        $rewardAmount = Values::float($body, 'rewardAmount');
        $comment = Values::nullableString($body, 'comment') ?? '';

        foreach ([$initiative, $execution, $responsibility] as $points) {
            if ($points < 0 || $points > 5) {
                return HttpResponse::json(['message' => 'Оценки должны быть от 0 до 5'], 400);
            }
        }

        if ($rewardAmount <= 0) {
            return HttpResponse::json(['message' => 'Укажите стоимость задания больше 0'], 400);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            UPDATE tasks
            SET
                status = 'Approved', reward_amount = :reward_amount,
                initiative_points = :initiative_points,
                execution_points = :execution_points,
                responsibility_points = :responsibility_points,
                approval_comment = NULLIF(:comment, ''),
                approved_at = NOW(), rejected_at = NULL
            WHERE id = :id AND status = 'Submitted'
            RETURNING
                assigned_user_id,
                EXTRACT(YEAR FROM approved_at)::integer AS year,
                EXTRACT(MONTH FROM approved_at)::integer AS month
            SQL);
        $statement->execute([
            'id' => $id,
            'reward_amount' => $rewardAmount,
            'initiative_points' => $initiative,
            'execution_points' => $execution,
            'responsibility_points' => $responsibility,
            'comment' => $comment,
        ]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return HttpResponse::json(['message' => 'Задание не ожидает подтверждения'], 400);
        }

        return HttpResponse::json([
            'success' => true,
            'status' => 'Approved',
            'userId' => (int)$row['assigned_user_id'],
            'year' => (int)$row['year'],
            'month' => (int)$row['month'],
        ]);
    }

    public static function reject(int $id, Request $request): HttpResponse
    {
        $comment = Values::nullableString($request->json(), 'comment') ?? '';
        $statement = Database::connection()->prepare(<<<'SQL'
            UPDATE tasks
            SET
                status = 'Rejected', approval_comment = NULLIF(:comment, ''),
                rejected_at = NOW(), approved_at = NULL
            WHERE id = :id AND status = 'Submitted'
            RETURNING id
            SQL);
        $statement->execute(['id' => $id, 'comment' => $comment]);

        if ($statement->fetchColumn() === false) {
            return HttpResponse::json(['message' => 'Задание не ожидает проверки'], 400);
        }

        return HttpResponse::json(['success' => true, 'status' => 'Rejected']);
    }

    public static function getPaySettings(int $id): HttpResponse
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT monthly_hours_norm, base_hourly_rate, tariff_rate, coefficient, updated_at
            FROM user_pay_settings
            WHERE user_id = :user_id
            SQL);
        $statement->execute(['user_id' => $id]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return HttpResponse::json([
                'userId' => $id,
                'monthlyHoursNorm' => null,
                'baseHourlyRate' => null,
                'tariffRate' => null,
                'coefficient' => 1,
            ]);
        }

        return HttpResponse::json([
            'userId' => $id,
            'monthlyHoursNorm' => Values::nullableFloatFromDb($row['monthly_hours_norm']),
            'baseHourlyRate' => Values::nullableFloatFromDb($row['base_hourly_rate']),
            'tariffRate' => Values::nullableFloatFromDb($row['tariff_rate']),
            'coefficient' => (float)$row['coefficient'],
            'updatedAt' => Values::dateTime((string)$row['updated_at']),
        ]);
    }

    public static function savePaySettings(int $id, Request $request): HttpResponse
    {
        $body = $request->json();
        $monthly = Values::nullableFloat($body, 'monthlyHoursNorm');
        $base = Values::nullableFloat($body, 'baseHourlyRate');
        $tariff = Values::nullableFloat($body, 'tariffRate');
        $coefficient = Values::float($body, 'coefficient');

        if (
            ($monthly !== null && $monthly < 0)
            || ($base !== null && $base < 0)
            || ($tariff !== null && $tariff < 0)
            || $coefficient <= 0
        ) {
            return HttpResponse::json(['message' => 'Проверьте часы, ставки и коэффициент'], 400);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            INSERT INTO user_pay_settings
                (user_id, monthly_hours_norm, base_hourly_rate, tariff_rate, coefficient)
            SELECT u.id, :monthly_hours_norm, :base_hourly_rate, :tariff_rate, :coefficient
            FROM users u
            WHERE u.id = :user_id
            ON CONFLICT (user_id)
            DO UPDATE SET
                monthly_hours_norm = EXCLUDED.monthly_hours_norm,
                base_hourly_rate = EXCLUDED.base_hourly_rate,
                tariff_rate = EXCLUDED.tariff_rate,
                coefficient = EXCLUDED.coefficient
            SQL);
        $statement->execute([
            'user_id' => $id,
            'monthly_hours_norm' => $monthly,
            'base_hourly_rate' => $base,
            'tariff_rate' => $tariff,
            'coefficient' => $coefficient,
        ]);

        if ($statement->rowCount() === 0) {
            return HttpResponse::json(['message' => 'Пользователь не найден'], 404);
        }

        return HttpResponse::json(['success' => true]);
    }

    public static function createWorkEvent(int $id, Request $request, array $identity): HttpResponse
    {
        $body = $request->json();
        $eventTypeInput = Values::string($body, 'eventType');
        $eventType = null;
        foreach (self::EVENT_TYPES as $candidate) {
            if (strcasecmp($candidate, $eventTypeInput) === 0) {
                $eventType = $candidate;
                break;
            }
        }

        if ($eventType === null) {
            return HttpResponse::json(['message' => 'Неизвестный тип события'], 400);
        }

        $title = Values::nullableString($body, 'title') ?? '';
        $description = Values::nullableString($body, 'description') ?? '';
        $amount = Values::nullableFloat($body, 'amount');
        $occurredInput = Values::nullableString($body, 'occurredAt');
        $occurredAt = $occurredInput === null || $occurredInput === ''
            ? (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.uP')
            : Values::inputDateTime($occurredInput);

        if ($occurredAt === null) {
            return HttpResponse::json(['message' => 'Дата события указана неверно'], 400);
        }

        $statement = Database::connection()->prepare(<<<'SQL'
            INSERT INTO work_events
                (user_id, created_by_user_id, event_type, title, description, amount, occurred_at)
            SELECT
                u.id, :admin_id, :event_type, NULLIF(:title, ''),
                NULLIF(:description, ''), :amount, :occurred_at
            FROM users u
            WHERE u.id = :user_id
            RETURNING id
            SQL);
        $statement->execute([
            'user_id' => $id,
            'admin_id' => $identity['userId'],
            'event_type' => $eventType,
            'title' => $title,
            'description' => $description,
            'amount' => $amount,
            'occurred_at' => $occurredAt,
        ]);
        $eventId = $statement->fetchColumn();

        if ($eventId === false) {
            return HttpResponse::json(['message' => 'Пользователь не найден'], 404);
        }

        return HttpResponse::json(['id' => (int)$eventId, 'success' => true]);
    }
}
