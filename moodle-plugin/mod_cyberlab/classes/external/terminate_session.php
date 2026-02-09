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
 * Terminate session external service for CyberLab.
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
 * Terminate session external function.
 */
class terminate_session extends external_api
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
     * Execute the service - calls AWS API to terminate session.
     *
     * @param int $cmid Course module ID
     * @param string $session_id Session ID
     * @return array
     */
    public static function execute(int $cmid, string $session_id): array
    {
        global $DB, $USER;

        error_log("[CyberLab terminate_session] Called with cmid=$cmid, session_id=$session_id, user_id={$USER->id}");

        // Validate parameters.
        $params = self::validate_parameters(self::execute_parameters(), [
            'cmid' => $cmid,
            'session_id' => $session_id,
        ]);

        // Basic validation - session_id must look valid.
        if (empty($params['session_id']) || strlen($params['session_id']) < 5) {
            error_log("[CyberLab terminate_session] Invalid session_id: {$params['session_id']}");
            return [
                'success' => false,
                'error' => 'Invalid session ID',
            ];
        }

        // Get course module and context.
        $cm = get_coursemodule_from_id('cyberlab', $params['cmid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);

        // Check capability - user can terminate their own session.
        require_capability('mod/cyberlab:attempt', $context);

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
            error_log("[CyberLab terminate_session] API not configured");
            return [
                'success' => false,
                'error' => get_string('error_apinotconfigured', 'mod_cyberlab'),
            ];
        }

        // Generate auth token.
        $timestamp = time();
        $token = hash_hmac('sha256', $USER->id . $timestamp, $webhook_secret);

        // Make API call to terminate lab session.
        $api_endpoint = rtrim($api_url, '/') . '/lab/terminate';
        $request_data = [
            'session_id' => $params['session_id'],
            'user_id' => (string) $USER->id,
            'timestamp' => $timestamp,
            'token' => $token,
        ];

        error_log("[CyberLab terminate_session] Calling API: $api_endpoint");

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

        error_log("[CyberLab terminate_session] API Response: HTTP $httpcode - $response");

        if ($httpcode !== 200) {
            $error_detail = "HTTP $httpcode";
            if ($response) {
                $error_data = json_decode($response, true);
                if (isset($error_data['error'])) {
                    $error_detail .= ": " . $error_data['error'];
                } elseif (isset($error_data['message'])) {
                    $error_detail .= ": " . $error_data['message'];
                }
            }
            if ($curl_error) {
                $error_detail .= " (cURL: $curl_error)";
            }

            error_log("[CyberLab terminate_session] API call failed: $error_detail");

            return [
                'success' => false,
                'error' => "Failed to terminate lab session [$error_detail]",
            ];
        }

        $response_data = json_decode($response, true);

        // Trigger event.
        $cyberlab = $DB->get_record('cyberlab', ['id' => $cm->instance], '*', MUST_EXIST);
        $event = \mod_cyberlab\event\lab_terminated::create([
            'objectid' => $cyberlab->id,
            'context' => $context,
            'other' => [
                'session_id' => $params['session_id'],
            ],
        ]);
        $event->trigger();

        error_log("[CyberLab terminate_session] Success! Session terminated.");

        return [
            'success' => true,
            'error' => '',
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
            'success' => new external_value(PARAM_BOOL, 'Whether termination was successful'),
            'error' => new external_value(PARAM_TEXT, 'Error message if failed'),
        ]);
    }
}
