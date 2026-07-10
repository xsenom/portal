<?php

declare(strict_types=1);

$path = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$static = __DIR__ . (is_string($path) ? $path : '');

if (PHP_SAPI === 'cli-server' && is_file($static)) {
    return false;
}

require __DIR__ . '/index.php';
