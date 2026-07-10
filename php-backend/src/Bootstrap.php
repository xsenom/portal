<?php

declare(strict_types=1);

namespace Portal;

final class Bootstrap
{
    public static function run(): void
    {
        $pdo = Database::connection();
        $schema = file_get_contents(dirname(__DIR__) . '/database/schema.sql');
        if (!is_string($schema)) {
            throw new \RuntimeException('database/schema.sql not found');
        }

        $pdo->exec($schema);

        $adminLogin = trim(getenv('ADMIN_LOGIN') ?: 'csenom');
        $adminEmail = trim(getenv('ADMIN_EMAIL') ?: 'csenom@portal.local');
        $adminPassword = getenv('ADMIN_PASSWORD');

        if ($adminPassword === false || trim($adminPassword) === '') {
            throw new \RuntimeException('ADMIN_PASSWORD is not configured');
        }

        $statement = $pdo->prepare(<<<'SQL'
            INSERT INTO users
            (
                login, normalized_login, email, normalized_email,
                first_name, last_name, middle_name, password_hash,
                role, is_active
            )
            VALUES
            (
                :login, :normalized_login, :email, :normalized_email,
                'Илья', 'Лечик', 'Владимирович', :password_hash,
                'Admin', TRUE
            )
            ON CONFLICT (normalized_login)
            DO UPDATE SET
                email = EXCLUDED.email,
                normalized_email = EXCLUDED.normalized_email,
                password_hash = EXCLUDED.password_hash,
                role = 'Admin',
                is_active = TRUE,
                updated_at = NOW()
            SQL);
        $statement->execute([
            'login' => $adminLogin,
            'normalized_login' => Values::upper($adminLogin),
            'email' => $adminEmail,
            'normalized_email' => Values::upper($adminEmail),
            'password_hash' => AspNetPasswordHasher::hash($adminPassword),
        ]);
    }
}
