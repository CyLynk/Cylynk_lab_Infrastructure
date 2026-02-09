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
 * Start lab session external service for CyberLab.
 * 
 * SIMPLIFIED: Only uses DynamoDB (AWS) as source of truth.
 * No local Moodle database storage for sessions.
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
 * Start session external function.
 */
class start_session extends external_api
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
            'template_id' => new external_value(PARAM_ALPHANUMEXT, 'Lab template identifier'),
        ]);
    }

    /**
     * Execute the service - calls AWS API to create/get session.
     *
     * @param int $cmid Course module ID
     * @param string $template_id Lab template identifier
     * @return array
     */
    public static function execute(int $cmid, string $template_id): array
    {
        global $DB, $USER;

        error_log("[CyberLab start_session] Called with cmid=$cmid, template_id=$template_id, user_id={$USER->id}");

        // Validate parameters.
        $params = self::validate_parameters(self::execute_parameters(), [
            'cmid' => $cmid,
            'template_id' => $template_id,
        ]);

        // Get course module and context.
        $cm = get_coursemodule_from_id('cyberlab', $params['cmid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);

        // Check capability.
        require_capability('mod/cyberlab:attempt', $context);

        // Get the cyberlab instance.
        $cyberlab = $DB->get_record('cyberlab', ['id' => $cm->instance], '*', MUST_EXIST);

        // Get API configuration.
        $api_url = get_config('mod_cyberlab', 'api_url');
        $webhook_secret = get_config('mod_cyberlab', 'webhook_secret');

        // Fallback to local_attackbox config if mod_cyberlab not configured.
        if (empty($api_url)) {
            $api_url = get_config('local_attackbox', 'api_url');
        }
        if (empty($webhook_secret)) {
            $webhook_secret = get_config('local_attackbox', 'webhook_secret');
        }

        if (empty($api_url) || empty($webhook_secret)) {
            error_log("[CyberLab] API not configured");
            return [
                'success' => false,
                'error' => get_string('error_apinotconfigured', 'mod_cyberlab'),
                'session_id' => '',
            ];
        }

        // Generate auth token.
        $timestamp = time();
        $token = hash_hmac('sha256', $USER->id . $timestamp, $webhook_secret);

        // Prepare API request.
        $api_endpoint = rtrim($api_url, '/') . '/lab/create';
        $request_data = [
            'user_id' => (string) $USER->id,
            'template_id' => $params['template_id'],
            'duration_hours' => $cyberlab->duration_hours ?? 2,
            'cyberlab_id' => $cyberlab->id,
            'timestamp' => $timestamp,
            'token' => $token,
        ];

        error_log("[CyberLab] Calling API: $api_endpoint");

        // Make API call.
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $api_endpoint,
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
        ]);

        $response = curl_exec($curl);
        $curl_error = curl_error($curl);
        $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        error_log("[CyberLab] API Response: HTTP $httpcode - $response");

        if ($httpcode !== 200 && $httpcode !== 201) {
            $error_detail = "HTTP $httpcode";
            if ($response) {
                $error_data = json_decode($response, true);
                if (isset($error_data['message'])) {
                    $error_detail .= ": " . $error_data['message'];
                }
            }
            if ($curl_error) {
                $error_detail .= " (cURL: $curl_error)";
            }

            error_log("[CyberLab] API call failed: $error_detail");

            return [
                'success' => false,
                'error' => get_string('error_launchfailed', 'mod_cyberlab') . " [$error_detail]",
                'session_id' => '',
            ];
        }

        $response_data = json_decode($response, true);

        // Handle nested response structure - API returns data inside 'data' key.
        $session_data = $response_data;
        if (isset($response_data['data']) && is_array($response_data['data'])) {
            $session_data = $response_data['data'];
        }

        // Check for session_id.
        if (empty($session_data['session_id'])) {
            error_log("[CyberLab] No session_id in response");
            return [
                'success' => false,
                'error' => $response_data['message'] ?? get_string('error_launchfailed', 'mod_cyberlab'),
                'session_id' => '',
            ];
        }

        $session_id = $session_data['session_id'];
        $is_existing = !empty($session_data['existing']);

        error_log("[CyberLab] Success! session_id=$session_id, existing=" . ($is_existing ? 'true' : 'false'));

        return [
            'success' => true,
            'error' => '',
            'session_id' => $session_id,
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
            'success' => new external_value(PARAM_BOOL, 'Whether the session was started successfully'),
            'error' => new external_value(PARAM_TEXT, 'Error message if failed'),
            'session_id' => new external_value(PARAM_ALPHANUMEXT, 'Session ID if successful'),
        ]);
    }
}
