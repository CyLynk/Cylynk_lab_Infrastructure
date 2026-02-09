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
 * Index page listing all CyberLab activities in a course.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT); // Course ID.

$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);

require_login($course);

$context = context_course::instance($course->id);

// Log course module index viewed event.
$event = \mod_cyberlab\event\course_module_instance_list_viewed::create([
    'context' => $context,
]);
$event->trigger();

// Set up page.
$PAGE->set_url('/mod/cyberlab/index.php', ['id' => $id]);
$PAGE->set_title(format_string($course->fullname));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('modulenameplural', 'mod_cyberlab'));

// Get all cyberlabs in this course.
if (!$cyberlabs = get_all_instances_in_course('cyberlab', $course)) {
    notice(get_string('nocyberlabs', 'mod_cyberlab'), new moodle_url('/course/view.php', ['id' => $course->id]));
    die;
}

// Build table.
$usesections = course_format_uses_sections($course->format);

$table = new html_table();
$table->attributes['class'] = 'generaltable mod_index';

if ($usesections) {
    $table->head = [
        get_string('sectionname', 'format_' . $course->format),
        get_string('name'),
        get_string('difficulty', 'mod_cyberlab'),
        get_string('duration', 'mod_cyberlab'),
    ];
    $table->align = ['center', 'left', 'center', 'center'];
} else {
    $table->head = [
        get_string('name'),
        get_string('difficulty', 'mod_cyberlab'),
        get_string('duration', 'mod_cyberlab'),
    ];
    $table->align = ['left', 'center', 'center'];
}

$currentsection = '';
foreach ($cyberlabs as $cyberlab) {
    $cm = get_coursemodule_from_instance('cyberlab', $cyberlab->id, $course->id, false, MUST_EXIST);

    if ($usesections) {
        $printsection = '';
        if ($cyberlab->section !== $currentsection) {
            if ($cyberlab->section) {
                $printsection = get_section_name($course, $cyberlab->section);
            }
            if ($currentsection !== '') {
                $table->data[] = 'hr';
            }
            $currentsection = $cyberlab->section;
        }
    }

    // Build name link.
    $class = '';
    if (!$cyberlab->visible) {
        $class = 'dimmed';
    }
    $link = html_writer::link(
        new moodle_url('/mod/cyberlab/view.php', ['id' => $cm->id]),
        format_string($cyberlab->name),
        ['class' => $class]
    );

    // Difficulty badge.
    $difficultyclass = 'badge badge-' . $cyberlab->difficulty;
    $difficulty = html_writer::tag(
        'span',
        get_string('difficulty_' . $cyberlab->difficulty, 'mod_cyberlab'),
        ['class' => $difficultyclass]
    );

    // Duration.
    $duration = get_string('nhours', 'mod_cyberlab', $cyberlab->duration_hours);

    if ($usesections) {
        $table->data[] = [$printsection, $link, $difficulty, $duration];
    } else {
        $table->data[] = [$link, $difficulty, $duration];
    }
}

echo html_writer::table($table);

echo $OUTPUT->footer();
