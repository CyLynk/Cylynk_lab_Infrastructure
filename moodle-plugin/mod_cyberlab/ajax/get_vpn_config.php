<?php
/**
 * Ajax script to download OpenVPN configuration.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/cyberlab/lib.php');

$cmid = required_param('cmid', PARAM_INT);
$session_id = required_param('session_id', PARAM_ALPHANUMEXT);

// Get course module and context.
$cm = get_coursemodule_from_id('cyberlab', $cmid, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$cyberlab = $DB->get_record('cyberlab', ['id' => $cm->instance], '*', MUST_EXIST);
$context = context_module::instance($cm->id);

// Require login and capabilities.
require_login($course, false, $cm);
require_capability('mod/cyberlab:attempt', $context);

// Verify OpenVPN is enabled.
$methods = json_decode($cyberlab->connection_methods, true);
if (!in_array('openvpn', $methods)) {
    throw new moodle_exception('error', 'mod_cyberlab', '', 'OpenVPN is not enabled for this lab.');
}

// Get API configuration (with local_attackbox fallback, matching other endpoints).
$api_url = get_config('mod_cyberlab', 'api_url');
$webhook_secret = get_config('mod_cyberlab', 'webhook_secret');

if (empty($api_url)) {
    $api_url = get_config('local_attackbox', 'api_url');
}
if (empty($webhook_secret)) {
    $webhook_secret = get_config('local_attackbox', 'webhook_secret');
}

if (empty($api_url) || empty($webhook_secret)) {
    throw new moodle_exception('error', 'mod_cyberlab', '', 'API not configured.');
}

// Build authenticated request (matching other endpoints' auth pattern).
$timestamp = time();
$token = hash_hmac('sha256', $USER->id . $timestamp, $webhook_secret);

$url = rtrim($api_url, '/') . '/vpn-config';
$params = [
    'session_id' => $session_id,
    'student_id' => (string) $USER->id
];
$url .= '?' . http_build_query($params, '', '&');

$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => false,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-Moodle-Token: ' . $token,
        'X-Moodle-Timestamp: ' . $timestamp,
    ],
    CURLOPT_TIMEOUT => 30,
]);

$vpn_config = curl_exec($curl);
$curl_error = curl_error($curl);
$http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($curl_error) {
    throw new moodle_exception('error', 'mod_cyberlab', '', 'VPN config request failed: ' . $curl_error);
}

if ($http_code !== 200 || empty($vpn_config)) {
    $error_detail = "HTTP $http_code";
    $decoded = json_decode($vpn_config, true);
    if ($decoded && isset($decoded['error'])) {
        $error_detail .= ': ' . $decoded['error'];
    }
    throw new moodle_exception('error', 'mod_cyberlab', '', 'Failed to retrieve VPN configuration: ' . $error_detail);
}

// Send file download headers.
header('Content-Type: application/x-openvpn-profile');
header('Content-Disposition: attachment; filename="cyberlab-' . $session_id . '.ovpn"');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

echo $vpn_config;
exit;
