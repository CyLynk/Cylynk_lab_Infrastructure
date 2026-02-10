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
$session_id = required_param('session_id', PARAM_ALPHANUM);

// Get course module and context.
$cm = get_coursemodule_from_id('cyberlab', $cmid, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$cyberlab = $DB->get_record('cyberlab', ['id' => $cm->instance], '*', MUST_EXIST);
$context = context_module::instance($cm->id);

// Require login and capabilities.
require_login($course, false, $cm);
require_capability('mod/cyberlab:attempt', $context);

// Verify session ownership.
$session = $DB->get_record('cyberlab_sessions', [
    'session_id' => $session_id,
    'cyberlabid' => $cyberlab->id,
    'userid' => $USER->id
], '*', MUST_EXIST);

// Verify session is active.
if ($session->status !== 'running') {
    throw new moodle_exception('error', 'mod_cyberlab', '', 'Session is not running.');
}

// Verify OpenVPN is enabled.
$methods = json_decode($cyberlab->connection_methods, true);
if (!in_array('openvpn', $methods)) {
    throw new moodle_exception('error', 'mod_cyberlab', '', 'OpenVPN is not enabled for this lab.');
}

// Call Orchestrator API to get the real config.
$api_url = get_config('mod_cyberlab', 'api_url');
$secret = get_config('mod_cyberlab', 'webhook_secret');

if (empty($api_url) || empty($secret)) {
    throw new moodle_exception('error', 'mod_cyberlab', '', 'API not configured.');
}

$url = rtrim($api_url, '/') . '/vpn-config';
$params = [
    'session_id' => $session_id,
    'student_id' => $USER->id
];
$url .= '?' . http_build_query($params);

$curl = curl_init();
curl_setopt($curl, CURLOPT_URL, $url);
curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
curl_setopt($curl, CURLOPT_HEADER, false);
curl_setopt($curl, CURLOPT_HTTPHEADER, [
    'X-Date: ' . gmdate('Ymd\THis\Z'),
    'Authorization: ' . $secret // In a real scenario, should use proper signing
]);

$vpn_config = curl_exec($curl);
$http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($http_code !== 200 || empty($vpn_config)) {
    throw new moodle_exception('error', 'mod_cyberlab', '', 'Failed to retrieve VPN configuration from backend.');
}

// Send file download headers.
header('Content-Type: application/x-openvpn-profile');
header('Content-Disposition: attachment; filename="cyberlab-' . $session_id . '.ovpn"');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

echo $vpn_config;
exit;
