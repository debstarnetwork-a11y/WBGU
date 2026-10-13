<?php
/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN USERS BACKEND API (cPanel / PHP / MySQL / JSON)
 * ============================================================================
 * 
 * Supports both cPanel MySQL database ('glolbka_wbcu_db') and fallback
 * file storage ('admin-users.json') to ensure users in the database
 * are always reflected in the Admin Portal and vice-versa.
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

$dataFile = dirname(__DIR__) . '/admin-users.json';
if (!file_exists($dataFile)) {
    $dataFile = __DIR__ . '/admin-users.json';
}

// Database Credentials (from cPanel schema)
$dbHost = 'localhost';
$dbName = 'glolbka_wbcu_db';
$dbUser = 'glolbka_wbcu_user';
// Support both DB_PASS and DB_PASSWORD from environment
$dbPass = getenv('DB_PASS') ?: getenv('DB_PASSWORD') ?: ''; 

$pdo = null;
$dbError = null;
try {
    // Attempt connection
    $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (Throwable $e) {
    $pdo = null;
    $dbError = $e->getMessage();
}

function loadUsersFromFile($dataFile) {
    if (file_exists($dataFile)) {
        $raw = file_get_contents($dataFile);
        $data = json_decode($raw, true);
        if (is_array($data)) {
            return $data;
        }
    }
    return [];
}

function saveUsersToFile($dataFile, $users) {
    return file_put_contents($dataFile, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// ----------------------------------------------------------------------------
// GET: Fetch all users from MySQL or fallback JSON file
// ----------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $users = [];
    $source = 'json_store';

    if ($pdo) {
        try {
            // Adaptive Column Detection for profile columns
            $q = $pdo->query("DESCRIBE profiles");
            $profileColumns = $q->fetchAll(PDO::FETCH_COLUMN);
            
            $profileFields = ['first_name', 'middle_name', 'last_name', 'full_name', 'phone_number', 'date_of_birth', 'nationality', 'occupation', 'address_line1', 'city', 'country'];
            $selectFields = ["u.*"];
            
            foreach ($profileFields as $f) {
                if (in_array($f, $profileColumns)) {
                    $selectFields[] = "p.$f";
                }
            }
            
            if (in_array('profile_photo_url', $profileColumns)) {
                $selectFields[] = "p.profile_photo_url";
            }
            if (in_array('passport_photo_url', $profileColumns)) {
                $selectFields[] = "p.passport_photo_url";
            }

            $sql = "SELECT " . implode(', ', $selectFields) . " FROM users u LEFT JOIN profiles p ON u.id = p.user_id ORDER BY u.created_at DESC";
            $stmt = $pdo->query($sql);
            $dbUsers = $stmt ? $stmt->fetchAll() : [];

            if (!empty($dbUsers)) {
                $source = 'mysql';
                
                // BULK FETCHING to avoid N+1 problem (performance)
                // Fetch all accounts
                $allAccounts = [];
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

                // Fetch all wire codes
                $allWireCodes = [];
                $wireStmt = $pdo->query("SELECT * FROM wire_transfer_codes");
                while ($wc = $wireStmt->fetch()) {
                    $allWireCodes[$wc['user_id']][$wc['code_type']] = [
                        'code' => $wc['code_value'],
                        'active' => (bool)$wc['is_active'],
                        'notes' => $wc['description'] ?? ''
                    ];
                }

                // Fetch all cards
                $allCards = [];
                $cardStmt = $pdo->query("SELECT * FROM cards");
                while ($c = $cardStmt->fetch()) {
                    $allCards[$c['user_id']][] = [
                        'id' => $c['id'],
                        'cardNumber' => $c['card_number'] ?? '•••• •••• •••• 1234',
                        'cardMasked' => $c['card_masked'] ?? '•••• •••• •••• 1234',
                        'cardHolder' => $c['card_holder'] ?? '',
                        'type' => $c['card_type'] ?? 'Visa Platinum Debit',
                        'expiry' => $c['expiry_display'] ?? '09/31',
                        'cvv' => $c['cvv'] ?? '775',
                        'pin' => $c['pin'] ?? '1234',
                        'status' => $c['status'] ?? 'active'
                    ];
                }

                foreach ($dbUsers as $row) {
                    $uid = $row['id'];
                    $fullName = !empty($row['full_name']) ? $row['full_name'] : trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
                    if (empty($fullName)) $fullName = $row['username'] ?? $row['email'] ?? 'Member';

                    $users[] = [
                        'id' => $row['id'],
                        'fullName' => $fullName,
                        'firstName' => $row['first_name'] ?? '',
                        'middleName' => $row['middle_name'] ?? '',
                        'lastName' => $row['last_name'] ?? '',
                        'username' => $row['username'] ?? '',
                        'email' => $row['email'],
                        'phone' => $row['phone_number'] ?? '',
                        'dob' => $row['date_of_birth'] ?? '',
                        'address' => $row['address_line1'] ?? '',
                        'nationality' => $row['nationality'] ?? 'Switzerland',
                        'occupation' => $row['occupation'] ?? '',
                        'profilePhoto' => $row['profile_photo_url'] ?? '',
                        'avatarUrl' => $row['profile_photo_url'] ?? '',
                        'passportPhoto' => $row['passport_photo_url'] ?? $row['profile_photo_url'] ?? '',
                        'passportUrl' => $row['passport_photo_url'] ?? $row['profile_photo_url'] ?? '',
                        'kycDocument' => $row['profile_photo_url'] ?? '',
                        'status' => $row['status'] ?? 'active',
                        'kycStatus' => $row['kyc_status'] ?? 'verified',
                        'role' => ($row['role'] === 'super_admin' || $row['role'] === 'Super Admin') ? 'Super Admin' : (($row['role'] === 'admin' || $row['role'] === 'Admin') ? 'Admin' : 'Member'),
                        'is_admin' => in_array(strtolower($row['role'] ?? ''), ['admin', 'super_admin', 'super_admin']),
                        'transactionPin' => $row['transaction_pin'] ?? (string)rand(1000, 9999),
                        'pin' => $row['transaction_pin'] ?? (string)rand(1000, 9999),
                        'password' => $row['password'] ?? 'Password123!',
                        'createdAt' => $row['created_at'] ?? date('c'),
                        'lastLogin' => $row['last_login'] ?? date('c'),
                        'accounts' => $allAccounts[$uid] ?? [],
                        'wireTransferCodes' => $allWireCodes[$uid] ?? [],
                        'cards' => $allCards[$uid] ?? [],
                        'cryptoWallets' => [],
                        'activityLog' => []
                    ];
                }
            }
        } catch (Throwable $e) {
            $dbError = $e->getMessage();
        }
    }

    // If database returned no users or was offline, load from file
    if (empty($users)) {
        $users = loadUsersFromFile($dataFile);
        $source = 'json_store';
    } else {
        // Ensure we always have at least one Super Admin from the file if DB is somehow missing it
        $hasAdminInList = false;
        foreach ($users as $u) {
            if (!empty($u['is_admin']) || in_array($u['role'] ?? '', ['Super Admin', 'Admin'])) {
                $hasAdminInList = true;
                break;
            }
        }
        if (!$hasAdminInList) {
            $fileUsers = loadUsersFromFile($dataFile);
            foreach ($fileUsers as $fu) {
                if (!empty($fu['is_admin']) || ($fu['role'] ?? '') === 'Super Admin') {
                    $users[] = $fu;
                }
            }
        }
    }

    echo json_encode([
        'success' => true,
        'source' => $source,
        'db_error' => $dbError,
        'count' => count($users),
        'users' => $users
    ]);
    exit;
}

// ----------------------------------------------------------------------------
// POST: Create or sync users into MySQL Database AND JSON file
// ----------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $users = $input['users'] ?? null;

    if (!is_array($users)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Expected users array']);
        exit;
    }

    saveUsersToFile($dataFile, $users);

    $dbSynced = false;
    $syncErrors = [];
    if ($pdo) {
        try {
            foreach ($users as $u) {
                $uid = $u['id'] ?? ('usr-' . uniqid());
                $username = $u['username'] ?? (!empty($u['email']) ? explode('@', $u['email'])[0] : ('user_' . rand(1000, 9999)));
                $email = $u['email'] ?? ($username . '@wbcu.net');
                $passwordRaw = $u['password'] ?? 'Password123!';
                $roleRaw = (isset($u['is_admin']) && $u['is_admin']) || ($u['role'] ?? '') === 'Super Admin' ? 'super_admin' : 'user';
                $transactionPin = $u['transactionPin'] ?? $u['pin'] ?? str_pad((string)rand(1000, 9999), 4, '0', STR_PAD_LEFT);
                $status = $u['status'] ?? 'active';
                $kycStatus = $u['kycStatus'] ?? $u['kyc_status'] ?? 'verified';
                $createdAt = $u['createdAt'] ?? date('Y-m-d H:i:s');

                // Adaptive Column Detection for users table
                static $userColumns = null;
                if ($userColumns === null) {
                    $q = $pdo->query("DESCRIBE users");
                    $userColumns = $q->fetchAll(PDO::FETCH_COLUMN);
                }

                $userFields = ['id', 'username', 'email', 'role', 'transaction_pin', 'status', 'kyc_status', 'created_at'];
                $userValues = [$uid, $username, $email, $roleRaw, $transactionPin, $status, $kycStatus, $createdAt];
                
                if (in_array('password', $userColumns)) {
                    $userFields[] = 'password';
                    $userValues[] = $passwordRaw;
                }
                if (in_array('password_hash', $userColumns)) {
                    $userFields[] = 'password_hash';
                    $userValues[] = $passwordRaw; // In production, this should be password_hash()
                }

                $placeholders = str_repeat('?,', count($userFields) - 1) . '?';
                $updatePart = [];
                foreach ($userFields as $f) {
                    if ($f !== 'id' && $f !== 'created_at') {
                        $updatePart[] = "`$f` = VALUES(`$f`)";
                    }
                }
                
                $sql = "INSERT INTO users (" . implode(', ', $userFields) . ") VALUES ($placeholders) ON DUPLICATE KEY UPDATE " . implode(', ', $updatePart);
                $stmt = $pdo->prepare($sql);
                $stmt->execute($userValues);

                // 2. Upsert into profiles table
                $fullName = $u['fullName'] ?? trim(($u['firstName'] ?? '') . ' ' . ($u['lastName'] ?? ''));
                if (empty($fullName)) $fullName = 'Member';
                $firstName = $u['firstName'] ?? explode(' ', $fullName)[0] ?? '';
                $lastName = $u['lastName'] ?? (count(explode(' ', $fullName)) > 1 ? end(explode(' ', $fullName)) : '');
                $phone = $u['phone'] ?? '+41 44 915 0000';
                $dob = $u['dob'] ?? '1985-01-01';
                $nationality = $u['nationality'] ?? 'Switzerland';
                $occupation = $u['occupation'] ?? 'Executive';
                $address = $u['address'] ?? 'Zurich, Switzerland';
                $photo = $u['profilePhoto'] ?? $u['avatarUrl'] ?? '';
                $passport = $u['passportPhoto'] ?? $u['passportUrl'] ?? $photo;
                $profId = 'prof-' . str_replace('usr-', '', $uid);

                // Adaptive Column Detection for profiles table
                static $profileColumns = null;
                if ($profileColumns === null) {
                    $q = $pdo->query("DESCRIBE profiles");
                    $profileColumns = $q->fetchAll(PDO::FETCH_COLUMN);
                }

                $profFields = ['id', 'user_id', 'first_name', 'last_name', 'full_name', 'phone_number', 'date_of_birth', 'nationality', 'occupation', 'address_line1'];
                $profValues = [$profId, $uid, $firstName, $lastName, $fullName, $phone, $dob, $nationality, $occupation, $address];

                if (in_array('profile_photo_url', $profileColumns)) {
                    $profFields[] = 'profile_photo_url';
                    $profValues[] = $photo;
                }
                if (in_array('passport_photo_url', $profileColumns)) {
                    $profFields[] = 'passport_photo_url';
                    $profValues[] = $passport;
                }

                $pPlaceholders = str_repeat('?,', count($profFields) - 1) . '?';
                $pUpdatePart = [];
                foreach ($profFields as $f) {
                    if ($f !== 'id' && $f !== 'user_id' && $f !== 'created_at') {
                        $pUpdatePart[] = "`$f` = VALUES(`$f`)";
                    }
                }

                $pSql = "INSERT INTO profiles (" . implode(', ', $profFields) . ") VALUES ($pPlaceholders) ON DUPLICATE KEY UPDATE " . implode(', ', $pUpdatePart);
                $pStmt = $pdo->prepare($pSql);
                $pStmt->execute($profValues);

                // 3. Upsert into accounts table
                if (!empty($u['accounts']) && is_array($u['accounts'])) {
                    foreach ($u['accounts'] as $index => $acc) {
                        $accNum = $acc['accountNumber'] ?? ('09' . rand(100000000, 999999999));
                        $accId = 'acct-' . str_replace('usr-', '', $uid) . '-' . $index;
                        $accType = $acc['type'] ?? 'Checking';
                        $accName = $acc['name'] ?? 'Primary Vault';
                        $currency = $acc['currency'] ?? 'USD';
                        $balance = (float)($acc['balance'] ?? 0);
                        $accStatus = $acc['status'] ?? 'active';
                        $routing = $acc['routingNumber'] ?? '021000089';

                        $accStmt = $pdo->prepare("INSERT INTO accounts (id, account_number, user_id, account_type, account_name, currency, balance, status, routing_number) 
                                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                                   ON DUPLICATE KEY UPDATE account_type=?, account_name=?, currency=?, balance=?, status=?, routing_number=?");
                        $accStmt->execute([
                            $accId, $accNum, $uid, $accType, $accName, $currency, $balance, $accStatus, $routing,
                            $accType, $accName, $currency, $balance, $accStatus, $routing
                        ]);
                    }
                }

                // 4. Sync wire codes
                if (!empty($u['wireTransferCodes']) && is_array($u['wireTransferCodes'])) {
                    foreach ($u['wireTransferCodes'] as $type => $cdata) {
                        if (is_array($cdata)) {
                            $codeVal = $cdata['code'] ?? '';
                            if (!$codeVal) continue;
                            $isActive = !empty($cdata['active']) ? 1 : 0;
                            $notes = $cdata['notes'] ?? '';
                            $wId = 'wc-' . str_replace('usr-', '', $uid) . '-' . strtolower($type);

                            $wStmt = $pdo->prepare("INSERT INTO wire_transfer_codes (id, user_id, code_type, code_value, display_name, description, is_active) 
                                                     VALUES (?, ?, ?, ?, ?, ?, ?) 
                                                     ON DUPLICATE KEY UPDATE code_value=?, is_active=?, description=?");
                            $wStmt->execute([
                                $wId, $uid, $type, $codeVal, $type . ' Code', $notes, $isActive,
                                $codeVal, $isActive, $notes
                            ]);
                        }
                    }
                }
                
                // 5. Sync cards
                if (!empty($u['cards']) && is_array($u['cards'])) {
                    foreach ($u['cards'] as $index => $c) {
                        $cId = $c['id'] ?? ('crd-' . str_replace('usr-', '', $uid) . '-' . $index);
                        $cNum = $c['cardNumber'] ?? '';
                        $cMasked = $c['cardMasked'] ?? '•••• •••• •••• 1234';
                        $cHolder = $c['cardHolder'] ?? $fullName;
                        $cType = $c['type'] ?? 'Visa Platinum Debit';
                        $cExpiry = $c['expiry'] ?? '09/31';
                        $cCvv = $c['cvv'] ?? '775';
                        $cPin = $c['pin'] ?? '1234';
                        $cStatus = $c['status'] ?? 'active';

                        $cStmt = $pdo->prepare("INSERT INTO cards (id, user_id, card_holder, card_number, card_masked, card_type, expiry_display, cvv, pin, status) 
                                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                                 ON DUPLICATE KEY UPDATE card_holder=?, card_type=?, expiry_display=?, cvv=?, pin=?, status=?");
                        $cStmt->execute([
                            $cId, $uid, $cHolder, $cNum, $cMasked, $cType, $cExpiry, $cCvv, $cPin, $cStatus,
                            $cHolder, $cType, $cExpiry, $cCvv, $cPin, $cStatus
                        ]);
                    }
                }
            }
            $dbSynced = true;
        } catch (Throwable $e) {
            $dbSynced = false;
            $syncErrors[] = $e->getMessage();
        }
    }

    echo json_encode([
        'success' => true,
        'db_synced' => $dbSynced,
        'db_errors' => $syncErrors,
        'db_connected' => ($pdo !== null),
        'db_conn_error' => $dbError,
        'count' => count($users),
        'message' => 'Users synchronized successfully'
    ]);
    exit;
}
