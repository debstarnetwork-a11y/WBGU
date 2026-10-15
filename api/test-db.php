<?php
/**
 * ============================================================================
 * WB CREDIT UNION - DATABASE CONNECTION DIAGNOSTIC TOOL
 * ============================================================================
 */

header('Content-Type: application/json; charset=utf-8');

// --- 0. PHP ENVIRONMENT DIAGNOSTICS ---
$envInfo = [
    'php_version' => PHP_VERSION,
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time'),
    'post_max_size' => ini_get('post_max_size'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'pdo_mysql' => extension_loaded('pdo_mysql') ? 'INSTALLED' : 'MISSING'
];

// --- 1. CONFIGURATION ---
$dbHost = 'localhost';
$dbName = 'glolbka_wbcu_db';
$dbUser = 'glolbka_wbcu_user'; 
$dbPass = ''; 

// Simple .env parser (matches admin-users.php logic)
$envPath = dirname(__DIR__) . '/.env';
$envFound = file_exists($envPath);
if ($envFound) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) < 2) continue;
        $name = trim($parts[0]);
        $value = trim($parts[1], " \t\n\r\0\x0B\"'");
        if ($name === 'DB_PASS' || $name === 'DB_PASSWORD') $dbPass = $value;
        if ($name === 'DB_USER') $dbUser = $value;
        if ($name === 'DB_NAME') $dbName = $value;
        if ($name === 'DB_HOST') $dbHost = $value;
    }
}

$diag = [
    'env_diagnostics' => $envInfo,
    'db_config' => [
        'env_file_found' => $envFound,
        'host' => $dbHost,
        'database' => $dbName,
        'user' => $dbUser,
        'password_set' => !empty($dbPass)
    ]
];

try {
    $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5
    ]);
    $diag['connection_test'] = "SUCCESS: Connected to database.";

    // Schema Check
    $schema = [];
    $tables = ['admins', 'users', 'profiles', 'accounts', 'wire_transfer_codes', 'cards'];
    foreach ($tables as $table) {
        try {
            $q = $pdo->query("SELECT COUNT(*) FROM `$table` LIMIT 1");
            $count = $q->fetchColumn();
            $schema[$table] = "EXISTS (Rows: $count)";
            
            if ($table === 'profiles') {
                $q2 = $pdo->query("DESCRIBE `profiles`");
                $cols = $q2->fetchAll(PDO::FETCH_COLUMN);
                $schema['profiles_columns'] = $cols;
                $schema['photo_urls_status'] = (in_array('profile_photo_url', $cols) && in_array('passport_photo_url', $cols)) ? 'FOUND' : 'MISSING';
            }
        } catch (Exception $e) {
            $schema[$table] = "MISSING OR ERROR: " . $e->getMessage();
        }
    }
    $diag['schema_check'] = $schema;
    $diag['conclusion'] = "Database is ONLINE and CONNECTED.";

} catch (Throwable $e) {
    $diag['connection_test'] = "FAILED: " . $e->getMessage();
    $diag['conclusion'] = "CONNECTION ERROR. Verify your cPanel MySQL details.";
}

echo json_encode($diag, JSON_PRETTY_PRINT);
