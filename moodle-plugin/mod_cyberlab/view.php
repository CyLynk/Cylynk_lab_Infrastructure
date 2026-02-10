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
 * View page for CyberLab activity - Student lab launcher interface.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/cyberlab/lib.php');

// Get course module ID.
$id = optional_param('id', 0, PARAM_INT);
$c = optional_param('c', 0, PARAM_INT);

if ($id) {
    $cm = get_coursemodule_from_id('cyberlab', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $cyberlab = $DB->get_record('cyberlab', ['id' => $cm->instance], '*', MUST_EXIST);
} else if ($c) {
    $cyberlab = $DB->get_record('cyberlab', ['id' => $c], '*', MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cyberlab->course], '*', MUST_EXIST);
    $cm = get_coursemodule_from_instance('cyberlab', $cyberlab->id, $course->id, false, MUST_EXIST);
} else {
    throw new moodle_exception('missingparameter');
}

// Require login and course context.
require_login($course, true, $cm);
$context = context_module::instance($cm->id);

// Check capability.
require_capability('mod/cyberlab:view', $context);

// Log view event.
$event = \mod_cyberlab\event\course_module_viewed::create([
    'objectid' => $cyberlab->id,
    'context' => $context,
]);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('cyberlab', $cyberlab);
$event->trigger();

// Mark activity as viewed.
$completion = new completion_info($course);
$completion->set_module_viewed($cm);

