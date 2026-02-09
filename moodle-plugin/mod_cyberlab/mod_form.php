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
 * Activity module form definition for CyberLab.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * Module instance settings form.
 */
class mod_cyberlab_mod_form extends moodleform_mod
{

    /**
     * Define the form elements.
     */
    public function definition()
    {
        global $CFG;

        $mform = $this->_form;

        // -------------------------------------------------------------------------
        // General section.
        // -------------------------------------------------------------------------
        $mform->addElement('header', 'general', get_string('general', 'form'));

        // Activity name.
        $mform->addElement('text', 'name', get_string('labname', 'mod_cyberlab'), ['size' => '64']);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');
        $mform->addRule('name', get_string('maximumchars', '', 255), 'maxlength', 255, 'client');

        // Activity description (intro).
        $this->standard_intro_elements();

        // -------------------------------------------------------------------------
        // Lab Configuration section.
        // -------------------------------------------------------------------------
        $mform->addElement('header', 'labconfig', get_string('labconfiguration', 'mod_cyberlab'));

        // Lab template selection.
        $templates = cyberlab_get_available_templates();
        $templateoptions = ['' => get_string('selecttemplate', 'mod_cyberlab')] + $templates;
        $mform->addElement('select', 'template_id', get_string('labtemplate', 'mod_cyberlab'), $templateoptions);
        $mform->addRule('template_id', null, 'required', null, 'client');
        $mform->addHelpButton('template_id', 'labtemplate', 'mod_cyberlab');

        // Difficulty level.
        $difficulties = [
            'beginner' => get_string('difficulty_beginner', 'mod_cyberlab'),
            'intermediate' => get_string('difficulty_intermediate', 'mod_cyberlab'),
            'advanced' => get_string('difficulty_advanced', 'mod_cyberlab'),
            'expert' => get_string('difficulty_expert', 'mod_cyberlab'),
        ];
        $mform->addElement('select', 'difficulty', get_string('difficulty', 'mod_cyberlab'), $difficulties);
        $mform->setDefault('difficulty', 'beginner');

        // Session duration (hours).
        $durationoptions = [];
        for ($i = 1; $i <= 8; $i++) {
            $durationoptions[$i] = get_string('nhours', 'mod_cyberlab', $i);
        }
        $mform->addElement('select', 'duration_hours', get_string('sessionduration', 'mod_cyberlab'), $durationoptions);
        $mform->setDefault('duration_hours', 2);
        $mform->addHelpButton('duration_hours', 'sessionduration', 'mod_cyberlab');

        // Max attempts (0 = unlimited).
        $attemptoptions = [0 => get_string('unlimited', 'mod_cyberlab')];
        for ($i = 1; $i <= 10; $i++) {
            $attemptoptions[$i] = $i;
        }
        $mform->addElement('select', 'max_attempts', get_string('maxattempts', 'mod_cyberlab'), $attemptoptions);
        $mform->setDefault('max_attempts', 0);
        $mform->addHelpButton('max_attempts', 'maxattempts', 'mod_cyberlab');

        // -------------------------------------------------------------------------
        // Connection Methods section.
        // -------------------------------------------------------------------------
        $mform->addElement('header', 'connectionmethods', get_string('connectionmethods', 'mod_cyberlab'));

        // LynkBox (Browser-based via Guacamole).
        $mform->addElement(
            'advcheckbox',
            'connection_lynkbox',
            get_string('connection_lynkbox', 'mod_cyberlab'),
            get_string('connection_lynkbox_desc', 'mod_cyberlab')
        );
        $mform->setDefault('connection_lynkbox', 1);

        // Tailscale VPN.
        $mform->addElement(
            'advcheckbox',
            'connection_tailscale',
            get_string('connection_tailscale', 'mod_cyberlab'),
            get_string('connection_tailscale_desc', 'mod_cyberlab')
        );
        $mform->setDefault('connection_tailscale', 0);

        // OpenVPN.
        $mform->addElement(
            'advcheckbox',
            'connection_openvpn',
            get_string('connection_openvpn', 'mod_cyberlab'),
            get_string('connection_openvpn_desc', 'mod_cyberlab')
        );
        $mform->setDefault('connection_openvpn', 0);

        // -------------------------------------------------------------------------
        // Lab Instructions section.
        // -------------------------------------------------------------------------
        $mform->addElement('header', 'labinstructions', get_string('labinstructions', 'mod_cyberlab'));

        // Objectives.
        $mform->addElement(
            'textarea',
            'objectives',
            get_string('objectives', 'mod_cyberlab'),
            ['rows' => 4, 'cols' => 60]
        );
        $mform->setType('objectives', PARAM_TEXT);
        $mform->addHelpButton('objectives', 'objectives', 'mod_cyberlab');

        // Hints (optional).
        $mform->addElement(
            'textarea',
            'hints',
            get_string('hints', 'mod_cyberlab'),
            ['rows' => 4, 'cols' => 60]
        );
        $mform->setType('hints', PARAM_TEXT);

        // Flag format (for CTF-style labs).
        $mform->addElement('text', 'flag_format', get_string('flagformat', 'mod_cyberlab'), ['size' => '40']);
        $mform->setType('flag_format', PARAM_TEXT);
        $mform->setDefault('flag_format', 'FLAG{...}');
        $mform->addHelpButton('flag_format', 'flagformat', 'mod_cyberlab');

        // Expected flags (JSON array for validation).
        $mform->addElement(
            'textarea',
            'expected_flags',
            get_string('expectedflags', 'mod_cyberlab'),
            ['rows' => 3, 'cols' => 60]
        );
        $mform->setType('expected_flags', PARAM_RAW);
        $mform->addHelpButton('expectedflags', 'expectedflags', 'mod_cyberlab');

        // -------------------------------------------------------------------------
        // Standard course module elements.
        // -------------------------------------------------------------------------
        $this->standard_coursemodule_elements();

        // Action buttons.
        $this->add_action_buttons();
    }

    /**
     * Pre-process form data.
     *
     * @param array $defaultvalues Form defaults
     */
    public function data_preprocessing(&$defaultvalues)
    {
        parent::data_preprocessing($defaultvalues);

        // Decode connection methods from JSON.
        if (isset($defaultvalues['connection_methods'])) {
            $methods = json_decode($defaultvalues['connection_methods'], true);
            if (is_array($methods)) {
                $defaultvalues['connection_lynkbox'] = in_array('lynkbox', $methods) ? 1 : 0;
                $defaultvalues['connection_tailscale'] = in_array('tailscale', $methods) ? 1 : 0;
                $defaultvalues['connection_openvpn'] = in_array('openvpn', $methods) ? 1 : 0;
            }
        }
    }

    /**
     * Custom validation.
     *
     * @param array $data Form data
     * @param array $files Uploaded files
     * @return array Errors
     */
    public function validation($data, $files)
    {
        $errors = parent::validation($data, $files);

        // At least one connection method must be selected.
        if (
            empty($data['connection_lynkbox']) &&
            empty($data['connection_tailscale']) &&
            empty($data['connection_openvpn'])
        ) {
            $errors['connection_lynkbox'] = get_string('error_noconnectionmethod', 'mod_cyberlab');
        }

        // Validate expected flags JSON if provided.
        if (!empty($data['expected_flags'])) {
            $flags = json_decode($data['expected_flags']);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $errors['expected_flags'] = get_string('error_invalidflagsjson', 'mod_cyberlab');
            }
        }

        return $errors;
    }
}
