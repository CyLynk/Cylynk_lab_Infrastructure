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
 * Lab started event for CyberLab.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_cyberlab\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Lab started event class.
 */
class lab_started extends \core\event\base
{

    /**
     * Init method.
     */
    protected function init()
    {
        $this->data['objecttable'] = 'cyberlab';
        $this->data['crud'] = 'c';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
    }

    /**
     * Get event name.
     *
     * @return string
     */
    public static function get_name()
    {
        return get_string('eventlabstarted', 'mod_cyberlab');
    }

    /**
     * Get event description.
     *
     * @return string
     */
    public function get_description()
    {
        return "The user with id '{$this->userid}' started a lab session with id '{$this->other['session_id']}' " .
            "for cyberlab with id '{$this->objectid}' using template '{$this->other['template_id']}'.";
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

    /**
     * Get the mapping for other data.
     *
     * @return array
     */
    public static function get_other_mapping()
    {
        return [
            'session_id' => ['db' => 'cyberlab_sessions', 'restore' => 'session_id'],
            'template_id' => \core\event\base::NOT_MAPPED,
        ];
    }
}
