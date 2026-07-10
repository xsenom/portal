<?php

declare(strict_types=1);

use Portal\Bootstrap;

require_once dirname(__DIR__) . '/src/bootstrap.php';

try {
    Bootstrap::run();
    fwrite(STDOUT, "PHP backend database bootstrap: OK\n");
} catch (Throwable $exception) {
    fwrite(STDERR, "PHP backend database bootstrap failed: " . $exception->getMessage() . "\n");
    throw $exception;
}
