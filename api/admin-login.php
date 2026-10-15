<?php
/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN AUTHENTICATION API (Strict Database Authentication)
 * ============================================================================
 * 
 * Authenticates Administrative Officers strictly against the live cPanel MySQL
 * database ('glolbka_wbcu_db'). Rejects all hardcoded, fallback, and unauthorized
 * credentials. Only credentials configured in the database are permitted.
 * ============================================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Read Request Input
$rawInput = file_get_contents('php://input');
$inputData = json_decode($rawInput, true) ?: [];
$email = trim($inputData['email'] ?? $_POST['email'] ?? '');
$password = trim($inputData['password'] ?? $_POST['password'] ?? '');
$accessCode = trim($inputData['accessCode'] ?? $_POST['accessCode'] ?? '') ?: 'WB-TREASURY-01';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Officer email/username and master passcode are required.'
    ]);
    exit;
}

// 2. Discover Database Credentials from Environment / .env
$dbHost = 'localhost';
$dbName = 'glolbka_wbcu_db';
$dbUser = 'glolbka_wbcu_user';
$dbPass = '';

$envPaths = [
    dirname(__DIR__) . '/.env',
    __DIR__ . '/.env',
    __DIR__ . '/../.env',
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env',
    '/home/glolbka/WBCU/.env'
];

foreach ($envPaths as $envPath) {
    if (!empty($envPath) && file_exists($envPath)) {
        $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (is_array($lines)) {
            foreach ($lines as $line) {
                $line = trim($line);
                if (strpos($line, '#') === 0) continue;
                $parts = explode('=', $line, 2);
                if (count($parts) < 2) continue;
                $key = trim($parts[0]);
                $val = trim($parts[1], " \t\n\r\0\x0B\"'");
                if (($key === 'DB_PASS' || $key === 'DB_PASSWORD') && !empty($val)) $dbPass = $val;
                if ($key === 'DB_USER' && !empty($val)) $dbUser = $val;
                if ($key === 'DB_NAME' && !empty($val)) $dbName = $val;
                if ($key === 'DB_HOST' && !empty($val)) $dbHost = $val;
            }
        }
    }
}

// System Environment variable fallbacks
if (empty($dbPass)) $dbPass = getenv('DB_PASSWORD') ?: getenv('DB_PASS') ?: '';
if (empty($dbUser) || $dbUser === 'root') {
    $envUser = getenv('DB_USER');
    if (!empty($envUser)) $dbUser = $envUser;
}
if (!empty(getenv('DB_NAME'))) $dbName = getenv('DB_NAME');
if (!empty(getenv('DB_HOST'))) $dbHost = getenv('DB_HOST');

// 3. Connect to Live MySQL Database
$pdo = null;
$dbConnectError = null;

try {
    $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5
    ]);
} catch (Throwable $e) {
    $pdo = null;
    $dbConnectError = $e->getMessage();
}

if (!$pdo) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed. Unable to authenticate against administrative database.',
        'details' => $dbConnectError
    ]);
    exit;
}

// 4. Query Officer Record from Database ONLY
$normIdentifier = strtolower($email);
$matchedRow = null;
$sourceTable = null;

// 4a. Check dedicated 'admins' table first
try {
    $stmtAdmins = $pdo->prepare("SELECT * FROM admins WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1");
    $stmtAdmins->execute([$normIdentifier, $normIdentifier]);
    $adminRow = $stmtAdmins->fetch();
    if ($adminRow) {
        $matchedRow = $adminRow;
        $sourceTable = 'admins';
    }
} catch (Throwable $e) {
    // Admins table may be absent or empty
}

// 4b. Check 'users' table if not in 'admins'
if (!$matchedRow) {
    try {
        $stmtUsers = $pdo->prepare("SELECT u.*, p.full_name, p.first_name, p.last_name 
                                    FROM users u 
                                    LEFT JOIN profiles p ON u.id = p.user_id 
                                    WHERE (LOWER(u.email) = ? OR LOWER(u.username) = ?) 
                                      AND (u.role IN ('admin', 'super_admin', 'auditor') OR u.is_admin = 1) 
                                    LIMIT 1");
        $stmtUsers->execute([$normIdentifier, $normIdentifier]);
        $userRow = $stmtUsers->fetch();
        if ($userRow) {
            $matchedRow = $userRow;
            $sourceTable = 'users';
        }
    } catch (Throwable $e) {
        // Users table query error
    }
}

// If account does NOT exist in the database, reject immediately
if (!$matchedRow) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Access Denied: Invalid administrative credentials or master passcode.'
    ]);
    exit;
}

// 5. Verify Password Against Database Record ONLY
function verifyDatabasePassword($rawPassword, $row) {
    $storedHash = $row['password_hash'] ?? $row['password'] ?? '';
    if ($storedHash === '' || $storedHash === null) {
        return false;
    }

    // A. PHP standard password_verify (bcrypt, argon2, etc.)
    if (password_verify($rawPassword, $storedHash)) {
        return true;
    }

    // B. Direct plaintext equality (if stored as plain text in phpMyAdmin)
    if ($rawPassword === $storedHash) {
        return true;
    }

    // C. Check alternate 'password' column if distinct from 'password_hash'
    if (!empty($row['password'])) {
        if ($rawPassword === $row['password'] || password_verify($rawPassword, $row['password'])) {
            return true;
        }
    }

    // D. MD5 hash equality (if MD5() SQL function was selected in phpMyAdmin)
    if (strtolower(md5($rawPassword)) === strtolower($storedHash)) {
        return true;
    }

    // E. SHA-256 hash equality (if SHA2() SQL function was used in phpMyAdmin)
    if (strtolower(hash('sha256', $rawPassword)) === strtolower($storedHash)) {
        return true;
    }

    // F. SHA-1 hash equality (if SHA1() SQL function was used in phpMyAdmin)
    if (strtolower(sha1($rawPassword)) === strtolower($storedHash)) {
        return true;
    }

    return false;
}

$isPasswordValid = verifyDatabasePassword($password, $matchedRow);

if (!$isPasswordValid) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Access Denied: Invalid administrative credentials or master passcode.'
    ]);
    exit;
}

// 6. Update last_login in the database
try {
    $updateStmt = $pdo->prepare("UPDATE `{$sourceTable}` SET last_login = NOW() WHERE id = ?");
    $updateStmt->execute([$matchedRow['id']]);
} catch (Throwable $e) {}

// 7. Officer Authenticated Successfully
$fullName = $matchedRow['full_name'] ?? trim(($matchedRow['first_name'] ?? '') . ' ' . ($matchedRow['last_name'] ?? ''));
if (empty($fullName)) {
    $fullName = $matchedRow['username'] ?? 'Chief Treasury Auditor';
}

$role = $matchedRow['role'] ?? 'super_admin';
$displayRole = 'Super Admin';
if (stripos($role, 'super') !== false) {
    $displayRole = 'Super Admin';
} elseif (stripos($role, 'auditor') !== false) {
    $displayRole = 'Treasury Auditor';
} else {
    $displayRole = 'Admin';
}

$adminPayload = [
    'id' => $matchedRow['id'],
    'email' => $matchedRow['email'] ?? $email,
    'username' => $matchedRow['username'] ?? $email,
    'fullName' => $fullName,
    'role' => $displayRole,
    'badgeNumber' => $accessCode,
    'is_admin' => true,
    'authMethod' => 'MySQL_Database_Verified',
    'sourceTable' => $sourceTable,
    'authenticatedAt' => date('c')
];

echo json_encode([
    'success' => true,
    'message' => 'Admin authentication approved against database',
    'admin' => $adminPayload
]);
exit;
