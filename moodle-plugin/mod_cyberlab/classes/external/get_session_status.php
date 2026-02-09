<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Get session status external service for CyberLab.
 * 
 * SIMPLIFIED: Only uses DynamoDB (AWS) as source of truth.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_cyberlab\external;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/externallib.php');

use external_api;
use external_function_parameters;
use external_single_structure;
use external_value;
use context_module;

/**
 * Get session status external function.
 */
class get_session_status extends external_api
{

    /**
     * Parameter definition.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters
    {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module ID'),
            'session_id' => new external_value(PARAM_ALPHANUMEXT, 'Session ID'),
        ]);
    }

    /**
     * Execute the service - calls AWS API to get session status.
     *
     * @param int $cmid Course module ID
     * @param string $session_id Session ID
     * @return array
     */
    public static function execute(int $cmid, string $session_id): array
    {
        global $DB, $USER;

        error_log("[CyberLab get_session_status] session_id=$session_id");

        // Validate parameters.
        $params = self::validate_parameters(self::execute_parameters(), [
            'cmid' => $cmid,
            'session_id' => $session_id,
        ]);

        // Get course module and context.
        $cm = get_coursemodule_from_id('cyberlab', $params['cmid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);

        // Check capability.
        require_capability('mod/cyberlab:view', $context);

        // Get API configuration.
        $api_url = get_config('mod_cyberlab', 'api_url');
        $webhook_secret = get_config('mod_cyberlab', 'webhook_secret');

        // Fallback to local_attackbox config.
        if (empty($api_url)) {
            $api_url = get_config('local_attackbox', 'api_url');
        }
        if (empty($webhook_secret)) {
            $webhook_secret = get_config('local_attackbox', 'webhook_secret');
        }

        if (empty($api_url) || empty($webhook_secret)) {
            return [
                'status' => 'error',
                'target_ip' => '',
                'progress' => 0,
                'error_message' => 'API not configured',
                'time_remaining' => 0,
            ];
        }

        // Generate auth token.
        $timestamp = time();
        $token = hash_hmac('sha256', $USER->id . $timestamp, $webhook_secret);

        // Make API call directly to AWS.
        $api_endpoint = rtrim($api_url, '/') . '/lab/status/' . $params['session_id'];

        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $api_endpoint,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-Moodle-Token: ' . $token,
                'X-Moodle-Timestamp: ' . $timestamp,
            ],
            CURLOPT_TIMEOUT => 10,
        ]);

        $response = curl_exec($curl);
        $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        error_log("[CyberLab get_session_status] API response: HTTP $httpcode - $response");

        if ($httpcode !== 200) {
            $error_msg = 'Failed to get status';
            if ($response) {
                $error_data = json_decode($response, true);
                $error_msg = $error_data['details'] ?? $error_data['message'] ?? $error_msg;
            }
            return [
                'status' => 'error',
                'target_ip' => '',
                'progress' => 0,
                'error_message' => $error_msg,
                'time_remaining' => 0,
            ];
        }

        $response_data = json_decode($response, true);

        // Handle nested response structure - API returns data inside 'data' key.
        $status_data = $response_data;
        if (isset($response_data['data']) && is_array($response_data['data'])) {
            $status_data = $response_data['data'];
        }

        $status = $status_data['status'] ?? 'unknown';
        $target_ip = $status_data['target_ip'] ?? '';
        $progress = $status_data['progress'] ?? 50;
        $time_remaining = $status_data['time_remaining_seconds'] ?? 0;
        $error_message = $status_data['error'] ?? $status_data['message'] ?? '';

        error_log("[CyberLab get_session_status] Parsed: status=$status, ip=$target_ip, progress=$progress");

        return [
            'status' => $status,
            'target_ip' => $target_ip ?: '',
            'progress' => (int) $progress,
            'error_message' => $error_message,
            'time_remaining' => (int) $time_remaining,
        ];
    }

    /**
     * Return definition.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure
    {
        return new external_single_structure([
            'status' => new external_value(PARAM_ALPHANUMEXT, 'Session status'),
            'target_ip' => new external_value(PARAM_TEXT, 'Target VM IP address'),
            'progress' => new external_value(PARAM_INT, 'Launch progress percentage'),
            'error_message' => new external_value(PARAM_TEXT, 'Error message if any'),
            'time_remaining' => new external_value(PARAM_INT, 'Seconds remaining in session'),
        ]);
    }
}
