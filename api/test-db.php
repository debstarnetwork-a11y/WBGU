<?php
/**
 * ============================================================================
 * WB CREDIT UNION - DATABASE CONNECTION DIAGNOSTIC TOOL
 * ============================================================================
 * 
 * Usage: 
 * 1. Deploy this file to your cPanel server.
 * 2. Visit: https://www.wbcu.net/api/test-db.php in your browser.
 * 3. It will tell you exactly if the database is connected and what's wrong.
 * ============================================================================
 */

header('Content-Type: application/json; charset=utf-8');

// --- CONFIGURATION ---
$dbHost = 'localhost';
$dbName = 'glolbka_wbcu_db';
$dbUser = 'glolbka_wbcu_user'; 
$dbPass = ''; 

// Simple .env parser (matches admin-users.php logic)
$envPath = dirname(__DIR__) . '/.env';
$envFound = false;
if (file_exists($envPath)) {
    $envFound = true;
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

// --- ATTEMPT CONNECTION ---
$report = [
    'step_1_php_version' => PHP_VERSION,
    'step_2_credentials' => [
        'env_file_found' => $envFound,
        'host' => $dbHost,
        'database' => $dbName,
        'user' => $dbUser,
        'password_set' => !empty($dbPass)
    ],
    'step_3_connection_test' => null,
    'step_4_schema_check' => [],
    'conclusion' => 'Pending'
];

try {
    $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5
    ]);
    $report['step_3_connection_test'] = "SUCCESS: Connected to database.";
    
    // Check tables
    $tables = ['users', 'profiles', 'accounts', 'wire_transfer_codes', 'cards'];
    foreach ($tables as $table) {
        try {
            $q = $pdo->query("SELECT COUNT(*) FROM `$table` LIMIT 1");
            $count = $q->fetchColumn();
            $report['step_4_schema_check'][$table] = "EXISTS (Rows: $count)";
            
            if ($table === 'profiles') {
                $q2 = $pdo->query("DESCRIBE `profiles`");
                $cols = $q2->fetchAll(PDO::FETCH_COLUMN);
                $report['step_4_schema_check']['profiles_columns'] = $cols;
                
                if (in_array('passport_photo_url', $cols)) {
                    $report['step_4_schema_check']['passport_photo_url_status'] = "FOUND (Correct)";
                } else {
                    $report['step_4_schema_check']['passport_photo_url_status'] = "MISSING! You need to run the SQL to add this column to the 'profiles' table.";
                }
            }
        } catch (Exception $e) {
            $report['step_4_schema_check'][$table] = "ERROR: " . $e->getMessage();
        }
    }
    $report['conclusion'] = "Database is ONLINE and CONNECTED. If you see 'MISSING' columns above, run the SQL in phpMyAdmin.";
} catch (Exception $e) {
    $report['step_3_connection_test'] = "FAILED: " . $e->getMessage();
    $report['conclusion'] = "Database CONNECTION FAILED. Please double-check your username and password in cPanel > MySQL Databases.";
}

echo json_encode($report, JSON_PRETTY_PRINT);
