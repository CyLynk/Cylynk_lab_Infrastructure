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
 * Library functions for CyberLab activity module.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Returns the information on whether the module supports a feature.
 *
 * @param string $feature FEATURE_xx constant for requested feature
 * @return mixed true if the feature is supported, null if unknown
 */
function cyberlab_supports($feature)
{
    switch ($feature) {
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_GRADE_HAS_GRADE:
            return false;
        case FEATURE_BACKUP_MOODLE2:
            return true;
        case FEATURE_COMPLETION_TRACKS_VIEWS:
            return true;
        case FEATURE_COMPLETION_HAS_RULES:
            return true;
        case FEATURE_MOD_PURPOSE:
            return MOD_PURPOSE_ASSESSMENT;
        default:
            return null;
    }
}

/**
 * Saves a new instance of the cyberlab into the database.
 *
 * @param stdClass $cyberlab An object from the form in mod_form.php
 * @param mod_cyberlab_mod_form $mform The form
 * @return int The id of the newly inserted cyberlab record
 */
function cyberlab_add_instance($cyberlab, $mform = null)
{
    global $DB;

    $cyberlab->timecreated = time();
    $cyberlab->timemodified = time();

    // Process connection methods (checkboxes to JSON).
    $connection_methods = [];
    if (!empty($cyberlab->connection_lynkbox)) {
        $connection_methods[] = 'lynkbox';
    }
    if (!empty($cyberlab->connection_tailscale)) {
        $connection_methods[] = 'tailscale';
    }
    if (!empty($cyberlab->connection_openvpn)) {
        $connection_methods[] = 'openvpn';
    }
    $cyberlab->connection_methods = json_encode($connection_methods);

    $id = $DB->insert_record('cyberlab', $cyberlab);

    return $id;
}

/**
 * Updates an instance of the cyberlab in the database.
 *
 * @param stdClass $cyberlab An object from the form in mod_form.php
 * @param mod_cyberlab_mod_form $mform The form
 * @return bool Success/Fail
 */
function cyberlab_update_instance($cyberlab, $mform = null)
{
    global $DB;

    $cyberlab->timemodified = time();
    $cyberlab->id = $cyberlab->instance;

    // Process connection methods.
    $connection_methods = [];
    if (!empty($cyberlab->connection_lynkbox)) {
        $connection_methods[] = 'lynkbox';
    }
    if (!empty($cyberlab->connection_tailscale)) {
        $connection_methods[] = 'tailscale';
    }
    if (!empty($cyberlab->connection_openvpn)) {
        $connection_methods[] = 'openvpn';
    }
    $cyberlab->connection_methods = json_encode($connection_methods);

    $result = $DB->update_record('cyberlab', $cyberlab);

    return $result;
}

/**
 * Removes an instance of the cyberlab from the database.
 *
 * @param int $id Id of the module instance
 * @return bool True if successful, false on failure
 */
function cyberlab_delete_instance($id)
{
    global $DB;

    if (!$cyberlab = $DB->get_record('cyberlab', ['id' => $id])) {
        return false;
    }

    // Delete any dependent records.
    $DB->delete_records('cyberlab_sessions', ['cyberlabid' => $id]);

    // Delete the instance itself.
    $DB->delete_records('cyberlab', ['id' => $id]);

    return true;
}

/**
 * Returns a small object with summary information about what a user has done.
 *
 * @param stdClass $course The course record
 * @param stdClass $user The user record
 * @param cm_info|stdClass $mod Course module info
 * @param stdClass $cyberlab The cyberlab instance record
 * @return stdClass|null
 */
function cyberlab_user_outline($course, $user, $mod, $cyberlab)
{
    global $DB;

    $result = new stdClass();

    // Count sessions for this user.
    $sessions = $DB->count_records('cyberlab_sessions', [
        'cyberlabid' => $cyberlab->id,
        'userid' => $user->id,
    ]);

    if ($sessions > 0) {
        $result->info = get_string('numsessions', 'mod_cyberlab', $sessions);

        // Get last session time.
        $lastsession = $DB->get_field_sql(
            "SELECT MAX(started_at) FROM {cyberlab_sessions} WHERE cyberlabid = ? AND userid = ?",
            [$cyberlab->id, $user->id]
        );
        if ($lastsession) {
            $result->time = $lastsession;
        }
    } else {
        $result->info = get_string('nosessions', 'mod_cyberlab');
    }

    return $result;
}

/**
 * Prints a detailed representation of what a user has done.
 *
 * @param stdClass $course The course record
 * @param stdClass $user The user record
 * @param cm_info|stdClass $mod Course module info
 * @param stdClass $cyberlab The cyberlab instance record
 */
function cyberlab_user_complete($course, $user, $mod, $cyberlab)
{
    global $DB, $OUTPUT;

    // Get all sessions for this user in this lab.
    $sessions = $DB->get_records('cyberlab_sessions', [
        'cyberlabid' => $cyberlab->id,
        'userid' => $user->id,
    ], 'started_at DESC');

    if (empty($sessions)) {
        echo $OUTPUT->notification(get_string('nosessions', 'mod_cyberlab'), 'info');
        return;
    }

    // Build table.
    $table = new html_table();
    $table->head = [
        get_string('sessionid', 'mod_cyberlab'),
        get_string('status', 'mod_cyberlab'),
        get_string('startedat', 'mod_cyberlab'),
        get_string('duration', 'mod_cyberlab'),
    ];

    foreach ($sessions as $session) {
        $duration = '';
        if ($session->ended_at && $session->started_at) {
            $seconds = $session->ended_at - $session->started_at;
            $duration = format_time($seconds);
        } elseif ($session->status === 'running') {
            $duration = get_string('inprogress', 'mod_cyberlab');
        }

        $table->data[] = [
            $session->session_id,
            get_string('status_' . $session->status, 'mod_cyberlab'),
            userdate($session->started_at),
            $duration,
        ];
    }

    echo html_writer::table($table);
}

/**
 * Obtains the automatic completion state for this cyberlab activity.
 *
 * @param stdClass $course The course record
 * @param cm_info|stdClass $cm Course module info
 * @param int $userid The user ID
 * @param bool $type Type of comparison (or/and)
 * @return bool True if completed, false if not
 */
function cyberlab_get_completion_state($course, $cm, $userid, $type)
{
    global $DB;

    // Get the cyberlab instance.
    $cyberlab = $DB->get_record('cyberlab', ['id' => $cm->instance], '*', MUST_EXIST);

    // Check if user has completed at least one session.
    $completed = $DB->record_exists_sql(
        "SELECT 1 FROM {cyberlab_sessions} WHERE cyberlabid = ? AND userid = ? AND status = 'terminated'",
        [$cyberlab->id, $userid]
    );

    return $completed;
}

/**
 * Get the available lab templates from the API.
 *
 * @return array List of lab templates
 */
function cyberlab_get_available_templates()
{
    $api_url = get_config('local_attackbox', 'api_url');

    if (empty($api_url)) {
        return [];
    }

    // TODO: Implement API call to fetch templates.
    // For now, return demo templates.
    return [
        'dvwa-web-vuln' => 'DVWA - Damn Vulnerable Web Application',
        'juice-shop' => 'OWASP Juice Shop',
        'metasploitable' => 'Metasploitable 3',
        'dvcp-network' => 'DVCP - Network Attacks Lab',
        'windows-ad' => 'Windows Active Directory Lab',
    ];
}
