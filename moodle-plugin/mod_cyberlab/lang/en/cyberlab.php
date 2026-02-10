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
 * English language strings for CyberLab activity module.
 *
 * @package    mod_cyberlab
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

// Module name and general.
$string['modulename'] = 'CyberLab';
$string['modulenameplural'] = 'CyberLabs';
$string['modulename_help'] = 'The CyberLab activity enables students to practice cybersecurity skills in isolated virtual lab environments. Students launch target VMs and attack them from their LynkBox (Kali Linux) environment.';
$string['pluginname'] = 'CyberLab';
$string['pluginadministration'] = 'CyberLab administration';

// Form fields.
$string['labname'] = 'Lab name';
$string['labconfiguration'] = 'Lab Configuration';
$string['labtemplate'] = 'Lab template';
$string['labtemplate_help'] = 'Select the pre-configured lab environment to deploy. Each template defines the target VM image, services, and vulnerabilities.';
$string['selecttemplate'] = 'Select a lab template...';
$string['difficulty'] = 'Difficulty level';
$string['difficulty_beginner'] = 'Beginner';
$string['difficulty_intermediate'] = 'Intermediate';
$string['difficulty_advanced'] = 'Advanced';
$string['difficulty_expert'] = 'Expert';
$string['sessionduration'] = 'Session duration';
$string['sessionduration_help'] = 'Maximum time a student\'s lab session can run before automatic termination.';
$string['nhours'] = '{$a} hour(s)';
$string['maxattempts'] = 'Maximum attempts';
$string['maxattempts_help'] = 'Maximum number of times a student can start this lab. Set to 0 for unlimited attempts.';
$string['unlimited'] = 'Unlimited';

// Connection methods.
$string['connectionmethods'] = 'Connection Methods';
$string['connection_lynkbox'] = 'LynkBox (Browser)';
$string['connection_lynkbox_desc'] = 'Connect via browser-based Kali Linux environment (recommended)';
$string['connection_tailscale'] = 'Tailscale VPN';
$string['connection_tailscale_desc'] = 'Connect using Tailscale mesh VPN from your own machine';
$string['connection_openvpn'] = 'OpenVPN';
$string['connection_openvpn_desc'] = 'Download OpenVPN configuration to connect from your own machine';
$string['downloadvpnconfig'] = 'Download VPN Configuration';

// Lab instructions.
$string['labinstructions'] = 'Lab Instructions';
$string['objectives'] = 'Objectives';
$string['objectives_help'] = 'List the learning objectives or tasks students should complete in this lab.';
$string['hints'] = 'Hints';
$string['showhints'] = 'Show hints';
$string['flagformat'] = 'Flag format';
$string['flagformat_help'] = 'The expected format for capture-the-flag style submissions (e.g., FLAG{...} or CTF{...}).';
$string['expectedflags'] = 'Expected flags';
$string['expectedflags_help'] = 'JSON array of correct flag values for automatic validation. Example: ["FLAG{sql_injection_success}", "FLAG{privilege_escalated}"]';

// View page.
$string['labsession'] = 'Lab Session';
$string['nosessionstarted'] = 'No active session. Click "Start Lab" to begin.';
$string['targetinfo'] = 'Target Information';
$string['targetip'] = 'Target IP';
$string['copy'] = 'Copy';
$string['copyip'] = 'Copy IP address';
$string['startlab'] = 'Start Lab';
$string['terminatelab'] = 'Terminate Lab';
$string['openlynkbox'] = 'Open LynkBox';
$string['launchinglab'] = 'Launching lab environment...';
$string['duration'] = 'Duration';

// Session history.
$string['sessionhistory'] = 'Session History';
$string['date'] = 'Date';
$string['status'] = 'Status';
$string['sessionid'] = 'Session ID';
$string['startedat'] = 'Started at';
$string['numsessions'] = '{$a} session(s)';
$string['nosessions'] = 'No sessions yet';
$string['inprogress'] = 'In progress';

// Session statuses.
$string['status_pending'] = 'Pending';
$string['status_launching'] = 'Launching';
$string['status_running'] = 'Running';
$string['status_terminated'] = 'Terminated';
$string['status_error'] = 'Error';

