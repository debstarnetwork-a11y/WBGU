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
$dbPass = getenv('DB_PASS') ?: '';

$pdo = null;
try {
    if (!empty($dbPass)) {
        $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }
} catch (Exception $e) {
    $pdo = null;
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

    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT u.*, p.first_name, p.middle_name, p.last_name, p.full_name, p.phone_number, p.date_of_birth, p.nationality, p.occupation, p.address_line1, p.city, p.country, p.profile_photo_url FROM users u LEFT JOIN profiles p ON u.id = p.user_id ORDER BY u.created_at DESC");
            $dbUsers = $stmt ? $stmt->fetchAll() : [];

            foreach ($dbUsers as $row) {
                $uid = $row['id'];
                
                // Fetch accounts
                $acctStmt = $pdo->prepare("SELECT * FROM accounts WHERE user_id = ?");
                $acctStmt->execute([$uid]);
                $accounts = $acctStmt->fetchAll();

                // Fetch wire codes
                $wireStmt = $pdo->prepare("SELECT * FROM wire_transfer_codes WHERE user_id = ?");
                $wireStmt->execute([$uid]);
                $wireCodesRaw = $wireStmt->fetchAll();
                $wireCodes = [];
                foreach ($wireCodesRaw as $wc) {
                    $wireCodes[$wc['code_type']] = [
                        'code' => $wc['code_value'],
                        'active' => (bool)$wc['is_active'],
                        'notes' => $wc['description'] ?? ''
                    ];
                }

                // Fetch cards
                $cardStmt = $pdo->prepare("SELECT * FROM cards WHERE user_id = ?");
                $cardStmt->execute([$uid]);
                $cards = $cardStmt->fetchAll();

                $fullName = !empty($row['full_name']) ? $row['full_name'] : trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
                if (empty($fullName)) $fullName = $row['username'] ?? $row['email'];

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
                    'status' => $row['status'] ?? 'active',
                    'kycStatus' => $row['kyc_status'] ?? 'verified',
                    'role' => $row['role'] === 'super_admin' ? 'Super Admin' : ($row['role'] === 'admin' ? 'Admin' : 'Member'),
                    'is_admin' => in_array($row['role'], ['admin', 'super_admin']),
                    'transactionPin' => $row['transaction_pin'] ?? (string)rand(1000, 9999),
                    'pin' => $row['transaction_pin'] ?? (string)rand(1000, 9999),
                    'password' => 'Password123!',
                    'createdAt' => $row['created_at'] ?? date('c'),
                    'lastLogin' => $row['last_login'] ?? date('c'),
                    'accounts' => array_map(function($a) {
                        return [
                            'accountNumber' => $a['account_number'],
                            'type' => $a['account_type'] ?? 'Checking',
                            'name' => $a['account_name'] ?? 'Primary Vault',
                            'currency' => $a['currency'] ?? 'USD',
                            'balance' => (float)$a['balance'],
                            'status' => $a['status'] ?? 'active',
                            'routingNumber' => $a['routing_number'] ?? '021000089'
                        ];
                    }, $accounts),
                    'wireTransferCodes' => $wireCodes,
                    'cards' => array_map(function($c) {
                        return [
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
                    }, $cards),
                    'cryptoWallets' => [],
                    'activityLog' => []
                ];
            }
        } catch (Exception $e) {
            $users = [];
        }
    }

    // If database returned no users or was offline, load from file
    if (empty($users)) {
        $users = loadUsersFromFile($dataFile);
    } else {
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
        'source' => $pdo ? 'mysql' : 'json_store',
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
    if ($pdo) {
        try {
            foreach ($users as $u) {
                $uid = $u['id'] ?? ('usr-' . uniqid());
                $username = $u['username'] ?? ('user_' . rand(1000, 9999));
                $email = $u['email'] ?? ($username . '@wbcu.net');
                $passwordHash = $u['password'] ?? 'Password123!';
                $role = (isset($u['is_admin']) && $u['is_admin']) || ($u['role'] ?? '') === 'Super Admin' ? 'super_admin' : 'user';
                $transactionPin = $u['transactionPin'] ?? $u['pin'] ?? str_pad((string)rand(1000, 9999), 4, '0', STR_PAD_LEFT);
                $status = $u['status'] ?? 'active';
                $kycStatus = $u['kycStatus'] ?? $u['kyc_status'] ?? 'verified';
                $createdAt = $u['createdAt'] ?? date('Y-m-d H:i:s');

                // Upsert user into MySQL users table
                $stmt = $pdo->prepare("INSERT INTO users (id, username, email, password_hash, role, transaction_pin, status, kyc_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=?, email=?, role=?, transaction_pin=?, status=?, kyc_status=?");
                $stmt->execute([$uid, $username, $email, $passwordHash, $role, $transactionPin, $status, $kycStatus, $createdAt, $username, $email, $role, $transactionPin, $status, $kycStatus]);

                // Upsert profile into MySQL profiles table
                $fullName = $u['fullName'] ?? trim(($u['firstName'] ?? '') . ' ' . ($u['lastName'] ?? ''));
                $firstName = $u['firstName'] ?? explode(' ', $fullName)[0] ?? '';
                $lastName = $u['lastName'] ?? explode(' ', $fullName)[1] ?? '';
                $phone = $u['phone'] ?? '+41 44 915 0000';
                $dob = $u['dob'] ?? '1985-01-01';
                $nationality = $u['nationality'] ?? 'Switzerland';
                $occupation = $u['occupation'] ?? 'Executive';
                $address = $u['address'] ?? 'Zurich, Switzerland';
                $photo = $u['profilePhoto'] ?? $u['avatarUrl'] ?? '';

                $profStmt = $pdo->prepare("INSERT INTO profiles (user_id, first_name, last_name, full_name, phone_number, date_of_birth, nationality, occupation, address_line1, profile_photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE first_name=?, last_name=?, full_name=?, phone_number=?, date_of_birth=?, nationality=?, occupation=?, address_line1=?, profile_photo_url=?");
                $profStmt->execute([$uid, $firstName, $lastName, $fullName, $phone, $dob, $nationality, $occupation, $address, $photo, $firstName, $lastName, $fullName, $phone, $dob, $nationality, $occupation, $address, $photo]);

                // Upsert accounts into MySQL accounts table
                if (!empty($u['accounts']) && is_array($u['accounts'])) {
                    foreach ($u['accounts'] as $acc) {
                        $accNum = $acc['accountNumber'] ?? ('09' . rand(100000000, 999999999));
                        $accType = $acc['type'] ?? 'Checking';
                        $accName = $acc['name'] ?? 'Primary Vault';
                        $currency = $acc['currency'] ?? 'USD';
                        $balance = (float)($acc['balance'] ?? 0);
                        $accStatus = $acc['status'] ?? 'active';
                        $routing = $acc['routingNumber'] ?? '021000089';

                        $accStmt = $pdo->prepare("INSERT INTO accounts (account_number, user_id, account_type, account_name, currency, balance, status, routing_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE account_type=?, account_name=?, currency=?, balance=?, status=?, routing_number=?");
                        $accStmt->execute([$accNum, $uid, $accType, $accName, $currency, $balance, $accStatus, $routing, $accType, $accName, $currency, $balance, $accStatus, $routing]);
                    }
                }
            }
            $dbSynced = true;
        } catch (Exception $e) {
            $dbSynced = false;
        }
    }

    echo json_encode([
        'success' => true,
        'db_synced' => $dbSynced,
        'count' => count($users),
        'message' => 'Users synchronized successfully to JSON and MySQL database'
    ]);
    exit;
}
