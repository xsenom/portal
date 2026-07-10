<?php

declare(strict_types=1);

namespace Portal\Controllers;

use Portal\Database;
use Portal\HttpResponse;
use Portal\Mapper;
use Portal\Request;
use Portal\Values;

final class IndicatorController
{
    public static function current(Request $request, array $identity): HttpResponse
    {
        [$year, $month] = self::resolvePeriod($request->queryInt('year'), $request->queryInt('month'));
        return self::read($identity['userId'], $year, $month);
    }

    public static function admin(int $id, Request $request): HttpResponse
    {
        [$year, $month] = self::resolvePeriod($request->queryInt('year'), $request->queryInt('month'));
        return self::read($id, $year, $month);
    }

    public static function recalculate(int $id, Request $request): HttpResponse
    {
        $body = $request->json();
        $year = Values::int($body, 'year');
        $month = Values::int($body, 'month');

        if ($month < 1 || $month > 12 || $year < 2000 || $year > 2200) {
            return HttpResponse::json(['message' => 'Период указан неверно'], 400);
        }

        // Как и в .NET-версии, автоматический пересчёт отключён.
        return self::read($id, $year, $month);
    }

    private static function read(int $userId, int $year, int $month): HttpResponse
    {
        $statement = Database::connection()->prepare(<<<'SQL'
            SELECT
                user_id, year, month, hours_worked, hours_norm,
                fines_count, fines_limit, fines_amount, base_hourly_rate,
                tariff_rate, tariff_rate_with_coefficient, total_hourly_rate,
                multifunctional, accident_free, has_fines, driver_downtime,
                responsibility, late, initiative, execution,
                completed_count, total_count, updated_at
            FROM monthly_indicators
            WHERE user_id = :user_id AND year = :year AND month = :month
            LIMIT 1
            SQL);
        $statement->execute([
            'user_id' => $userId,
            'year' => $year,
            'month' => $month,
        ]);
        $row = $statement->fetch();

        return is_array($row)
            ? HttpResponse::json(Mapper::indicator($row))
            : HttpResponse::json(['message' => 'Показатели не найдены'], 404);
    }

    private static function resolvePeriod(?int $year, ?int $month): array
    {
        $nowYear = (int)gmdate('Y');
        $nowMonth = (int)gmdate('n');

        return [
            $year !== null && $year >= 2000 && $year <= 2200 ? $year : $nowYear,
            $month !== null && $month >= 1 && $month <= 12 ? $month : $nowMonth,
        ];
    }
}
