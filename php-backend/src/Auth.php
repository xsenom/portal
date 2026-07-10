<?php

declare(strict_types=1);

namespace Portal;

final class Auth
{
    private const COOKIE_NAME = 'portal.auth';
    private const LIFETIME = 2592000;

    private static bool $loaded = false;
    private static ?array $identity = null;
    private static ?string $token = null;

    public static function current(): ?array
    {
        if (self::$loaded) {
            return self::$identity;
        }

        self::$loaded = true;
        self::cleanupOccasionally();

        $token = self::readCookie(self::COOKIE_NAME);
        if ($token === null || preg_match('/^[a-f0-9]{64}$/', $token) !== 1) {
            return null;
        }

        $path = self::sessionPath($token);
        if (!is_file($path)) {
            return null;
        }

        $raw = file_get_contents($path);
        $data = is_string($raw) ? json_decode($raw, true) : null;

        if (!is_array($data) || (int)($data['expiresAt'] ?? 0) < time()) {
            @unlink($path);
            self::clearCookie();
            return null;
        }

        self::$token = $token;
        self::$identity = [
            'userId' => (int)$data['userId'],
            'login' => (string)$data['login'],
            'role' => (string)$data['role'],
        ];

        $data['expiresAt'] = time() + self::LIFETIME;
        self::writeSession($token, $data);
        self::setCookie($token, (int)$data['expiresAt']);

        return self::$identity;
    }

    public static function login(int $userId, string $login, string $role): void
    {
        $oldToken = self::readCookie(self::COOKIE_NAME);
        if ($oldToken !== null && preg_match('/^[a-f0-9]{64}$/', $oldToken) === 1) {
            @unlink(self::sessionPath($oldToken));
        }

        $token = bin2hex(random_bytes(32));
        $expiresAt = time() + self::LIFETIME;

        self::writeSession($token, [
            'userId' => $userId,
            'login' => $login,
            'role' => $role,
            'createdAt' => time(),
            'expiresAt' => $expiresAt,
        ]);

        self::$loaded = true;
        self::$token = $token;
        self::$identity = [
            'userId' => $userId,
            'login' => $login,
            'role' => $role,
        ];

        self::setCookie($token, $expiresAt);
    }

    public static function logout(): void
    {
        $token = self::$token ?? self::readCookie(self::COOKIE_NAME);

        if ($token !== null && preg_match('/^[a-f0-9]{64}$/', $token) === 1) {
            @unlink(self::sessionPath($token));
        }

        self::$loaded = true;
        self::$identity = null;
        self::$token = null;
        self::clearCookie();
    }

    private static function sessionDirectory(): string
    {
        $directory = dirname(__DIR__) . '/storage/sessions';
        if (!is_dir($directory)) {
            mkdir($directory, 0700, true);
        }

        return $directory;
    }

    private static function sessionPath(string $token): string
    {
        return self::sessionDirectory() . '/' . hash('sha256', $token) . '.json';
    }

    private static function writeSession(string $token, array $data): void
    {
        $path = self::sessionPath($token);
        $temporary = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
        file_put_contents(
            $temporary,
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            LOCK_EX,
        );
        chmod($temporary, 0600);
        rename($temporary, $path);
    }

    private static function setCookie(string $token, int $expiresAt): void
    {
        setcookie(self::COOKIE_NAME, $token, [
            'expires' => $expiresAt,
            'path' => '/',
            'secure' => self::cookieSecure(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private static function clearCookie(): void
    {
        setcookie(self::COOKIE_NAME, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => self::cookieSecure(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private static function cookieSecure(): bool
    {
        $configured = getenv('COOKIE_SECURE');
        if ($configured !== false && $configured !== '') {
            return !in_array(strtolower($configured), ['0', 'false', 'no', 'off'], true);
        }

        $forwarded = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
        return $forwarded === 'https' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    }

    private static function readCookie(string $name): ?string
    {
        $header = (string)($_SERVER['HTTP_COOKIE'] ?? '');
        foreach (explode(';', $header) as $part) {
            $parts = explode('=', trim($part), 2);
            if (count($parts) === 2 && urldecode($parts[0]) === $name) {
                return urldecode($parts[1]);
            }
        }

        return null;
    }

    private static function cleanupOccasionally(): void
    {
        if (random_int(1, 100) !== 1) {
            return;
        }

        foreach (glob(self::sessionDirectory() . '/*.json') ?: [] as $path) {
            $raw = @file_get_contents($path);
            $data = is_string($raw) ? json_decode($raw, true) : null;
            if (!is_array($data) || (int)($data['expiresAt'] ?? 0) < time()) {
                @unlink($path);
            }
        }
    }
}
