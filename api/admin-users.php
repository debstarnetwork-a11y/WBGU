<?php
/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN USERS BACKEND API (cPanel / PHP / MySQL / JSON)
 * ============================================================================
 */

set_time_limit(600); // 10 minutes for large batch syncs
ini_set('memory_limit', '512M');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = dirname(__DIR__) . '/admin-users.json';
if (!file_exists($dataFile)) {
    $dataFile = __DIR__ . '/admin-users.json';
}

// --- DATABASE CONFIGURATION ---
$dbHost = 'localhost';
$dbName = 'glolbka_wbcu_db';
$dbUser = 'glolbka_wbcu_user'; 
$dbPass = ''; 

// Comprehensive .env parser for cPanel deployment
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

if (empty($dbPass)) $dbPass = getenv('DB_PASSWORD') ?: getenv('DB_PASS') ?: '';
if (empty($dbUser) || $dbUser === 'root') {
    $envUser = getenv('DB_USER');
    if (!empty($envUser)) $dbUser = $envUser;
}
if (!empty(getenv('DB_NAME'))) $dbName = getenv('DB_NAME');
if (!empty(getenv('DB_HOST'))) $dbHost = getenv('DB_HOST');

$pdo = null;
$dbError = null;
try {
    if (!empty($dbPass) || $dbUser === 'root' || $dbHost === 'localhost') {
        $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 10 
        ]);
    } else {
        $dbError = "Database password is not set in .env";
    }
} catch (Throwable $e) {
    $pdo = null;
    $dbError = $e->getMessage();
}

