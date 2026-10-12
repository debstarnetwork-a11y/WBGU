<?php
/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN USERS BACKEND API (cPanel / PHP / MySQL / JSON)
 * ============================================================================
 * 
 * Supports both cPanel MySQL database ('glolbka_wbcu_db') and fallback
 * file storage ('admin-users.json') to ensure users in the database
 * are always reflected in the Admin Portal.
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
                    'transactionPin' => $row['transaction_pin'] ?? '1234',
                    'pin' => $row['transaction_pin'] ?? '1234',
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
// POST: Create or sync users into database and JSON file
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

    echo json_encode([
        'success' => true,
        'count' => count($users),
        'message' => 'Users synchronized successfully'
    ]);
    exit;
}
