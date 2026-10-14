<?php
/**
 * ============================================================================
 * WB CREDIT UNION - GITHUB AUTO-DEPLOYMENT WEBHOOK
 * ============================================================================
 * 
 * Instructions:
 * 1. Upload this file to your public_html folder (e.g. public_html/deploy.php)
 * 2. Go to your GitHub Repository -> Settings -> Webhooks
 * 3. Add a new webhook:
 *    - Payload URL: https://www.wbcu.net/deploy.php
 *    - Content type: application/json
 *    - Trigger: Just the push event.
 * 4. Ensure your cPanel user has SSH access to the GitHub repo (already should be if you cloned it).
 * ============================================================================
 */

// Secret for security (Optional: add a check for X-Hub-Signature)
// $secret = 'your_secret_here';

header('Content-Type: application/json');

// 1. Path to your repository on the server
$repoPath = '/home/glolbka/repositories/WBCU';

// 2. Change to the repository directory
if (!is_dir($repoPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Repository directory not found.']);
    exit;
}

chdir($repoPath);

// 3. Perform the git pull
// Note: We use 2>&1 to capture error output
$output = [];
$returnCode = 0;
exec("git pull origin main 2>&1", $output, $returnCode);

if ($returnCode === 0) {
    // 4. Trigger cPanel Deployment (if .cpanel.yml exists)
    // This part is often automatic on some cPanel versions when git pull happens, 
    // but if not, we can try to trigger it via the cPanel API if needed.
    
    echo json_encode([
        'success' => true,
        'message' => 'Successfully pulled changes from GitHub.',
        'output' => $output
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to pull changes.',
        'output' => $output
    ]);
}