// Capabilities.
$string['cyberlab:view'] = 'View CyberLab activity';
$string['cyberlab:attempt'] = 'Start lab sessions';
$string['cyberlab:submitflags'] = 'Submit flags for validation';
$string['cyberlab:viewreports'] = 'View student reports';
$string['cyberlab:manage'] = 'Manage CyberLab instances';
$string['cyberlab:terminatesessions'] = 'Terminate student sessions';
$string['cyberlab:addinstance'] = 'Add new CyberLab';

// Errors.
$string['error_noconnectionmethod'] = 'At least one connection method must be selected.';
$string['error_invalidflagsjson'] = 'Invalid JSON format for expected flags.';
$string['error_launchfailed'] = 'Failed to launch lab. Please try again.';
$string['error_maxattempts'] = 'You have reached the maximum number of attempts for this lab.';
$string['error_activesession'] = 'You already have an active session for this lab.';
$string['error_apinotconfigured'] = 'API not configured. Please ask your administrator to configure CyberLab settings (Site Admin → Plugins → Activity modules → CyberLab).';

// Events.
$string['eventlabstarted'] = 'Lab session started';
$string['eventlabterminated'] = 'Lab session terminated';
$string['eventflagsubmitted'] = 'Flag submitted';
$string['eventcoursemoduleviewed'] = 'CyberLab activity viewed';

// Reports.
$string['report'] = 'Report';
$string['allsessions'] = 'All sessions';
$string['studentsessions'] = 'Student sessions';
$string['activesessions'] = 'Active sessions';
$string['totalsessions'] = 'Total sessions';
$string['averageduration'] = 'Average duration';
$string['completionrate'] = 'Completion rate';

// Miscellaneous.
$string['timeleft'] = 'Time remaining';
$string['labready'] = 'Lab is ready! Your target IP is shown above.';
$string['labpreparing'] = 'Preparing lab environment...';
$string['confirmterminate'] = 'Are you sure you want to terminate this lab session? Any unsaved progress will be lost.';
$string['sessionterminated'] = 'Lab session has been terminated.';
$string['ipcopied'] = 'IP address copied to clipboard!';
$string['nocyberlabs'] = 'No CyberLab activities in this course.';

// Settings page.
$string['settings_apiconfig'] = 'API Configuration';
$string['settings_apiconfig_desc'] = 'Configure the connection to the CyberLab orchestrator API.';
$string['settings_apiurl'] = 'API URL';
$string['settings_apiurl_desc'] = 'The base URL of the CyberLab orchestrator API (e.g., https://xxxxx.execute-api.us-west-2.amazonaws.com). Get this from your Terraform output: <code>terraform output api_endpoint</code>';
$string['settings_webhooksecret'] = 'Webhook Secret';
$string['settings_webhooksecret_desc'] = 'The shared secret for authenticating API requests. This should match the <code>moodle_webhook_secret</code> value in your Terraform configuration.';
$string['settings_labconfig'] = 'Lab Configuration';
$string['settings_labconfig_desc'] = 'Default settings for lab sessions.';
$string['settings_defaultduration'] = 'Default session duration';
$string['settings_defaultduration_desc'] = 'Default duration for lab sessions when creating new CyberLab activities.';
$string['settings_maxconcurrent'] = 'Max concurrent sessions';
$string['settings_maxconcurrent_desc'] = 'Maximum number of concurrent lab sessions a user can have across all CyberLab activities.';
$string['settings_connectionconfig'] = 'Connection Methods';
$string['settings_connectionconfig_desc'] = 'Enable or disable connection methods available to students.';
$string['settings_enablelynkbox'] = 'Enable LynkBox';
$string['settings_enablelynkbox_desc'] = 'Allow students to connect to labs via the browser-based LynkBox (Kali Linux) environment.';
$string['settings_enabletailscale'] = 'Enable Tailscale VPN';
$string['settings_enabletailscale_desc'] = 'Allow students to connect using Tailscale mesh VPN from their own machines.';
$string['settings_enableopenvpn'] = 'Enable OpenVPN';
$string['settings_enableopenvpn_desc'] = 'Allow students to download OpenVPN configuration files to connect from their own machines.';

