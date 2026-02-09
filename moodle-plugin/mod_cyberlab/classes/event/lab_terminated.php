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
 * Lab terminated event for CyberLab.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_cyberlab\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Lab terminated event class.
 */
class lab_terminated extends \core\event\base
{

    /**
     * Init method.
     */
    protected function init()
    {
        $this->data['objecttable'] = 'cyberlab';
        $this->data['crud'] = 'u';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
    }

    /**
     * Get event name.
     *
     * @return string
     */
    public static function get_name()
    {
        return get_string('eventlabterminated', 'mod_cyberlab');
    }

    /**
     * Get event description.
     *
     * @return string
     */
    public function get_description()
    {
        return "The user with id '{$this->userid}' terminated lab session with id '{$this->other['session_id']}' " .
            "for cyberlab with id '{$this->objectid}'.";
    }

    /**
     * Get URL related to the action.
     *
     * @return \moodle_url
     */
    public function get_url()
    {
        return new \moodle_url('/mod/cyberlab/view.php', ['id' => $this->contextinstanceid]);
    }

    /**
     * Get the mapping for legacy log data.
     *
     * @return array
     */
    public static function get_objectid_mapping()
    {
        return ['db' => 'cyberlab', 'restore' => 'cyberlab'];
    }
}
