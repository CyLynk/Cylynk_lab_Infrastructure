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
 * Submit flag external service for CyberLab.
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
 * Submit flag external function.
 */
class submit_flag extends external_api
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
            'flag' => new external_value(PARAM_TEXT, 'Flag to submit'),
        ]);
    }

    /**
     * Execute the service.
     *
     * @param int $cmid Course module ID
     * @param string $session_id Session ID
     * @param string $flag Flag to submit
     * @return array
     */
    public static function execute(int $cmid, string $session_id, string $flag): array
    {
        global $DB, $USER;

        // Validate parameters.
        $params = self::validate_parameters(self::execute_parameters(), [
            'cmid' => $cmid,
            'session_id' => $session_id,
            'flag' => $flag,
        ]);

        // Get course module and context.
        $cm = get_coursemodule_from_id('cyberlab', $params['cmid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);

        // Check capability.
        require_capability('mod/cyberlab:submitflags', $context);

        // Get the cyberlab instance.
        $cyberlab = $DB->get_record('cyberlab', ['id' => $cm->instance], '*', MUST_EXIST);

        // Get the session.
        $session = $DB->get_record('cyberlab_sessions', [
            'session_id' => $params['session_id'],
            'userid' => $USER->id,
            'cyberlabid' => $cyberlab->id,
        ]);

        if (!$session) {
            return [
                'success' => false,
                'correct' => false,
                'message' => 'Session not found',
            ];
        }

        // Check against expected flags.
        $is_correct = false;
        $expected_flags = [];

        if (!empty($cyberlab->expected_flags)) {
            $expected_flags = json_decode($cyberlab->expected_flags, true) ?? [];
        }

        if (!empty($expected_flags)) {
            // Case-sensitive comparison.
            $is_correct = in_array(trim($params['flag']), $expected_flags, true);
        }

        // Record the submission.
        $submission = new \stdClass();
        $submission->sessionid = $session->id;
        $submission->flag_submitted = trim($params['flag']);
        $submission->is_correct = $is_correct ? 1 : 0;
        $submission->submitted_at = time();
        $DB->insert_record('cyberlab_flags', $submission);

        // Update session flags_found if correct.
        if ($is_correct) {
            $flags_found = [];
            if (!empty($session->flags_found)) {
                $flags_found = json_decode($session->flags_found, true) ?? [];
            }

            if (!in_array(trim($params['flag']), $flags_found)) {
                $flags_found[] = trim($params['flag']);
                $update = new \stdClass();
                $update->id = $session->id;
                $update->flags_found = json_encode($flags_found);
                $DB->update_record('cyberlab_sessions', $update);
            }
        }

        // Trigger event.
        $event = \mod_cyberlab\event\flag_submitted::create([
            'objectid' => $cyberlab->id,
            'context' => $context,
            'other' => [
                'session_id' => $params['session_id'],
                'is_correct' => $is_correct,
            ],
        ]);
        $event->trigger();

        return [
            'success' => true,
            'correct' => $is_correct,
            'message' => $is_correct ? 'Correct flag!' : 'Incorrect flag. Try again.',
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
            'success' => new external_value(PARAM_BOOL, 'Whether submission was recorded'),
            'correct' => new external_value(PARAM_BOOL, 'Whether the flag was correct'),
            'message' => new external_value(PARAM_TEXT, 'Response message'),
        ]);
    }
}
