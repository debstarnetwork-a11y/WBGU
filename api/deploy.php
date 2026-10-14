<?php
/**
 * ============================================================================
 * WB CREDIT UNION - CUSTOM GITHUB DEPLOYMENT WEBHOOK
 * ============================================================================
 * 
 * If your cPanel does not show a "Webhook URL", use this script as a 
 * "Custom Webhook" in GitHub.
 * 
 * SETUP:
 * 1. PUSH this file to your server.
 * 2. In GitHub: Settings > Webhooks > Add Webhook.
 * 3. Payload URL: https://www.wbcu.net/api/deploy.php
 * 4. Content type: application/json
 * 5. Secret: (Leave blank or set one and update this script)
 * ============================================================================
 */

header('Content-Type: application/json');

// --- SECURITY: Optional Secret Verification ---
// $secret = 'your_github_webhook_secret';
// $signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
// ... (signature check logic)

try {
    // 1. Pull changes from GitHub
    $output = [];
    $retval = 0;
    exec("git pull origin main 2>&1", $output, $retval);
    
    // 2. Trigger cPanel deployment (this runs .cpanel.yml tasks)
    // Note: This requires the 'uapi' or 'cpcmd' command to be available.
    $deployOutput = [];
    $deployRetval = 0;
    exec("/usr/local/cpanel/bin/cpcmd VersionControl update_deploy repository_root=/home/glolbka/repositories/WBCU 2>&1", $deployOutput, $deployRetval);

    echo json_encode([
        'success' => true,
        'git_pull' => [
            'status' => $retval === 0 ? 'Success' : 'Failed',
            'output' => $output
        ],
        'cpanel_deploy' => [
            'status' => $deployRetval === 0 ? 'Success' : 'Failed',
            'output' => $deployOutput
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
