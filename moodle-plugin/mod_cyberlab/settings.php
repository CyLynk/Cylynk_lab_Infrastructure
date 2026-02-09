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
 * Settings for CyberLab activity module.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

// Ensure the settings object is available.
if ($hassiteconfig && $ADMIN->fulltree) {
    // API Configuration section.
    $settings->add(new admin_setting_heading(
        'mod_cyberlab/apiconfig',
        get_string('settings_apiconfig', 'mod_cyberlab'),
        get_string('settings_apiconfig_desc', 'mod_cyberlab')
    ));

    // API URL.
    $settings->add(new admin_setting_configtext(
        'mod_cyberlab/api_url',
        get_string('settings_apiurl', 'mod_cyberlab'),
        get_string('settings_apiurl_desc', 'mod_cyberlab'),
        '',
        PARAM_URL
    ));

    // Webhook Secret.
    $settings->add(new admin_setting_configpasswordunmask(
        'mod_cyberlab/webhook_secret',
        get_string('settings_webhooksecret', 'mod_cyberlab'),
        get_string('settings_webhooksecret_desc', 'mod_cyberlab'),
        ''
    ));

    // Lab Configuration section.
    $settings->add(new admin_setting_heading(
        'mod_cyberlab/labconfig',
        get_string('settings_labconfig', 'mod_cyberlab'),
        get_string('settings_labconfig_desc', 'mod_cyberlab')
    ));

    // Default session duration.
    $settings->add(new admin_setting_configselect(
        'mod_cyberlab/default_duration',
        get_string('settings_defaultduration', 'mod_cyberlab'),
        get_string('settings_defaultduration_desc', 'mod_cyberlab'),
        2,
        [
            1 => get_string('nhours', 'mod_cyberlab', 1),
            2 => get_string('nhours', 'mod_cyberlab', 2),
            3 => get_string('nhours', 'mod_cyberlab', 3),
            4 => get_string('nhours', 'mod_cyberlab', 4),
            6 => get_string('nhours', 'mod_cyberlab', 6),
            8 => get_string('nhours', 'mod_cyberlab', 8),
        ]
    ));

    // Max concurrent sessions per user.
    $settings->add(new admin_setting_configtext(
        'mod_cyberlab/max_concurrent_sessions',
        get_string('settings_maxconcurrent', 'mod_cyberlab'),
        get_string('settings_maxconcurrent_desc', 'mod_cyberlab'),
        1,
        PARAM_INT
    ));

    // Connection methods section.
    $settings->add(new admin_setting_heading(
        'mod_cyberlab/connectionconfig',
        get_string('settings_connectionconfig', 'mod_cyberlab'),
        get_string('settings_connectionconfig_desc', 'mod_cyberlab')
    ));

    // Enable LynkBox connection.
    $settings->add(new admin_setting_configcheckbox(
        'mod_cyberlab/enable_lynkbox',
        get_string('settings_enablelynkbox', 'mod_cyberlab'),
        get_string('settings_enablelynkbox_desc', 'mod_cyberlab'),
        1
    ));

    // Enable Tailscale VPN.
    $settings->add(new admin_setting_configcheckbox(
        'mod_cyberlab/enable_tailscale',
        get_string('settings_enabletailscale', 'mod_cyberlab'),
        get_string('settings_enabletailscale_desc', 'mod_cyberlab'),
        0
    ));

    // Enable OpenVPN.
    $settings->add(new admin_setting_configcheckbox(
        'mod_cyberlab/enable_openvpn',
        get_string('settings_enableopenvpn', 'mod_cyberlab'),
        get_string('settings_enableopenvpn_desc', 'mod_cyberlab'),
        0
    ));
}
