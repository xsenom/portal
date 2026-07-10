<?php

declare(strict_types=1);

use Portal\App;
use Portal\BadRequestException;
use Portal\HttpResponse;
use Portal\Request;

require_once dirname(__DIR__) . '/src/bootstrap.php';

$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
$allowedOrigins = ['https://test.xsenom.ru', 'http://localhost:3000'];
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
}

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'OPTIONS') {
    HttpResponse::empty(204)->emit();
    return;
}

try {
    $response = App::router()->dispatch(Request::fromGlobals());
} catch (BadRequestException $exception) {
    $response = HttpResponse::json(['message' => $exception->getMessage()], 400);
} catch (Throwable $exception) {
    error_log(sprintf(
        "Portal PHP API error: %s in %s:%d\n%s",
        $exception->getMessage(),
        $exception->getFile(),
        $exception->getLine(),
        $exception->getTraceAsString(),
    ));
    $response = HttpResponse::json(['message' => 'Внутренняя ошибка сервера'], 500);
}

$response->emit();
