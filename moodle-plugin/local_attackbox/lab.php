<?php
/**
 * LynkBox Split-Pane Lab View
 *
 * Displays Guacamole alongside Moodle course content in a THM/HTB-style
 * split-pane interface for an immersive learning experience.
 *
 * @package    local_attackbox
 * @copyright  2025 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/adminlib.php');

require_login();

// Get parameters
$sessionId = required_param('session_id', PARAM_ALPHANUMEXT);
$guacamoleUrl = required_param('guacamole_url', PARAM_URL);
$courseid = optional_param('course_id', 0, PARAM_INT);

$context = context_system::instance();

// Set up the page with minimal layout for immersive experience
$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/local/attackbox/lab.php', [
    'session_id' => $sessionId,
    'guacamole_url' => $guacamoleUrl,
    'course_id' => $courseid,
]));
$PAGE->set_pagelayout('embedded'); // Minimal layout
$PAGE->set_title(get_string('lab:title', 'local_attackbox'));
$PAGE->set_heading(get_string('lab:title', 'local_attackbox'));

// Disable standard Moodle header/footer for full-screen experience
$PAGE->requires->css('/local/attackbox/styles/lab-view.css');

// Get plugin settings
$apiUrl = get_config('local_attackbox', 'api_url');
$pollInterval = get_config('local_attackbox', 'poll_interval') ?: 3000;

// Prepare course content if course ID is provided
$courseContent = '';
$courseTitle = '';
if ($courseid > 0) {
    try {
        $course = get_course($courseid);
        $courseTitle = $course->fullname;
        // We'll load course content via AJAX to keep the page responsive
    } catch (Exception $e) {
        // Course not found, continue without content
    }
}

// Initialize JavaScript module with configuration
$PAGE->requires->js_call_amd('local_attackbox/lab-view', 'init', [
    'sessionId' => $sessionId,
    'guacamoleUrl' => $guacamoleUrl,
    'courseId' => $courseid,
    'courseTitle' => $courseTitle,
    'userId' => $USER->id,
    'userFullname' => fullname($USER),
    'apiUrl' => $apiUrl,
    'sesskey' => sesskey(),
    'pollInterval' => (int)$pollInterval,
    'tokenEndpoint' => (new moodle_url('/local/attackbox/ajax/get_token.php'))->out(false),
    'strings' => [
        'instructions' => get_string('lab:instructions', 'local_attackbox'),
        'terminal' => get_string('lab:terminal', 'local_attackbox'),
        'fullscreen' => get_string('lab:fullscreen', 'local_attackbox'),
        'exitFullscreen' => get_string('lab:exit_fullscreen', 'local_attackbox'),
        'endSession' => get_string('button:terminate', 'local_attackbox'),
        'timeRemaining' => get_string('timer:time_remaining', 'local_attackbox'),
        'connectionLost' => get_string('lab:connection_lost', 'local_attackbox'),
        'reconnecting' => get_string('lab:reconnecting', 'local_attackbox'),
        'backToMoodle' => get_string('lab:back_to_moodle', 'local_attackbox'),
        'collapsePanel' => get_string('lab:collapse_panel', 'local_attackbox'),
        'expandPanel' => get_string('lab:expand_panel', 'local_attackbox'),
        'confirmEnd' => get_string('terminate:confirm', 'local_attackbox'),
        'sessionEnded' => get_string('terminate:success', 'local_attackbox'),
    ],
]);

// Output minimal HTML structure - JavaScript will build the UI
echo $OUTPUT->header();
?>

<div id="cyberlab-container" class="cyberlab-container">
    <!-- Header Bar -->
    <header class="cyberlab-header">
        <div class="cyberlab-header-left">
            <a href="<?php echo $CFG->wwwroot; ?>" class="cyberlab-logo" title="<?php echo get_string('lab:back_to_moodle', 'local_attackbox'); ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6"/>
                </svg>
                <span class="cyberlab-logo-text">LynkBox</span>
            </a>
            <?php if ($courseTitle): ?>
            <div class="cyberlab-course-info">
                <span class="cyberlab-separator">|</span>
                <span class="cyberlab-course-title"><?php echo htmlspecialchars($courseTitle); ?></span>
            </div>
            <?php endif; ?>
        </div>
        
        <div class="cyberlab-header-center">
            <div class="cyberlab-session-timer" id="cyberlab-timer">
                <svg class="cyberlab-timer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span class="cyberlab-timer-text" id="cyberlab-timer-text">--:--</span>
            </div>
        </div>
        
        <div class="cyberlab-header-right">
            <button id="cyberlab-fullscreen-btn" class="cyberlab-header-btn" title="<?php echo get_string('lab:fullscreen', 'local_attackbox'); ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
                </svg>
            </button>
            <button id="cyberlab-end-session-btn" class="cyberlab-header-btn cyberlab-btn-danger" title="<?php echo get_string('button:terminate', 'local_attackbox'); ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
                <span><?php echo get_string('button:terminate', 'local_attackbox'); ?></span>
            </button>
        </div>
    </header>

    <!-- Main Split-Pane Area -->
    <main class="cyberlab-main">
        <!-- Instructions Panel (Left) -->
        <aside class="cyberlab-panel cyberlab-instructions-panel" id="cyberlab-instructions-panel">
            <div class="cyberlab-panel-header">
                <h2 class="cyberlab-panel-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                    </svg>
                    <?php echo get_string('lab:instructions', 'local_attackbox'); ?>
                </h2>
                <button id="cyberlab-collapse-panel" class="cyberlab-collapse-btn" title="<?php echo get_string('lab:collapse_panel', 'local_attackbox'); ?>">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
            </div>
            
            <div class="cyberlab-panel-content" id="cyberlab-content">
                <!-- Tab Navigation -->
                <div class="cyberlab-tabs">
                    <button class="cyberlab-tab active" data-tab="instructions">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10,9 9,9 8,9"/>
                        </svg>
                        Instructions
                    </button>
                    <button class="cyberlab-tab" data-tab="tools">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                        </svg>
                        Quick Tools
                    </button>
                    <button class="cyberlab-tab" data-tab="notes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Notes
                    </button>
                </div>
                
                <!-- Tab Content: Instructions -->
                <div class="cyberlab-tab-content active" id="tab-instructions">
                    <div class="cyberlab-instructions-content">
                        <?php if ($courseid > 0): ?>
                        <div class="cyberlab-loading" id="cyberlab-course-loading">
                            <div class="cyberlab-spinner"></div>
                            <p>Loading course content...</p>
                        </div>
                        <div id="cyberlab-course-content" style="display: none;"></div>
                        <?php else: ?>
                        <div class="cyberlab-welcome">
                            <div class="cyberlab-welcome-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                    <line x1="8" y1="21" x2="16" y2="21"/>
                                    <line x1="12" y1="17" x2="12" y2="21"/>
                                    <path d="M7 8l3 3-3 3M12 14h4"/>
                                </svg>
                            </div>
                            <h3>Welcome to LynkBox</h3>
                            <p>Your Kali Linux hacking environment is ready. The terminal on the right gives you full access to:</p>
                            <ul>
                                <li><strong>Nmap</strong> - Network scanning & discovery</li>
                                <li><strong>Burp Suite</strong> - Web application testing</li>
                                <li><strong>Metasploit</strong> - Penetration testing framework</li>
                                <li><strong>Wireshark</strong> - Network protocol analysis</li>
                                <li><strong>John the Ripper</strong> - Password cracking</li>
                                <li>And many more security tools...</li>
                            </ul>
                            <div class="cyberlab-tip">
                                <strong>Pro Tip:</strong> Use the notes tab to save important findings, flags, and commands during your session.
                            </div>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
                
                <!-- Tab Content: Quick Tools -->
                <div class="cyberlab-tab-content" id="tab-tools">
                    <div class="cyberlab-tools-grid">
                        <div class="cyberlab-tool-card" data-command="nmap -sV -sC TARGET_IP">
                            <div class="cyberlab-tool-icon">🔍</div>
                            <div class="cyberlab-tool-info">
                                <h4>Nmap Scan</h4>
                                <p>Service version & script scan</p>
                            </div>
                        </div>
                        <div class="cyberlab-tool-card" data-command="gobuster dir -u http://TARGET_IP -w /usr/share/wordlists/dirb/common.txt">
                            <div class="cyberlab-tool-icon">📁</div>
                            <div class="cyberlab-tool-info">
                                <h4>Gobuster</h4>
                                <p>Directory enumeration</p>
                            </div>
                        </div>
                        <div class="cyberlab-tool-card" data-command="nikto -h http://TARGET_IP">
                            <div class="cyberlab-tool-icon">🕷️</div>
                            <div class="cyberlab-tool-info">
                                <h4>Nikto</h4>
                                <p>Web vulnerability scanner</p>
                            </div>
                        </div>
                        <div class="cyberlab-tool-card" data-command="sqlmap -u 'http://TARGET_IP/page?id=1' --dbs">
                            <div class="cyberlab-tool-icon">💉</div>
                            <div class="cyberlab-tool-info">
                                <h4>SQLMap</h4>
                                <p>SQL injection testing</p>
                            </div>
                        </div>
                        <div class="cyberlab-tool-card" data-command="hydra -l admin -P /usr/share/wordlists/rockyou.txt TARGET_IP ssh">
                            <div class="cyberlab-tool-icon">🔓</div>
                            <div class="cyberlab-tool-info">
                                <h4>Hydra</h4>
                                <p>Brute force attack</p>
                            </div>
                        </div>
                        <div class="cyberlab-tool-card" data-command="msfconsole">
                            <div class="cyberlab-tool-icon">⚔️</div>
                            <div class="cyberlab-tool-info">
                                <h4>Metasploit</h4>
                                <p>Launch Metasploit Framework</p>
                            </div>
                        </div>
                    </div>
                    <div class="cyberlab-tools-tip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 16v-4M12 8h.01"/>
                        </svg>
                        <p>Click a tool card to copy the command. Replace <code>TARGET_IP</code> with your target address.</p>
                    </div>
                </div>
                
                <!-- Tab Content: Notes -->
                <div class="cyberlab-tab-content" id="tab-notes">
                    <div class="cyberlab-notes-container">
                        <textarea id="cyberlab-notes" class="cyberlab-notes-textarea" placeholder="Take notes here... Your notes are saved locally in your browser.

Example:
# Target: 10.10.10.1
## Open Ports
- 22/tcp SSH
- 80/tcp HTTP
- 443/tcp HTTPS

## Findings
- Found admin panel at /admin
- SQL injection in login form

## Flags
- user.txt: 
- root.txt: 
"></textarea>
                        <div class="cyberlab-notes-footer">
                            <span class="cyberlab-notes-status" id="cyberlab-notes-status">Saved</span>
                            <button id="cyberlab-notes-copy" class="cyberlab-notes-btn" title="Copy all notes">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                </svg>
                                Copy
                            </button>
                            <button id="cyberlab-notes-clear" class="cyberlab-notes-btn cyberlab-notes-btn-danger" title="Clear all notes">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"/>
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                </svg>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
        
        <!-- Resizer -->
        <div class="cyberlab-resizer" id="cyberlab-resizer">
            <div class="cyberlab-resizer-handle"></div>
        </div>
        
        <!-- Collapsed Panel Button (shown when panel is collapsed) -->
        <button id="cyberlab-expand-panel" class="cyberlab-expand-btn" style="display: none;" title="<?php echo get_string('lab:expand_panel', 'local_attackbox'); ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        </button>
        
        <!-- Terminal Panel (Right) - Guacamole iframe -->
        <section class="cyberlab-panel cyberlab-terminal-panel" id="cyberlab-terminal-panel">
            <div class="cyberlab-terminal-container">
                <iframe 
                    id="cyberlab-guacamole-frame"
                    class="cyberlab-guacamole-frame"
                    src="<?php echo htmlspecialchars($guacamoleUrl); ?>"
                    allow="clipboard-read; clipboard-write; fullscreen"
                    allowfullscreen>
                </iframe>
                
                <!-- Connection Status Overlay -->
                <div class="cyberlab-connection-status" id="cyberlab-connection-status" style="display: none;">
                    <div class="cyberlab-connection-content">
                        <div class="cyberlab-spinner"></div>
                        <p id="cyberlab-connection-message"><?php echo get_string('lab:reconnecting', 'local_attackbox'); ?></p>
                    </div>
                </div>
            </div>
        </section>
    </main>
</div>

<?php
echo $OUTPUT->footer();
