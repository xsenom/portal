<?php

declare(strict_types=1);

use Portal\AspNetPasswordHasher;

require_once dirname(__DIR__) . '/src/bootstrap.php';

$password = 'Тестовый пароль 123';
$hash = AspNetPasswordHasher::hash($password);

$knownAspNetHash = 'AQAAAAEAACcQAAAAEPOWUjkBBjnBkT/oFFjsx0EdDCjFhGopC7jS4lWP2FSYdMxbkneSGyQ/OvRHUIegxg==';

$checks = [
    'generated hash verifies' => AspNetPasswordHasher::verify($hash, $password),
    'wrong password rejected' => !AspNetPasswordHasher::verify($hash, 'wrong'),
    'marker is Identity V3' => ord((string)base64_decode($hash, true)[0]) === 1,
    'known ASP.NET Identity V3 hash verifies' => AspNetPasswordHasher::verify($knownAspNetHash, 'heygaldin!'),
];

$failed = false;
foreach ($checks as $name => $result) {
    echo ($result ? 'OK' : 'FAIL') . ': ' . $name . PHP_EOL;
    $failed = $failed || !$result;
}

if ($failed) {
    throw new RuntimeException('Password compatibility self-test failed');
}