function loadUsersFromFile($dataFile) {
    if (file_exists($dataFile)) {
        $raw = file_get_contents($dataFile);
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
    return [];
}

function saveUsersToFile($dataFile, $users) {
    return file_put_contents($dataFile, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// ----------------------------------------------------------------------------
// GET: Fetch all members/users (Live MySQL Database Authoritative)
// ----------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $usersMap = [];
    $source = 'json_store';

    // 1. Load from Live MySQL Database (Primary Source)
    if ($pdo) {
        try {
            // Check users and profiles columns dynamically
            $userColumns = [];
            try {
                $uq = $pdo->query("DESCRIBE `users`");
                if ($uq) $userColumns = $uq->fetchAll(PDO::FETCH_COLUMN);
            } catch (Throwable $e) {}

            $profileColumns = [];
            try {
                $q = $pdo->query("DESCRIBE `profiles`");
                if ($q) $profileColumns = $q->fetchAll(PDO::FETCH_COLUMN);
            } catch (Throwable $e) {}

            $profileFields = ['first_name', 'middle_name', 'last_name', 'full_name', 'phone_number', 'date_of_birth', 'gender', 'nationality', 'occupation', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'profile_photo_url', 'passport_photo_url', 'avatar_color', 'id_type', 'id_number', 'id_card_front_url', 'id_card_back_url', 'proof_of_address_url'];
            $selectFields = ["u.*"];
            foreach ($profileFields as $f) {
                if (in_array($f, $profileColumns)) $selectFields[] = "p.`$f`";
            }

            $orderBy = in_array('created_at', $userColumns) ? "ORDER BY u.created_at DESC" : (in_array('id', $userColumns) ? "ORDER BY u.id ASC" : "");
            $sql = "SELECT " . implode(', ', $selectFields) . " FROM `users` u LEFT JOIN `profiles` p ON u.id = p.user_id $orderBy";
            $stmt = $pdo->query($sql);
            $dbUsers = $stmt ? $stmt->fetchAll() : [];

            if (!empty($dbUsers)) {
                $source = 'mysql_live';
                // Reset usersMap so only live MySQL members appear in admin
                $usersMap = [];
                // Fetch related data in bulk
                $allAccounts = [];
                try {
                    $acctStmt = $pdo->query("SELECT * FROM accounts");
                    while ($a = $acctStmt->fetch()) {
                        $allAccounts[$a['user_id']][] = [
                            'accountNumber' => $a['account_number'],
                            'type' => $a['account_type'] ?? 'Checking',
                            'name' => $a['account_name'] ?? 'Primary Vault',
                            'currency' => $a['currency'] ?? 'USD',
                            'balance' => (float)$a['balance'],
                            'status' => $a['status'] ?? 'active',
                            'routingNumber' => $a['routing_number'] ?? '021000089'
                        ];
                    }
                } catch (Throwable $e) {}

                $allWireCodes = [];
                try {
                    $wireStmt = $pdo->query("SELECT * FROM wire_transfer_codes");
                    while ($wc = $wireStmt->fetch()) {
                        $allWireCodes[$wc['user_id']][$wc['code_type']] = [
                            'code' => $wc['code_value'],
                            'active' => (bool)$wc['is_active'],
                            'notes' => $wc['description'] ?? ''
                        ];
                    }
                } catch (Throwable $e) {}

                $allCards = [];
                try {
                    $cardStmt = $pdo->query("SELECT * FROM cards");
                    while ($c = $cardStmt->fetch()) {
                        $allCards[$c['user_id']][] = [
                            'id' => $c['id'],
                            'cardNumber' => $c['card_number'] ?? '',
                            'cardMasked' => $c['card_masked'] ?? '•••• •••• •••• 1234',
                            'cardHolder' => $c['card_holder'] ?? '',
                            'type' => $c['card_type'] ?? 'Visa Platinum Debit',
                            'expiry' => $c['expiry_display'] ?? '09/31',
                            'cvv' => $c['cvv'] ?? '775',
                            'pin' => $c['pin'] ?? '1234',
                            'status' => $c['status'] ?? 'active'
                        ];
                    }
                } catch (Throwable $e) {}

                foreach ($dbUsers as $row) {
                    $uid = $row['id'];
                    $fullName = !empty($row['full_name']) ? $row['full_name'] : trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
                    if (empty($fullName)) $fullName = $row['username'] ?? $row['email'] ?? 'Member';

                    $userAccts = $allAccounts[$uid] ?? [
                        [
                            'accountNumber' => 'WB-' . substr(preg_replace('/[^0-9]/', '', $uid) . '94821049', 0, 10),
                            'type' => 'Checking',
                            'name' => 'Primary Checking Account',
                            'currency' => 'USD',
                            'balance' => 0.00,
                            'status' => $row['status'] ?? 'active',
                            'routingNumber' => '021000089',
                            'isPrimary' => true
                        ]
                    ];

                    $userObj = [
                        'id' => $row['id'],
                        'fullName' => $fullName,
                        'firstName' => $row['first_name'] ?? '',
                        'lastName' => $row['last_name'] ?? '',
                        'username' => $row['username'] ?? '',
                        'email' => $row['email'],
                        'phone' => $row['phone_number'] ?? '',
                        'dob' => $row['date_of_birth'] ?? '',
                        'address' => $row['address_line1'] ?? '',
                        'nationality' => $row['nationality'] ?? 'Switzerland',
                        'profilePhoto' => $row['profile_photo_url'] ?? '',
                        'passportPhoto' => $row['passport_photo_url'] ?? '',
                        'passportUrl' => $row['passport_photo_url'] ?? '',
                        'status' => $row['status'] ?? 'active',
                        'kycStatus' => $row['kyc_status'] ?? 'verified',
                        'role' => (stripos($row['role'] ?? '', 'super') !== false) ? 'Super Admin' : ((stripos($row['role'] ?? '', 'admin') !== false) ? 'Admin' : 'Member'),
                        'is_admin' => (!empty($row['is_admin']) || stripos($row['role'] ?? '', 'admin') !== false || stripos($row['role'] ?? '', 'super') !== false || stripos($row['role'] ?? '', 'officer') !== false),
                        'transactionPin' => $row['transaction_pin'] ?? '',
                        'createdAt' => $row['created_at'] ?? date('c'),
                        'accounts' => $userAccts,
                        'wireTransferCodes' => $allWireCodes[$uid] ?? [],
                        'cards' => $allCards[$uid] ?? []
                    ];
                    
                    $usersMap[$uid] = $userObj;
                }
            }

            // Also load any dedicated officers from `admins` table (runs independently of users table)
            try {
                $admStmt = $pdo->query("SELECT * FROM `admins`");
                if ($admStmt) {
                    while ($admRow = $admStmt->fetch()) {
                        $aid = $admRow['id'] ?? 'adm-001';
                        if (!isset($usersMap[$aid])) {
                            $admFn = $admRow['full_name'] ?? $admRow['name'] ?? $admRow['username'] ?? 'Chief Treasury Auditor';
                            $parts = explode(' ', trim($admFn));
                            $usersMap[$aid] = [
                                'id' => $aid,
                                'fullName' => $admFn,
                                'firstName' => $parts[0] ?? 'Chief',
                                'lastName' => $parts[count($parts) - 1] ?? 'Auditor',
                                'username' => $admRow['username'] ?? 'admin',
                                'email' => $admRow['email'] ?? 'admin@wbcu.net',
                                'phone' => $admRow['phone'] ?? '+41 44 915 8901',
                                'dob' => '06/14/1984',
                                'address' => '109, Feldgüetliweg, Meilen, Zurich 8706, Switzerland',
                                'nationality' => 'Switzerland',
                                'profilePhoto' => '',
                                'passportPhoto' => '',
                                'passportUrl' => '',
                                'status' => $admRow['status'] ?? 'active',
                                'kycStatus' => 'verified',
                                'role' => ($admRow['role'] === 'admin') ? 'Admin' : 'Super Admin',
                                'is_admin' => true,
                                'transactionPin' => '8869',
                                'createdAt' => $admRow['created_at'] ?? date('c'),
                                'accounts' => $allAccounts[$aid] ?? [
                                    [
                                        'accountNumber' => 'WB-9482-1049-55',
                                        'type' => 'Checking',
                                        'name' => 'Premier Treasury Vault',
                                        'currency' => 'USD',
                                        'balance' => 248500.00,
                                        'status' => 'active',
                                        'routingNumber' => '021000089',
                                        'isPrimary' => true
                                    ]
                                ],
                                'wireTransferCodes' => $allWireCodes[$aid] ?? [],
                                'cards' => $allCards[$aid] ?? []
                            ];
                        }
                    }
                }
            } catch (Throwable $e) {}

            if (!empty($usersMap)) {
                $source = 'mysql_live';
            }
        } catch (Throwable $e) {
            $dbError = $e->getMessage();
        }
    }

    // 2. Fall back to JSON File backup only if no live database users were loaded
    if (empty($usersMap)) {
        $fileUsers = loadUsersFromFile($dataFile);
        foreach ($fileUsers as $u) {
            if (!empty($u['id'])) $usersMap[$u['id']] = $u;
        }
    }

    $finalUsers = array_values($usersMap);
    echo json_encode([
        'success' => true,
        'source' => $source,
        'db_connected' => ($pdo !== null),
        'db_error' => $dbError,
        'count' => count($finalUsers),
        'users' => $finalUsers
    ]);
    exit;
}

// ----------------------------------------------------------------------------
// POST: Sync users into MySQL AND JSON file
// ----------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    $users = $input['users'] ?? null;

    if (!is_array($users)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Expected users array']);
        exit;
    }

    $isChunk = !empty($input['is_chunk']);
    if (!$isChunk) {
        saveUsersToFile($dataFile, $users);
    }

    $syncErrors = [];
    $processedCount = 0;

    if ($pdo) {
        $uCols = [];
        $pCols = [];
        try {
            $uCols = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_COLUMN);
            $pCols = $pdo->query("DESCRIBE profiles")->fetchAll(PDO::FETCH_COLUMN);
        } catch (Throwable $e) {
            $syncErrors[] = "Describe error: " . $e->getMessage();
        }

        foreach ($users as $u) {
            try {
                $uid = $u['id'] ?? ('usr-' . uniqid());
                $email = $u['email'] ?? ($uid . '@wbcu.net');
                $username = $u['username'] ?? explode('@', $email)[0];
                
                // Roles
                $roleRaw = strtolower($u['role'] ?? '');
                $safeRole = 'user';
                if (!empty($u['is_admin']) || strpos($roleRaw, 'super') !== false) {
                    $safeRole = 'super_admin';
                } else if (strpos($roleRaw, 'admin') !== false) {
                    $safeRole = 'admin';
                } else if (strpos($roleRaw, 'audit') !== false) {
                    $safeRole = 'auditor';
                }

                // If role is admin or super_admin, sync to admins table if table exists
                if ($safeRole === 'admin' || $safeRole === 'super_admin') {
                    try {
                        $adminStmt = $pdo->prepare("INSERT INTO admins (id, username, email, password_hash, full_name, role, status)
                                                    VALUES (?, ?, ?, ?, ?, ?, 'active')
                                                    ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), role=VALUES(role)");
                        $adminStmt->execute([
                            'adm-' . str_replace('usr-', '', $uid),
                            $username,
                            $email,
                            $u['password'] ?? 'Admin123!',
                            $u['fullName'] ?? 'Admin Officer',
                            $safeRole
                        ]);
                    } catch (Throwable $eAdm) {
                        // admins table optional
                    }
                }

                $statusRaw = strtolower($u['status'] ?? 'active');
                $allowedStatus = ['active', 'inactive', 'suspended', 'frozen', 'pending_approval'];
                if ($statusRaw === 'pending' || $statusRaw === 'pending_credit') {
                    $safeStatus = 'pending_approval';
                } else if ($statusRaw === 'dormant') {
                    $safeStatus = 'inactive';
                } else if (in_array($statusRaw, $allowedStatus)) {
                    $safeStatus = $statusRaw;
                } else {
                    $safeStatus = 'active';
                }

                $kycRaw = strtolower($u['kycStatus'] ?? $u['kyc_status'] ?? 'verified');
                $allowedKyc = ['unverified', 'pending', 'verified', 'rejected'];
                $safeKyc = in_array($kycRaw, $allowedKyc) ? $kycRaw : 'verified';

                // 1. Users Table
                $uFields = ['id', 'username', 'email', 'role', 'transaction_pin', 'status', 'kyc_status', 'created_at'];
                $uVals = [$uid, $username, $email, $safeRole, $u['transactionPin'] ?? '1234', $safeStatus, $safeKyc, !empty($u['createdAt']) ? date('Y-m-d H:i:s', strtotime($u['createdAt'])) : date('Y-m-d H:i:s')];
                
                if (in_array('password_hash', $uCols)) { $uFields[] = 'password_hash'; $uVals[] = !empty($u['password']) ? $u['password'] : '12345'; }
                if (in_array('password', $uCols)) { $uFields[] = 'password'; $uVals[] = !empty($u['password']) ? $u['password'] : '12345'; }
                if (in_array('is_admin', $uCols)) { $uFields[] = 'is_admin'; $uVals[] = ($safeRole === 'super_admin' || $safeRole === 'admin') ? 1 : 0; }
                if (in_array('two_factor_enabled', $uCols)) { $uFields[] = 'two_factor_enabled'; $uVals[] = 1; }
                
                $placeholders = str_repeat('?,', count($uFields) - 1) . '?';
                $updates = [];
                foreach ($uFields as $f) if ($f !== 'id' && $f !== 'created_at') $updates[] = "`$f` = VALUES(`$f`)";
                
                $stmt = $pdo->prepare("INSERT INTO users (" . implode(', ', $uFields) . ") VALUES ($placeholders) ON DUPLICATE KEY UPDATE " . implode(', ', $updates));
                $stmt->execute($uVals);

                // 2. Profiles Table
                $fullName = $u['fullName'] ?? 'Member';
                $firstName = $u['firstName'] ?? explode(' ', $fullName)[0];
                $lastName = $u['lastName'] ?? '';
                $middleName = $u['middleName'] ?? '';
                
                $rawDob = $u['dob'] ?? $u['date_of_birth'] ?? '1988-05-18';
                $formattedDob = '1988-05-18';
                $tsDob = strtotime($rawDob);
                if ($tsDob !== false) {
                    $formattedDob = date('Y-m-d', $tsDob);
                }

                $profFields = ['id', 'user_id', 'first_name', 'last_name', 'full_name', 'phone_number', 'date_of_birth', 'nationality', 'occupation', 'address_line1'];
                $profVals = ['prof-'.str_replace('usr-','',$uid), $uid, $firstName, $lastName, $fullName, $u['phone'] ?? '+41 44 915 8901', $formattedDob, $u['nationality'] ?? 'Switzerland', $u['occupation'] ?? 'Executive Private Client', $u['address'] ?? 'Zurich, Switzerland'];
                
                if (in_array('middle_name', $pCols)) { $profFields[] = 'middle_name'; $profVals[] = $middleName; }
                if (in_array('city', $pCols)) { $profFields[] = 'city'; $profVals[] = 'Zurich'; }
                if (in_array('country', $pCols)) { $profFields[] = 'country'; $profVals[] = $u['nationality'] ?? 'Switzerland'; }
                if (in_array('profile_photo_url', $pCols)) { $profFields[] = 'profile_photo_url'; $profVals[] = $u['profilePhoto'] ?? ''; }
                if (in_array('passport_photo_url', $pCols)) { $profFields[] = 'passport_photo_url'; $profVals[] = $u['passportPhoto'] ?? $u['passportUrl'] ?? ''; }
                
                $pPlaceholders = str_repeat('?,', count($profFields) - 1) . '?';
                $pUpdates = [];
                foreach ($profFields as $f) if ($f !== 'id' && $f !== 'user_id') $pUpdates[] = "`$f` = VALUES(`$f`)";
                
                $pStmt = $pdo->prepare("INSERT INTO profiles (" . implode(', ', $profFields) . ") VALUES ($pPlaceholders) ON DUPLICATE KEY UPDATE " . implode(', ', $pUpdates));
                $pStmt->execute($profVals);

                // 3. Accounts Table
                $allowedAcctTypes = ['Checking', 'Savings', 'Business', 'Offshore', 'Fixed Deposit', 'Money Market'];
                $allowedAcctStatus = ['active', 'inactive', 'frozen', 'closed', 'dormant'];

                if (!empty($u['accounts']) && is_array($u['accounts'])) {
                    foreach ($u['accounts'] as $idx => $acc) {
                        $accId = 'acct-' . str_replace('usr-', '', $uid) . '-' . $idx;
                        $rawType = trim($acc['type'] ?? 'Checking');
                        $safeType = 'Checking';
                        foreach ($allowedAcctTypes as $at) {
                            if (strcasecmp($at, $rawType) === 0) { $safeType = $at; break; }
                        }
                        
                        $rawStatus = strtolower($acc['status'] ?? 'active');
                        $safeStatus = in_array($rawStatus, $allowedAcctStatus) ? $rawStatus : 'active';
                        $balance = (float)($acc['balance'] ?? 0);

                        $pdo->prepare("INSERT INTO accounts (id, account_number, user_id, account_type, account_name, currency, balance, available_balance, status, routing_number, swift_bic) 
                                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WBCUUS33') 
                                       ON DUPLICATE KEY UPDATE account_type=VALUES(account_type), account_name=VALUES(account_name), balance=VALUES(balance), available_balance=VALUES(available_balance), status=VALUES(status)")
                            ->execute([$accId, $acc['accountNumber'] ?? '09'.rand(100000,999999), $uid, $safeType, $acc['name'] ?? 'Primary Vault', $acc['currency'] ?? 'USD', $balance, $balance, $safeStatus, $acc['routingNumber'] ?? '251480576']);
                    }
                }

                // 4. Wire Codes Table
                $allowedWireTypes = ['COT', 'TAX', 'IMF', 'AML', 'PAP', 'OTP'];
                if (!empty($u['wireTransferCodes']) && is_array($u['wireTransferCodes'])) {
                    foreach ($u['wireTransferCodes'] as $type => $c) {
                        $codeTypeUpper = strtoupper($type);
                        if (in_array($codeTypeUpper, $allowedWireTypes) && is_array($c) && !empty($c['code'])) {
                            $wcId = 'wc-' . str_replace('usr-', '', $uid) . '-' . strtolower($codeTypeUpper);
                            $pdo->prepare("INSERT INTO wire_transfer_codes (id, user_id, code_type, code_value, display_name, description, is_active) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?) 
                                           ON DUPLICATE KEY UPDATE code_value=VALUES(code_value), is_active=VALUES(is_active)")
                                ->execute([$wcId, $uid, $codeTypeUpper, $c['code'], $codeTypeUpper . ' Clearance Code', $c['notes'] ?? '', !empty($c['active']) ? 1 : 0]);
                        }
                    }
                }

                // 5. Cards Table
                if (!empty($u['cards']) && is_array($u['cards'])) {
                    foreach ($u['cards'] as $idx => $card) {
                        $cId = 'crd-' . str_replace('usr-', '', $uid) . '-' . $idx;
                        $pdo->prepare("INSERT INTO cards (id, user_id, card_holder, card_number, card_masked, card_type, expiry_display, cvv, pin, status) 
                                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                       ON DUPLICATE KEY UPDATE card_holder=VALUES(card_holder), card_type=VALUES(card_type), status=VALUES(status)")
                            ->execute([$cId, $uid, $card['cardHolder'] ?? $fullName, $card['cardNumber'] ?? '', $card['cardMasked'] ?? '•••• 1234', $card['type'] ?? 'Debit', $card['expiry'] ?? '09/31', $card['cvv'] ?? '775', $card['pin'] ?? '1234', $card['status'] ?? 'active']);
                    }
                }
                $processedCount++;
            } catch (Throwable $eUser) {
                $syncErrors[] = "Error syncing user {$uid}: " . $eUser->getMessage();
            }
        }
    }

    echo json_encode([
        'success' => true,
        'db_synced' => ($pdo !== null && $processedCount > 0),
        'db_errors' => $syncErrors,
        'db_connected' => ($pdo !== null),
        'count' => count($users),
        'processed' => $processedCount,
        'message' => ($processedCount > 0) ? "Successfully synchronized {$processedCount} members to MySQL Database" : "Saved to JSON file"
    ]);
    exit;
}
