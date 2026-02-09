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
 * Get active session external service for CyberLab.
 * 
 * SIMPLIFIED: Calls AWS API to check for active sessions.
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
 * Get active session external function.
 */
class get_active_session extends external_api
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
        ]);
    }

    /**
     * Execute the service - checks AWS for active session.
     *
     * @param int $cmid Course module ID
     * @return array
     */
    public static function execute(int $cmid): array
    {
        global $DB, $USER;

        // Validate parameters.
        $params = self::validate_parameters(self::execute_parameters(), [
            'cmid' => $cmid,
        ]);

        // Get course module and context.
        $cm = get_coursemodule_from_id('cyberlab', $params['cmid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);

        // Check capability.
        require_capability('mod/cyberlab:view', $context);

        // Get the cyberlab instance.
        $cyberlab = $DB->get_record('cyberlab', ['id' => $cm->instance], '*', MUST_EXIST);

        // Get API configuration.
        $api_url = get_config('mod_cyberlab', 'api_url');
        $webhook_secret = get_config('mod_cyberlab', 'webhook_secret');

        if (empty($api_url)) {
            $api_url = get_config('local_attackbox', 'api_url');
        }
        if (empty($webhook_secret)) {
            $webhook_secret = get_config('local_attackbox', 'webhook_secret');
        }

        if (empty($api_url) || empty($webhook_secret)) {
            return [
                'session_id' => '',
                'status' => '',
                'target_ip' => '',
                'started_at' => 0,
            ];
        }

        // Call the create endpoint - it returns existing sessions if any.
        $timestamp = time();
        $token = hash_hmac('sha256', $USER->id . $timestamp, $webhook_secret);

        $api_endpoint = rtrim($api_url, '/') . '/lab/create';
        $request_data = [
            'user_id' => (string) $USER->id,
            'template_id' => $cyberlab->template_id ?? 'dvwa-web-vuln',
            'duration_hours' => $cyberlab->duration_hours ?? 2,
            'cyberlab_id' => $cyberlab->id,
            'timestamp' => $timestamp,
            'token' => $token,
            'check_only' => true,  // Signal we just want to check, not create
        ];

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
            CURLOPT_TIMEOUT => 10,
        ]);

        $response = curl_exec($curl);
        $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        if ($httpcode !== 200) {
            return [
                'session_id' => '',
                'status' => '',
                'target_ip' => '',
                'started_at' => 0,
            ];
        }

        $response_data = json_decode($response, true);

        // Handle nested data structure.
        $session_data = $response_data;
        if (isset($response_data['data']) && is_array($response_data['data'])) {
            $session_data = $response_data['data'];
        }

        // Only return if this is an existing session.
        if (empty($session_data['existing']) || empty($session_data['session_id'])) {
            return [
                'session_id' => '',
                'status' => '',
                'target_ip' => '',
                'started_at' => 0,
            ];
        }

        return [
            'session_id' => $session_data['session_id'],
            'status' => $session_data['status'] ?? 'launching',
            'target_ip' => $session_data['target_ip'] ?? '',
            'started_at' => 0,  // AWS doesn't give us this easily
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
            'session_id' => new external_value(PARAM_ALPHANUMEXT, 'Session ID if active'),
            'status' => new external_value(PARAM_ALPHANUMEXT, 'Session status'),
            'target_ip' => new external_value(PARAM_TEXT, 'Target VM IP if running'),
            'started_at' => new external_value(PARAM_INT, 'Session start timestamp'),
        ]);
    }
}
