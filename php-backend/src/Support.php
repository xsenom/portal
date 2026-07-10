<?php

declare(strict_types=1);

namespace Portal;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use JsonException;
use Throwable;

final class HttpResponse
{
    public function __construct(
        public readonly int $status,
        public readonly mixed $body = null,
        public readonly array $headers = [],
    ) {
    }

    public static function json(mixed $body, int $status = 200, array $headers = []): self
    {
        return new self($status, $body, $headers);
    }

    public static function empty(int $status = 204, array $headers = []): self
    {
        return new self($status, null, $headers);
    }

    public function emit(): void
    {
        http_response_code($this->status);

        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }

        if ($this->body === null) {
            header_remove('Content-Type');
            header('Content-Length: 0');
            return;
        }

        header('Content-Type: application/json; charset=utf-8');

        try {
            echo json_encode(
                $this->body,
                JSON_UNESCAPED_UNICODE
                | JSON_UNESCAPED_SLASHES
                | JSON_PRESERVE_ZERO_FRACTION
                | JSON_THROW_ON_ERROR
            );
        } catch (JsonException $exception) {
            error_log('JSON serialization failed: ' . $exception->getMessage());
            http_response_code(500);
            echo '{"message":"Внутренняя ошибка сервера"}';
        }
    }
}

final class Request
{
    private ?array $json = null;

    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
    ) {
    }

    public static function fromGlobals(): self
    {
        $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $uri = (string)($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($uri, PHP_URL_PATH);

        return new self(
            $method,
            is_string($path) && $path !== '' ? $path : '/',
            $_GET,
        );
    }

    public function json(): array
    {
        if ($this->json !== null) {
            return $this->json;
        }

        $raw = file_get_contents('php://input');

        if ($raw === false || trim($raw) === '') {
            return $this->json = [];
        }

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new BadRequestException('Некорректный JSON');
        }

        if (!is_array($decoded)) {
            throw new BadRequestException('Некорректный JSON');
        }

        return $this->json = $decoded;
    }

    public function queryString(string $key): ?string
    {
        $value = $this->query[$key] ?? null;
        return is_scalar($value) ? trim((string)$value) : null;
    }

    public function queryInt(string $key): ?int
    {
        $value = $this->queryString($key);
        if ($value === null || $value === '' || filter_var($value, FILTER_VALIDATE_INT) === false) {
            return null;
        }

        return (int)$value;
    }
}

class BadRequestException extends \RuntimeException
{
}

final class Router
{
    /** @var list<array{method:string,regex:string,handler:callable,auth:bool,admin:bool}> */
    private array $routes = [];

    public function add(
        string $method,
        string $pattern,
        callable $handler,
        bool $auth = false,
        bool $admin = false,
    ): void {
        $quoted = preg_quote($pattern, '#');
        $regex = preg_replace(
            '#\\\\\{([a-zA-Z_][a-zA-Z0-9_]*)\\\\\}#',
            '(?P<$1>[0-9]+)',
            $quoted,
        );

        if (!is_string($regex)) {
            throw new \RuntimeException('Route compilation failed');
        }

        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '$#',
            'handler' => $handler,
            'auth' => $auth,
            'admin' => $admin,
        ];
    }

    public function dispatch(Request $request): HttpResponse
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method) {
                continue;
            }

            if (preg_match($route['regex'], $request->path, $matches) !== 1) {
                continue;
            }

            $params = [];
            foreach ($matches as $key => $value) {
                if (is_string($key)) {
                    $params[$key] = (int)$value;
                }
            }

            $identity = null;
            if ($route['auth']) {
                $identity = Auth::current();
                if ($identity === null) {
                    return HttpResponse::empty(401);
                }
            }

            if ($route['admin'] && ($identity['role'] ?? null) !== 'Admin') {
                return HttpResponse::empty(403);
            }

            $response = ($route['handler'])($request, $params, $identity);

            if (!$response instanceof HttpResponse) {
                throw new \RuntimeException('Route handler must return HttpResponse');
            }

            return $response;
        }

        return HttpResponse::json(['message' => 'Маршрут не найден'], 404);
    }
}

final class Values
{
    public static function get(array $data, string $camel, ?string $pascal = null, mixed $default = null): mixed
    {
        if (array_key_exists($camel, $data)) {
            return $data[$camel];
        }

        $pascal ??= ucfirst($camel);
        return array_key_exists($pascal, $data) ? $data[$pascal] : $default;
    }

    public static function string(array $data, string $key, string $default = ''): string
    {
        $value = self::get($data, $key, null, $default);
        return is_scalar($value) ? trim((string)$value) : $default;
    }

    public static function nullableString(array $data, string $key): ?string
    {
        $value = self::get($data, $key);
        if ($value === null || !is_scalar($value)) {
            return null;
        }

        return trim((string)$value);
    }

    public static function int(array $data, string $key, int $default = 0): int
    {
        $value = self::get($data, $key, null, $default);
        return is_numeric($value) ? (int)$value : $default;
    }

    public static function float(array $data, string $key, float $default = 0.0): float
    {
        $value = self::get($data, $key, null, $default);
        return is_numeric($value) ? (float)$value : $default;
    }

    public static function nullableFloat(array $data, string $key): ?float
    {
        $value = self::get($data, $key);
        return $value === null || $value === '' || !is_numeric($value) ? null : (float)$value;
    }

    public static function bool(array $data, string $key, bool $default = false): bool
    {
        $value = self::get($data, $key, null, $default);

        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return $value !== 0;
        }

        if (is_string($value)) {
            return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
        }

        return $default;
    }

    public static function length(string $value): int
    {
        return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
    }

    public static function upper(string $value): string
    {
        return function_exists('mb_strtoupper')
            ? mb_strtoupper($value, 'UTF-8')
            : strtoupper($value);
    }

    public static function dbBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower((string)$value), ['1', 't', 'true', 'yes', 'on'], true);
    }

    public static function nullableDbBool(mixed $value): ?bool
    {
        return $value === null ? null : self::dbBool($value);
    }

    public static function nullableFloatFromDb(mixed $value): ?float
    {
        return $value === null ? null : (float)$value;
    }

    public static function nullableIntFromDb(mixed $value): ?int
    {
        return $value === null ? null : (int)$value;
    }

    public static function dateTime(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            return (new DateTimeImmutable($value))->format('Y-m-d\\TH:i:s.uP');
        } catch (Throwable) {
            return $value;
        }
    }

    public static function inputDateTime(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            return (new DateTimeImmutable($value))
                ->setTimezone(new DateTimeZone('UTC'))
                ->format('Y-m-d H:i:s.uP');
        } catch (Throwable) {
            return null;
        }
    }

    public static function validDate(?string $value): bool
    {
        if ($value === null || $value === '') {
            return true;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value;
    }
}
