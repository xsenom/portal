<?php

declare(strict_types=1);

namespace Portal;

final class AspNetPasswordHasher
{
    private const IDENTITY_V2 = 0x00;
    private const IDENTITY_V3 = 0x01;

    private const PRF_HMAC_SHA1 = 0;
    private const PRF_HMAC_SHA256 = 1;
    private const PRF_HMAC_SHA512 = 2;

    private const V3_ITERATIONS = 100000;
    private const SALT_SIZE = 16;
    private const SUBKEY_SIZE = 32;

    public static function hash(string $password): string
    {
        $salt = random_bytes(self::SALT_SIZE);
        $subkey = hash_pbkdf2(
            'sha512',
            $password,
            $salt,
            self::V3_ITERATIONS,
            self::SUBKEY_SIZE,
            true,
        );

        $payload = chr(self::IDENTITY_V3)
            . pack('N', self::PRF_HMAC_SHA512)
            . pack('N', self::V3_ITERATIONS)
            . pack('N', self::SALT_SIZE)
            . $salt
            . $subkey;

        return base64_encode($payload);
    }

    public static function verify(string $hash, string $password): bool
    {
        $decoded = base64_decode($hash, true);
        if ($decoded === false || strlen($decoded) < 2) {
            return false;
        }

        return match (ord($decoded[0])) {
            self::IDENTITY_V2 => self::verifyV2($decoded, $password),
            self::IDENTITY_V3 => self::verifyV3($decoded, $password),
            default => false,
        };
    }

    private static function verifyV2(string $decoded, string $password): bool
    {
        if (strlen($decoded) !== 1 + self::SALT_SIZE + self::SUBKEY_SIZE) {
            return false;
        }

        $salt = substr($decoded, 1, self::SALT_SIZE);
        $expected = substr($decoded, 1 + self::SALT_SIZE);
        $actual = hash_pbkdf2('sha1', $password, $salt, 1000, strlen($expected), true);

        return hash_equals($expected, $actual);
    }

    private static function verifyV3(string $decoded, string $password): bool
    {
        if (strlen($decoded) < 13) {
            return false;
        }

        $prf = self::readUInt32($decoded, 1);
        $iterations = self::readUInt32($decoded, 5);
        $saltLength = self::readUInt32($decoded, 9);

        if ($iterations < 1 || $saltLength < 16 || strlen($decoded) < 13 + $saltLength + 16) {
            return false;
        }

        $algorithm = match ($prf) {
            self::PRF_HMAC_SHA1 => 'sha1',
            self::PRF_HMAC_SHA256 => 'sha256',
            self::PRF_HMAC_SHA512 => 'sha512',
            default => null,
        };

        if ($algorithm === null) {
            return false;
        }

        $salt = substr($decoded, 13, $saltLength);
        $expected = substr($decoded, 13 + $saltLength);
        $actual = hash_pbkdf2(
            $algorithm,
            $password,
            $salt,
            $iterations,
            strlen($expected),
            true,
        );

        return hash_equals($expected, $actual);
    }

    private static function readUInt32(string $value, int $offset): int
    {
        $result = unpack('Nvalue', substr($value, $offset, 4));
        return (int)($result['value'] ?? 0);
    }
}
