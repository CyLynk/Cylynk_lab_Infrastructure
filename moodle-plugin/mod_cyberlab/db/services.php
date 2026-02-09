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
 * External services definition for CyberLab activity module.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$functions = [

    'mod_cyberlab_start_session' => [
        'classname' => 'mod_cyberlab\external\start_session',
        'methodname' => 'execute',
        'description' => 'Start a new lab session',
        'type' => 'write',
        'ajax' => true,
        'capabilities' => 'mod/cyberlab:attempt',
        'loginrequired' => true,
    ],

    'mod_cyberlab_terminate_session' => [
        'classname' => 'mod_cyberlab\external\terminate_session',
        'methodname' => 'execute',
        'description' => 'Terminate an active lab session',
        'type' => 'write',
        'ajax' => true,
        'capabilities' => 'mod/cyberlab:attempt',
        'loginrequired' => true,
    ],

    'mod_cyberlab_get_session_status' => [
        'classname' => 'mod_cyberlab\external\get_session_status',
        'methodname' => 'execute',
        'description' => 'Get the status of a lab session',
        'type' => 'read',
        'ajax' => true,
        'capabilities' => 'mod/cyberlab:view',
        'loginrequired' => true,
    ],

    'mod_cyberlab_get_active_session' => [
        'classname' => 'mod_cyberlab\external\get_active_session',
        'methodname' => 'execute',
        'description' => 'Get the user\'s active session for a lab if one exists',
        'type' => 'read',
        'ajax' => true,
        'capabilities' => 'mod/cyberlab:view',
        'loginrequired' => true,
    ],

    'mod_cyberlab_submit_flag' => [
        'classname' => 'mod_cyberlab\external\submit_flag',
        'methodname' => 'execute',
        'description' => 'Submit a flag for validation',
        'type' => 'write',
        'ajax' => true,
        'capabilities' => 'mod/cyberlab:submitflags',
        'loginrequired' => true,
    ],
];