// Set up the page.
$PAGE->set_url('/mod/cyberlab/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($cyberlab->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);

// Add JavaScript.
$PAGE->requires->js_call_amd('mod_cyberlab/lab_launcher', 'init', [
    'cmid' => $cm->id,
    'templateId' => $cyberlab->template_id,
    'sessionDuration' => $cyberlab->duration_hours,
]);

// Output starts here.
echo $OUTPUT->header();

// Lab header with title and difficulty badge.
$difficultyclass = 'badge-' . $cyberlab->difficulty;
$difficultytext = get_string('difficulty_' . $cyberlab->difficulty, 'mod_cyberlab');

echo html_writer::start_div('cyberlab-header mb-4');
echo html_writer::tag('h2', format_string($cyberlab->name));
echo html_writer::tag('span', $difficultytext, ['class' => "badge $difficultyclass mr-2"]);
echo html_writer::tag('span', get_string('duration', 'mod_cyberlab') . ': ' .
    get_string('nhours', 'mod_cyberlab', $cyberlab->duration_hours), ['class' => 'text-muted']);
echo html_writer::end_div();

// Lab description.
if (!empty($cyberlab->intro)) {
    echo $OUTPUT->box(format_module_intro('cyberlab', $cyberlab, $cm->id), 'generalbox', 'intro');
}

// Lab objectives.
if (!empty($cyberlab->objectives)) {
    echo html_writer::start_div('cyberlab-objectives card mb-4');
    echo html_writer::start_div('card-header');
    echo html_writer::tag('h4', get_string('objectives', 'mod_cyberlab'), ['class' => 'm-0']);
    echo html_writer::end_div();
    echo html_writer::start_div('card-body');
    echo html_writer::tag('p', nl2br(format_text($cyberlab->objectives)));
    echo html_writer::end_div();
    echo html_writer::end_div();
}

// Connection methods info.
$connectionmethods = json_decode($cyberlab->connection_methods, true) ?? ['lynkbox'];

echo html_writer::start_div('cyberlab-connections card mb-4');
echo html_writer::start_div('card-header');
echo html_writer::tag('h4', get_string('connectionmethods', 'mod_cyberlab'), ['class' => 'm-0']);
echo html_writer::end_div();
echo html_writer::start_div('card-body');

foreach ($connectionmethods as $method) {
    $icon = '';
    switch ($method) {
        case 'lynkbox':
            $icon = 'fa-desktop';
            break;
        case 'tailscale':
            $icon = 'fa-network-wired';
            break;
        case 'openvpn':
            $icon = 'fa-lock';
            break;
    }
    echo html_writer::start_div('connection-method mb-2');
    echo html_writer::tag('i', '', ['class' => "fa $icon mr-2"]);
    echo html_writer::tag('strong', get_string('connection_' . $method, 'mod_cyberlab'));
    echo ' - ';
    echo get_string('connection_' . $method . '_desc', 'mod_cyberlab');
    echo html_writer::end_div();
}

echo html_writer::end_div();
echo html_writer::end_div();

// Lab launcher panel.
echo html_writer::start_div('cyberlab-launcher card mb-4');
echo html_writer::start_div('card-header bg-primary text-white');
echo html_writer::tag('h4', get_string('labsession', 'mod_cyberlab'), ['class' => 'm-0']);
echo html_writer::end_div();
echo html_writer::start_div('card-body');

// Session status display (updated by JavaScript).
echo html_writer::start_div('session-status mb-3', ['id' => 'cyberlab-session-status']);
echo html_writer::tag('p', get_string('nosessionstarted', 'mod_cyberlab'), ['class' => 'text-muted']);
echo html_writer::end_div();

// Target info panel (shown when lab is running).
echo html_writer::start_div('target-info alert alert-success', ['id' => 'cyberlab-target-info', 'style' => 'display: none;']);
echo html_writer::tag('h5', get_string('targetinfo', 'mod_cyberlab'));
echo html_writer::start_div('target-ip');
echo html_writer::tag('strong', get_string('targetip', 'mod_cyberlab') . ': ');
echo html_writer::tag('code', '-', ['id' => 'cyberlab-target-ip', 'class' => 'h4']);
echo html_writer::tag('button', get_string('copy', 'mod_cyberlab'), [
    'class' => 'btn btn-sm btn-outline-secondary ml-2',
    'id' => 'cyberlab-copy-ip',
    'title' => get_string('copyip', 'mod_cyberlab'),
]);
echo html_writer::end_div();
echo html_writer::end_div();

// Progress indicator (shown while launching).
echo html_writer::start_div('launch-progress', ['id' => 'cyberlab-launch-progress', 'style' => 'display: none;']);
echo html_writer::start_div('d-flex align-items-center');
echo html_writer::tag('div', '', ['class' => 'spinner-border text-primary mr-3', 'role' => 'status']);
echo html_writer::tag('span', get_string('launchinglab', 'mod_cyberlab'), ['id' => 'cyberlab-progress-text']);
echo html_writer::end_div();
echo html_writer::start_div('progress mt-2');
echo html_writer::tag('div', '', [
    'class' => 'progress-bar progress-bar-striped progress-bar-animated',
    'id' => 'cyberlab-progress-bar',
    'role' => 'progressbar',
    'style' => 'width: 0%',
]);
echo html_writer::end_div();
echo html_writer::end_div();

// Action buttons.
echo html_writer::start_div('cyberlab-actions mt-4');

// Start Lab button.
echo html_writer::tag('button', html_writer::tag('i', '', ['class' => 'fa fa-play mr-2']) .
    get_string('startlab', 'mod_cyberlab'), [
    'class' => 'btn btn-lg btn-success mr-2',
    'id' => 'cyberlab-start-btn',
]);

// Terminate Lab button.
echo html_writer::tag('button', html_writer::tag('i', '', ['class' => 'fa fa-stop mr-2']) .
    get_string('terminatelab', 'mod_cyberlab'), [
    'class' => 'btn btn-lg btn-danger mr-2',
    'id' => 'cyberlab-terminate-btn',
    'style' => 'display: none;',
]);

// Download VPN Config button (if OpenVPN connection enabled).
if (in_array('openvpn', $connectionmethods)) {
    echo html_writer::tag('button', html_writer::tag('i', '', ['class' => 'fa fa-download mr-2']) .
        get_string('downloadvpnconfig', 'mod_cyberlab'), [
        'class' => 'btn btn-lg btn-info mr-2',
        'id' => 'cyberlab-vpn-btn',
        'style' => 'display: none;',
    ]);
}

// Launch LynkBox button (if LynkBox connection enabled).
if (in_array('lynkbox', $connectionmethods)) {
    echo html_writer::tag('button', html_writer::tag('i', '', ['class' => 'fa fa-terminal mr-2']) .
        get_string('openlynkbox', 'mod_cyberlab'), [
        'class' => 'btn btn-lg btn-primary',
        'id' => 'cyberlab-lynkbox-btn',
        'style' => 'display: none;',
    ]);
}

echo html_writer::end_div();

echo html_writer::end_div(); // card-body
echo html_writer::end_div(); // card

// Hints section (collapsible).
if (!empty($cyberlab->hints)) {
    echo html_writer::start_div('cyberlab-hints card mb-4');
    echo html_writer::start_div('card-header');
    echo html_writer::tag('h4', get_string('hints', 'mod_cyberlab'), ['class' => 'm-0']);
    echo html_writer::tag('button', get_string('showhints', 'mod_cyberlab'), [
        'class' => 'btn btn-sm btn-outline-secondary float-right',
        'data-toggle' => 'collapse',
        'data-target' => '#hints-content',
    ]);
    echo html_writer::end_div();
    echo html_writer::start_div('card-body collapse', ['id' => 'hints-content']);
    echo html_writer::tag('p', nl2br(format_text($cyberlab->hints)));
    echo html_writer::end_div();
    echo html_writer::end_div();
}

// Flag format info (if CTF-style).
if (!empty($cyberlab->flag_format)) {
    echo html_writer::start_div('cyberlab-flag-info alert alert-info');
    echo html_writer::tag('strong', get_string('flagformat', 'mod_cyberlab') . ': ');
    echo html_writer::tag('code', $cyberlab->flag_format);
    echo html_writer::end_div();
}

// Session history (for returning students).
if (has_capability('mod/cyberlab:attempt', $context)) {
    $sessions = $DB->get_records('cyberlab_sessions', [
        'cyberlabid' => $cyberlab->id,
        'userid' => $USER->id,
    ], 'started_at DESC', '*', 0, 5);

    if (!empty($sessions)) {
        echo html_writer::start_div('cyberlab-history card mb-4');
        echo html_writer::start_div('card-header');
        echo html_writer::tag('h4', get_string('sessionhistory', 'mod_cyberlab'), ['class' => 'm-0']);
        echo html_writer::end_div();
        echo html_writer::start_div('card-body');

        echo html_writer::start_tag('table', ['class' => 'table table-sm']);
        echo html_writer::start_tag('thead');
        echo html_writer::start_tag('tr');
        echo html_writer::tag('th', get_string('date', 'mod_cyberlab'));
        echo html_writer::tag('th', get_string('status', 'mod_cyberlab'));
        echo html_writer::tag('th', get_string('duration', 'mod_cyberlab'));
        echo html_writer::end_tag('tr');
        echo html_writer::end_tag('thead');
        echo html_writer::start_tag('tbody');

        foreach ($sessions as $session) {
            echo html_writer::start_tag('tr');
            echo html_writer::tag('td', userdate($session->started_at, get_string('strftimedatetime')));

            $statusclass = $session->status === 'terminated' ? 'text-success' :
                ($session->status === 'running' ? 'text-primary' : 'text-warning');
            echo html_writer::tag(
                'td',
                get_string('status_' . $session->status, 'mod_cyberlab'),
                ['class' => $statusclass]
            );

            $duration = '-';
            if ($session->ended_at && $session->started_at) {
                $duration = format_time($session->ended_at - $session->started_at);
            }
            echo html_writer::tag('td', $duration);

            echo html_writer::end_tag('tr');
        }

        echo html_writer::end_tag('tbody');
        echo html_writer::end_tag('table');
        echo html_writer::end_div();
        echo html_writer::end_div();
    }
}

echo $OUTPUT->footer();
