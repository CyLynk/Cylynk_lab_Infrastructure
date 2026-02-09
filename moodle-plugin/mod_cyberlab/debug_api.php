<?php
/**
 * Debug script to test CyberLab API connection.
 * 
 * USAGE: Access this file directly in browser at:
 * https://your-moodle-site/mod/cyberlab/debug_api.php
 * 
 * DELETE THIS FILE AFTER DEBUGGING!
 */

require_once('../../config.php');
require_login();

// Only allow admins
require_capability('moodle/site:config', context_system::instance());

header('Content-Type: text/html; charset=utf-8');

echo "<h1>CyberLab API Debug</h1>";
echo "<pre>";

// Check configuration
$api_url = get_config('mod_cyberlab', 'api_url');
$webhook_secret = get_config('mod_cyberlab', 'webhook_secret');

echo "=== Configuration ===\n";
echo "mod_cyberlab api_url: " . ($api_url ?: 'NOT SET') . "\n";
echo "mod_cyberlab webhook_secret: " . ($webhook_secret ? 'SET (' . strlen($webhook_secret) . ' chars)' : 'NOT SET') . "\n";

// Fallback check
if (empty($api_url)) {
    $api_url = get_config('local_attackbox', 'api_url');
    echo "\nFallback to local_attackbox api_url: " . ($api_url ?: 'NOT SET') . "\n";
}
if (empty($webhook_secret)) {
    $webhook_secret = get_config('local_attackbox', 'webhook_secret');
    echo "Fallback to local_attackbox webhook_secret: " . ($webhook_secret ? 'SET' : 'NOT SET') . "\n";
}

echo "\n=== Final Configuration ===\n";
echo "API URL: " . ($api_url ?: 'MISSING!') . "\n";
echo "Webhook Secret: " . ($webhook_secret ? 'OK' : 'MISSING!') . "\n";

if (empty($api_url) || empty($webhook_secret)) {
    echo "\n❌ ERROR: API not configured properly!\n";
    echo "Go to: Site Admin → Plugins → Activity Modules → CyberLab\n";
    echo "</pre>";
    die();
}

// Test API connection
echo "\n=== Testing API Connection ===\n";

$timestamp = time();
$user_id = $USER->id;
$token = hash_hmac('sha256', $user_id . $timestamp, $webhook_secret);

// Test with a simple status check (if you have a session ID)
$test_endpoint = rtrim($api_url, '/') . '/lab/create';
echo "Test endpoint: $test_endpoint\n";
echo "User ID: $user_id\n";
echo "Timestamp: $timestamp\n";
echo "Token (first 20 chars): " . substr($token, 0, 20) . "...\n";

$request_data = [
    'user_id' => (string) $user_id,
    'template_id' => 'dvwa-web-vuln',
    'duration_hours' => 2,
    'cyberlab_id' => 1,
    'timestamp' => $timestamp,
    'token' => $token,
];

echo "\nRequest data:\n" . json_encode($request_data, JSON_PRETTY_PRINT) . "\n";

$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => $test_endpoint,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($request_data),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-Moodle-Token: ' . $token,
        'X-Moodle-Timestamp: ' . $timestamp,
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_VERBOSE => true,
]);

// Capture verbose output
$verbose = fopen('php://temp', 'w+');
curl_setopt($curl, CURLOPT_STDERR, $verbose);

echo "\n=== Making API Call ===\n";
$response = curl_exec($curl);
$curl_error = curl_error($curl);
$httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$info = curl_getinfo($curl);
curl_close($curl);

echo "HTTP Code: $httpcode\n";
echo "Total Time: {$info['total_time']} seconds\n";

if ($curl_error) {
    echo "\n❌ cURL Error: $curl_error\n";
}

echo "\n=== Response ===\n";
if ($response) {
    $decoded = json_decode($response, true);
    if ($decoded) {
        echo json_encode($decoded, JSON_PRETTY_PRINT) . "\n";
    } else {
        echo "Raw response: $response\n";
    }
} else {
    echo "Empty response\n";
}

// Show verbose curl output
rewind($verbose);
$verboseLog = stream_get_contents($verbose);
if ($verboseLog) {
    echo "\n=== cURL Verbose Log ===\n";
    echo htmlspecialchars($verboseLog);
}

// Check existing sessions in database
echo "\n=== Local Database Sessions ===\n";
$sessions = $DB->get_records_sql(
    "SELECT * FROM {cyberlab_sessions} WHERE userid = ? ORDER BY started_at DESC LIMIT 5",
    [$USER->id]
);

if ($sessions) {
    foreach ($sessions as $s) {
        echo "Session: {$s->session_id} | Status: {$s->status} | IP: " . ($s->target_ip ?: 'N/A') . " | Started: " . date('Y-m-d H:i:s', $s->started_at) . "\n";
    }
} else {
    echo "No sessions found for current user\n";
}

// Test status endpoint if we have a session
// Use the session from the create response if available
$test_session_id = isset($decoded['data']['session_id']) ? $decoded['data']['session_id'] : 'lab-a88e8ca9de86';
echo "\n=== Testing Status Endpoint ===\n";
$status_endpoint = rtrim($api_url, '/') . '/lab/status/' . $test_session_id;
echo "Status endpoint: $status_endpoint\n";
echo "Testing session: $test_session_id\n";

$curl2 = curl_init();
curl_setopt_array($curl2, [
    CURLOPT_URL => $status_endpoint,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-Moodle-Token: ' . $token,
        'X-Moodle-Timestamp: ' . $timestamp,
    ],
    CURLOPT_TIMEOUT => 10,
]);

$status_response = curl_exec($curl2);
$status_httpcode = curl_getinfo($curl2, CURLINFO_HTTP_CODE);
curl_close($curl2);

echo "HTTP Code: $status_httpcode\n";
if ($status_response) {
    $status_decoded = json_decode($status_response, true);
    echo "Status Response:\n" . json_encode($status_decoded, JSON_PRETTY_PRINT) . "\n";
} else {
    echo "Empty response\n";
}

echo "</pre>";

echo "<hr><p><strong>⚠️ DELETE THIS FILE AFTER DEBUGGING!</strong></p>";
