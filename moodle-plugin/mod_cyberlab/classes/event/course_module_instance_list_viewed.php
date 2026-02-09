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
 * Course module instance list viewed event for CyberLab.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_cyberlab\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Course module instance list viewed event class.
 */
class course_module_instance_list_viewed extends \core\event\course_module_instance_list_viewed
{

    /**
     * Create event from course record.
     *
     * @param \stdClass $course course object
     * @return course_module_instance_list_viewed
     */
    public static function create_from_course(\stdClass $course)
    {
        $params = [
            'context' => \context_course::instance($course->id),
        ];
        $event = self::create($params);
        $event->add_record_snapshot('course', $course);
        return $event;
    }
}
