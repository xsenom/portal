<?php

declare(strict_types=1);

namespace Portal;

final class Mapper
{
    public static function user(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'login' => (string)$row['login'],
            'email' => (string)$row['email'],
            'firstName' => (string)$row['first_name'],
            'lastName' => (string)$row['last_name'],
            'middleName' => $row['middle_name'] !== null ? (string)$row['middle_name'] : null,
            'role' => (string)$row['role'],
            'isActive' => Values::dbBool($row['is_active']),
            'employmentDate' => $row['employment_date'] !== null ? (string)$row['employment_date'] : null,
            'position' => $row['position'] !== null ? (string)$row['position'] : null,
            'category' => $row['category'] !== null ? (string)$row['category'] : null,
            'avatarUrl' => $row['avatar_url'] !== null ? (string)$row['avatar_url'] : null,
            'createdAt' => Values::dateTime((string)$row['created_at']),
            'updatedAt' => Values::dateTime((string)$row['updated_at']),
        ];
    }

    public static function task(array $row, string $prefix = ''): array
    {
        $get = static fn(string $name): mixed => $row[$prefix . $name] ?? null;

        return [
            'id' => (int)$get('id'),
            'title' => (string)$get('title'),
            'description' => $get('description') !== null ? (string)$get('description') : null,
            'category' => $get('category') !== null ? (string)$get('category') : null,
            'status' => (string)$get('status'),
            'plannedHours' => Values::nullableFloatFromDb($get('planned_hours')),
            'actualHours' => Values::nullableFloatFromDb($get('actual_hours')),
            'rewardAmount' => Values::nullableFloatFromDb($get('reward_amount')),
            'initiativePoints' => (int)$get('initiative_points'),
            'executionPoints' => (int)$get('execution_points'),
            'responsibilityPoints' => (int)$get('responsibility_points'),
            'dueAt' => Values::dateTime($get('due_at')),
            'submittedAt' => Values::dateTime($get('submitted_at')),
            'approvedAt' => Values::dateTime($get('approved_at')),
            'rejectedAt' => Values::dateTime($get('rejected_at')),
            'submissionComment' => $get('submission_comment') !== null ? (string)$get('submission_comment') : null,
            'approvalComment' => $get('approval_comment') !== null ? (string)$get('approval_comment') : null,
            'createdAt' => Values::dateTime((string)$get('created_at')),
            'updatedAt' => Values::dateTime((string)$get('updated_at')),
        ];
    }

    public static function indicator(array $row): array
    {
        return [
            'userId' => (int)$row['user_id'],
            'year' => (int)$row['year'],
            'month' => (int)$row['month'],
            'hoursWorked' => Values::nullableFloatFromDb($row['hours_worked']),
            'hoursNorm' => Values::nullableFloatFromDb($row['hours_norm']),
            'finesCount' => Values::nullableIntFromDb($row['fines_count']),
            'finesLimit' => Values::nullableIntFromDb($row['fines_limit']),
            'finesAmount' => Values::nullableFloatFromDb($row['fines_amount']),
            'baseHourlyRate' => Values::nullableFloatFromDb($row['base_hourly_rate']),
            'tariffRate' => Values::nullableFloatFromDb($row['tariff_rate']),
            'tariffRateWithCoefficient' => Values::nullableFloatFromDb($row['tariff_rate_with_coefficient']),
            'totalHourlyRate' => Values::nullableFloatFromDb($row['total_hourly_rate']),
            'multifunctional' => Values::nullableDbBool($row['multifunctional']),
            'accidentFree' => Values::nullableDbBool($row['accident_free']),
            'hasFines' => Values::nullableDbBool($row['has_fines']),
            'driverDowntime' => Values::nullableDbBool($row['driver_downtime']),
            'responsibility' => $row['responsibility'] !== null ? (string)$row['responsibility'] : null,
            'late' => Values::nullableDbBool($row['late']),
            'initiative' => Values::nullableDbBool($row['initiative']),
            'execution' => Values::nullableDbBool($row['execution']),
            'completedCount' => Values::nullableIntFromDb($row['completed_count']),
            'totalCount' => Values::nullableIntFromDb($row['total_count']),
            'updatedAt' => Values::dateTime((string)$row['updated_at']),
        ];
    }

    public static function activeShift(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'status' => (string)$row['status'],
            'startedAt' => Values::dateTime((string)$row['started_at']),
            'workSeconds' => (int)$row['work_seconds'],
            'pauseSeconds' => (int)$row['pause_seconds'],
            'currentSegmentStartedAt' => Values::dateTime($row['current_segment_started_at']),
            'currentPauseStartedAt' => Values::dateTime($row['current_pause_started_at']),
            'pausesCount' => (int)$row['pauses_count'],
        ];
    }
}
