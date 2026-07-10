<?php

declare(strict_types=1);

namespace Portal;

use Portal\Controllers\AuthController;
use Portal\Controllers\IndicatorController;
use Portal\Controllers\TaskController;
use Portal\Controllers\UserController;
use Portal\Controllers\WorkTimeController;

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
        $router->add('POST', '/api/portal/auth/login', static fn(Request $request): HttpResponse => AuthController::login($request));
        $router->add('POST', '/api/portal/auth/logout', static fn(): HttpResponse => AuthController::logout());
        $router->add('GET', '/api/portal/auth/me', static fn(Request $request, array $params, array $identity): HttpResponse => AuthController::me($identity), true);

        $router->add('GET', '/api/portal/admin/users', static fn(): HttpResponse => UserController::all(), true, true);
        $router->add('GET', '/api/portal/admin/users/{id}', static fn(Request $request, array $params): HttpResponse => UserController::one($params['id']), true, true);
        $router->add('PUT', '/api/portal/admin/users/{id}', static fn(Request $request, array $params): HttpResponse => UserController::update($params['id'], $request), true, true);

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
        $router->add('POST', '/api/portal/time/start', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::start($identity), true);
        $router->add('POST', '/api/portal/time/pause', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::pause($identity), true);
        $router->add('POST', '/api/portal/time/resume', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::resume($identity), true);
        $router->add('POST', '/api/portal/time/finish', static fn(Request $request, array $params, array $identity): HttpResponse => WorkTimeController::finish($identity), true);

        return $router;
    }
}
