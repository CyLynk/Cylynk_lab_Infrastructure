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
 * AttackBox Launcher AMD Module
 *
 * Renders a floating button and handles the session creation flow
 * with a cyberpunk-style loading overlay.
 *
 * @module     local_attackbox/launcher
 * @copyright  2024 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define(["jquery", "core/str"], function ($, Str) {
  "use strict";

  /**
   * Progress messages mapped to percentage thresholds.
   */
  const PROGRESS_THRESHOLDS = [5, 10, 18, 25, 33, 42, 50, 62, 70, 85, 94, 100];

  /**
   * String keys needed for the UI.
   */
  const STRING_KEYS = [
    { key: "button:launch", component: "local_attackbox" },
    { key: "button:active", component: "local_attackbox" },
    { key: "button:terminate", component: "local_attackbox" },
    { key: "button:tooltip", component: "local_attackbox" },
    { key: "button:tooltip_active", component: "local_attackbox" },
    { key: "button:usage_dashboard", component: "local_attackbox" },
    { key: "timer:time_remaining", component: "local_attackbox" },
    { key: "overlay:title", component: "local_attackbox" },
    { key: "overlay:subtitle", component: "local_attackbox" },
    { key: "overlay:cancel", component: "local_attackbox" },
    { key: "error:title", component: "local_attackbox" },
    { key: "error:retry", component: "local_attackbox" },
    { key: "error:close", component: "local_attackbox" },
    { key: "success:title", component: "local_attackbox" },
    { key: "success:message", component: "local_attackbox" },
    { key: "success:open", component: "local_attackbox" },
    { key: "terminate:confirm", component: "local_attackbox" },
    { key: "terminate:success", component: "local_attackbox" },
    { key: "terminate:error", component: "local_attackbox" },
    { key: "idle:warning_title", component: "local_attackbox" },
    { key: "idle:warning_message", component: "local_attackbox" },
    { key: "idle:critical_message", component: "local_attackbox" },
    { key: "idle:keep_active", component: "local_attackbox" },
    { key: "idle:focus_mode", component: "local_attackbox" },
    { key: "progress:5", component: "local_attackbox" },
    { key: "progress:10", component: "local_attackbox" },
    { key: "progress:18", component: "local_attackbox" },
    { key: "progress:25", component: "local_attackbox" },
    { key: "progress:33", component: "local_attackbox" },
    { key: "progress:42", component: "local_attackbox" },
    { key: "progress:50", component: "local_attackbox" },
    { key: "progress:62", component: "local_attackbox" },
    { key: "progress:70", component: "local_attackbox" },
    { key: "progress:85", component: "local_attackbox" },
    { key: "progress:94", component: "local_attackbox" },
    { key: "progress:100", component: "local_attackbox" },
  ];

  /**
   * Heartbeat configuration
   */
  const HEARTBEAT_INTERVAL = 30000; // Send heartbeat every 30 seconds
  const IDLE_CHECK_INTERVAL = 10000; // Check idle state every 10 seconds

  /**
   * Launcher class
   */
  class AttackBoxLauncher {
    /**
     * Constructor
     * @param {Object} config Configuration object
     * @param {Object} strings Loaded strings
     */
    constructor(config, strings) {
      this.config = config;
      this.strings = strings;
      this.sessionId = null;
      this.pollTimer = null;
      this.isLaunching = false;
      this.hasActiveSession = false;
      this.activeSessionUrl = null;
      this.lastQuotaWarning = null; // Track last warning level shown
      this.currentUsageData = null; // Store latest usage data
      this.sessionExpiresAt = null; // Track when session expires
      this.timerInterval = null; // Timer update interval
      this.eduInterval = null; // Educational content rotation interval
      this.currentEduIndex = 0; // Current educational tip index
      this.currentAttackIndex = 0; // Current attack type index

      // Idle detection state
      this.heartbeatInterval = null; // Heartbeat sending interval
      this.idleCheckInterval = null; // Idle state check interval
      this.lastUserActivity = Date.now(); // Last user interaction timestamp
      this.isTabVisible = !document.hidden; // Track tab visibility
      this.focusMode = false; // User opted out of idle termination
      this.idleWarningShown = false; // Track if warning is currently shown
      this.idleThresholds = null; // Idle thresholds from API

      // Educational content data
      this.eduContent = [
        "The average cost of a data breach in 2024 is $4.45 million. Proper security testing can prevent most breaches.",
        "90% of cyberattacks start with a phishing email. Always verify sender addresses and suspicious links.",
        "SQL Injection is still the #1 web application vulnerability. Always use parameterized queries.",
        "Cross-Site Scripting (XSS) affects 75% of web applications. Sanitize all user input!",
        "Weak passwords are responsible for 81% of data breaches. Use strong, unique passwords for every account.",
        "Regular security updates close 95% of known vulnerabilities. Keep your systems patched!",
        "Two-Factor Authentication (2FA) blocks 99.9% of automated attacks. Enable it everywhere possible.",
        "The average time to detect a breach is 207 days. Continuous monitoring is essential.",
        "Over 30,000 websites are hacked daily. Regular security audits are your best defense.",
        "Port scanning is the first step in 80% of attacks. Understanding reconnaissance helps you defend better.",
        "Nmap (Network Mapper) is used to discover hosts and services on a network. It's essential for penetration testing.",
        "Metasploit Framework contains over 2,000 exploits. Ethical hackers use it to test system security.",
        "Burp Suite intercepts HTTP traffic to find web application vulnerabilities before attackers do.",
        "The OWASP Top 10 lists the most critical web application security risks. Learn them to secure your apps.",
        "DNS tunneling can exfiltrate data slowly. Monitor unusual DNS query patterns in your network.",
        "Privilege escalation is how attackers gain admin access. Always follow the principle of least privilege.",
      ];

      this.attackTypes = [
        { name: "SQL Injection", icon: "&#128137;", color: "#ff5722" },
        { name: "XSS Attack", icon: "&#9889;", color: "#ff9800" },
        { name: "Phishing", icon: "&#127907;", color: "#f44336" },
        { name: "Port Scan", icon: "&#128269;", color: "#00bcd4" },
        { name: "Brute Force", icon: "&#128296;", color: "#9c27b0" },
        { name: "Man-in-Middle", icon: "&#128065;", color: "#673ab7" },
        { name: "DoS Attack", icon: "&#128165;", color: "#e91e63" },
        { name: "Buffer Overflow", icon: "&#128230;", color: "#ff5722" },
      ];

      this.init();
    }

    /**
     * Initialize the launcher
     */
    init() {
      // Check if we're running inside an embedded iframe (split-pane left panel)
      const urlParams = new URLSearchParams(window.location.search);
      const isEmbedded = urlParams.get("lynkbox_embedded") === "1";

      // Also check if we're inside an iframe
      const isInIframe = window.self !== window.top;

      if (
        isEmbedded ||
        (isInIframe && window.name === "lynkbox-moodle-frame")
      ) {
        console.log("[LynkBox] Running in embedded mode - launcher disabled");
        // Don't show launcher in embedded mode, but keep the page functional
        return;
      }

      this.createButton();
      this.createOverlay();
      this.createNotificationBanner();
      this.createIdleWarningModal();
      this.createUsageDashboardLink();
      this.createModal();
      this.bindEvents();
      this.bindIdleDetectionEvents();
      this.updateUsageDisplay();

      // Restore minimised state from localStorage
      if (localStorage.getItem("lynkbox-launcher-minimised") === "true") {
        this.$launcher.addClass("minimised");
        this.$restoreButton.show();
      }

      // Check and restore split-pane state (for page refresh persistence)
      this.checkAndRestoreSplitPane();

      // Check for existing session after a short delay to ensure all is initialized
      setTimeout(() => {
        this.checkExistingSession().catch((err) => {
          console.log("Could not check for existing session:", err);
        });
      }, 100);

      // Update usage display every 30 seconds
      setInterval(() => this.updateUsageDisplay(), 30000);
    }

    /**
     * Create idle warning modal
     */
    createIdleWarningModal() {
      const html = `
        <div id="attackbox-idle-warning" class="attackbox-idle-warning" style="display: none;">
          <div class="attackbox-idle-warning-content">
            <div class="attackbox-idle-warning-header">
              <div class="attackbox-idle-warning-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div class="attackbox-idle-warning-info">
                <h4 class="attackbox-idle-warning-title">${
                  this.strings.idleWarningTitle || "Session Idle"
                }</h4>
                <p id="attackbox-idle-warning-message" class="attackbox-idle-warning-message">
                  ${
                    this.strings.idleWarningMessage ||
                    "Your session will be terminated in"
                  } <strong id="attackbox-idle-countdown-time" class="attackbox-idle-countdown-time">--:--</strong>
                </p>
              </div>
              <button id="attackbox-idle-close" class="attackbox-idle-close" type="button" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="attackbox-idle-warning-actions">
              <button id="attackbox-idle-keep-active" class="attackbox-btn-keep-active" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                ${this.strings.idleKeepActive || "I'm Active"}
              </button>
              <button id="attackbox-idle-focus-mode" class="attackbox-btn-focus-mode" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                </svg>
                ${this.strings.idleFocusMode || "Focus Mode"}
              </button>
            </div>
          </div>
        </div>
      `;
      $("body").append(html);
      this.$idleWarning = $("#attackbox-idle-warning");
      this.$idleCountdown = $("#attackbox-idle-countdown-time");
      this.$idleMessage = $("#attackbox-idle-warning-message");

      // Bind close button
      $("#attackbox-idle-close").on("click", () => this.hideIdleWarning());
    }

    /**
     * Bind idle detection events (tab visibility, user activity)
     */
    bindIdleDetectionEvents() {
      const self = this;

      // Track tab visibility
      document.addEventListener("visibilitychange", function () {
        self.isTabVisible = !document.hidden;
        if (self.isTabVisible) {
          // Tab became visible, user is likely active
          self.recordUserActivity();
        }
      });

      // Track user activity on the page
      const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
      activityEvents.forEach((eventType) => {
        document.addEventListener(
          eventType,
          function () {
            self.recordUserActivity();
          },
          { passive: true }
        );
      });

      // Idle warning button handlers
      $("#attackbox-idle-keep-active").on("click", function (e) {
        e.preventDefault();
        self.keepSessionActive();
      });

      $("#attackbox-idle-focus-mode").on("click", function (e) {
        e.preventDefault();
        self.enableFocusMode();
      });
    }

    /**
     * Record user activity timestamp
     * Note: Does NOT auto-hide the idle warning - user must click a button
     */
    recordUserActivity() {
      this.lastUserActivity = Date.now();
      // Idle warning requires explicit button click to dismiss
      // This prevents accidental dismissal from mouse movements
    }

    /**
     * Start heartbeat sending for active session
     */
    startHeartbeat() {
      if (this.heartbeatInterval) {
        return; // Already running
      }

      console.log("Starting session heartbeat");

      // Send initial heartbeat
      this.sendHeartbeat();

      // Send heartbeats at regular intervals
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, HEARTBEAT_INTERVAL);

      // Check idle state more frequently
      this.idleCheckInterval = setInterval(() => {
        this.checkLocalIdleState();
      }, IDLE_CHECK_INTERVAL);
    }

    /**
     * Stop heartbeat sending
     */
    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      if (this.idleCheckInterval) {
        clearInterval(this.idleCheckInterval);
        this.idleCheckInterval = null;
      }
      this.hideIdleWarning();
    }

    /**
     * Send heartbeat to the API
     */
    async sendHeartbeat() {
      if (!this.sessionId || !this.hasActiveSession) {
        return;
      }

      try {
        const tokenData = await this.getToken();

        const response = await fetch(
          tokenData.api_url + "/sessions/" + this.sessionId + "/heartbeat",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Moodle-Token": tokenData.token,
              Accept: "application/json",
            },
            body: JSON.stringify({
              activity_type: "browser",
              tab_visible: this.isTabVisible,
              focus_mode: this.focusMode,
            }),
          }
        );

        if (!response.ok) {
          console.warn("Heartbeat failed:", response.status);
          return;
        }

        const data = await response.json();

        if (data.success && data.data) {
          this.handleHeartbeatResponse(data.data);
        }
      } catch (error) {
        console.warn("Error sending heartbeat:", error);
      }
    }

    /**
     * Handle heartbeat response from API
     */
    handleHeartbeatResponse(data) {
      // Store thresholds for local idle checking
      this.idleThresholds = {
        warning: data.idle_warning_threshold,
        termination: data.idle_termination_threshold,
      };

      // Check if session was terminated
      if (data.status === "terminated") {
        this.handleSessionTerminated("idle_timeout");
        return;
      }

      // Handle idle warning states
      if (data.idle_critical) {
        this.showIdleWarning(data, "critical");
      } else if (data.idle_warning) {
        this.showIdleWarning(data, "warning");
      } else {
        this.hideIdleWarning();
      }

      // Update focus mode state from server
      if (data.focus_mode !== this.focusMode) {
        this.focusMode = data.focus_mode;
      }
    }

    /**
     * Check local idle state (between heartbeats)
     */
    checkLocalIdleState() {
      if (!this.hasActiveSession || this.focusMode) {
        return;
      }

      const idleSeconds = (Date.now() - this.lastUserActivity) / 1000;

      // Use local thresholds if available, otherwise use defaults
      const warningThreshold = this.idleThresholds?.warning || 900;

      if (idleSeconds >= warningThreshold && !this.idleWarningShown) {
        // Show local warning - actual termination is server-side
        this.showIdleWarning(
          {
            idle_seconds: idleSeconds,
            time_until_termination:
              (this.idleThresholds?.termination || 1800) - idleSeconds,
          },
          "warning"
        );
      }
    }

    /**
     * Show idle warning modal
     */
    showIdleWarning(data, level) {
      if (this.focusMode) {
        return; // Don't show warning in focus mode
      }

      const timeUntilTermination = Math.max(
        0,
        data.time_until_termination || 0
      );
      const minutes = Math.floor(timeUntilTermination / 60);
      const seconds = Math.floor(timeUntilTermination % 60);

      // Update countdown display
      this.$idleCountdown.text(
        `${minutes}:${seconds.toString().padStart(2, "0")}`
      );

      // Update message based on level
      if (level === "critical") {
        this.$idleWarning.addClass("idle-critical").removeClass("idle-warning");
        this.$idleMessage.html(
          this.strings.idleCriticalMessage ||
            "<strong>Critical:</strong> Your session will be terminated very soon due to inactivity!"
        );
      } else {
        this.$idleWarning.addClass("idle-warning").removeClass("idle-critical");
        this.$idleMessage.html(
          this.strings.idleWarningMessage ||
            "Your session has been idle. It will be automatically terminated to save resources."
        );
      }

      // Show modal if not already visible
      if (!this.idleWarningShown) {
        this.$idleWarning.fadeIn(300);
        this.idleWarningShown = true;

        // Play alert sound (if supported)
        this.playIdleAlertSound();
      }
    }

    /**
     * Hide idle warning modal
     */
    hideIdleWarning() {
      if (this.idleWarningShown) {
        this.$idleWarning.fadeOut(300);
        this.idleWarningShown = false;
      }
    }

    /**
     * Keep session active (dismiss warning and send activity signal)
     */
    async keepSessionActive() {
      this.recordUserActivity();
      this.hideIdleWarning();

      // Send immediate heartbeat to reset server-side idle timer
      await this.sendHeartbeat();
    }

    /**
     * Enable focus mode (disable idle termination)
     */
    async enableFocusMode() {
      this.focusMode = true;
      this.hideIdleWarning();

      // Send heartbeat with focus mode enabled
      await this.sendHeartbeat();

      // Show confirmation
      this.showAlert(
        "Focus mode enabled. Idle termination is now disabled for this session.",
        "Focus Mode",
        "success"
      );
    }

    /**
     * Handle session terminated by server
     */
    handleSessionTerminated(reason) {
      this.stopHeartbeat();
      this.stopSessionTimer();

      this.sessionId = null;
      this.hasActiveSession = false;
      this.activeSessionUrl = null;

      // Close split-pane view if open (returns to normal Moodle view)
      this.closeSplitPane();

      // Reset UI
      this.$button.removeClass("attackbox-btn-active");
      this.$button.find(".attackbox-btn-text").text(this.strings.buttonText);
      this.$button.attr("title", this.strings.buttonTooltip);
      this.$terminateButton.hide();

      // Show message to user
      if (reason === "idle_timeout") {
        this.showAlert(
          "Your session was terminated due to inactivity. You can launch a new session when needed.",
          "Session Ended",
          "warning"
        );
      }
    }

    /**
     * Play alert sound for idle warning
     */
    playIdleAlertSound() {
      try {
        // Create a simple beep using Web Audio API
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = "sine";
        gainNode.gain.value = 0.1;

        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 200);
      } catch (e) {
        // Audio not supported, ignore
      }
    }

    /**
     * Check for existing session on page load
     */
    async checkExistingSession() {
      try {
        const tokenData = await this.getToken();
        // Use the correct endpoint: GET /students/{studentId}/sessions
        const response = await fetch(
          tokenData.api_url + "/students/" + this.config.userId + "/sessions",
          {
            method: "GET",
            headers: {
              "X-Moodle-Token": tokenData.token,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          // No existing session or error - keep default state
          return;
        }

        const data = await response.json();

        // Check if there are any active sessions
        if (
          data.data &&
          data.data.active_sessions &&
          data.data.active_sessions.length > 0
        ) {
          // Get the first active session
          const session = data.data.active_sessions[0];

          // Found an active session - update UI without showing overlay
          this.sessionId = session.session_id;
          this.hasActiveSession = true;

          // Get connection URL - try multiple locations
          this.activeSessionUrl =
            session?.connection_info?.direct_url ||
            session?.connection_info?.guacamole_connection_url ||
            session?.connection_info?.guacamole_url ||
            session?.direct_url ||
            session?.guacamole_url ||
            session?.url ||
            session?.connection_url ||
            null;

          console.log("Session found on page load:", {
            sessionId: this.sessionId,
            status: session.status,
            hasUrl: !!this.activeSessionUrl,
            session: session,
          });

          // Check if session is ready with URL
          if (this.activeSessionUrl) {
            // Session is ready - update UI immediately
            this.$button.addClass("attackbox-btn-active");
            this.$button
              .find(".attackbox-btn-text")
              .text(this.strings.buttonTextActive);
            this.$button.attr("title", this.strings.buttonTooltipActive);

            // Show terminate button
            this.$terminateButton.show();
            console.log("Terminate button shown");

            // Start timer if expires_at available
            if (session.expires_at) {
              this.startSessionTimer(session.expires_at);
            }

            // Start heartbeat for idle detection
            this.startHeartbeat();

            console.log("Existing session restored:", this.sessionId);
          } else if (
            session.status === "provisioning" ||
            session.status === "pending"
          ) {
            // Session exists but not ready yet - start polling to complete the launch
            console.log(
              "Session found but still provisioning, resuming polling..."
            );
            this.isLaunching = true;
            this.showOverlay();

            // Start polling to monitor session progress
            this.startPolling(tokenData.api_url);
          } else {
            // Session exists but in unexpected state
            console.warn(
              "Session found in unexpected state:",
              session.status,
              session
            );
          }
        }
      } catch (error) {
        console.log("No existing session found or error checking:", error);
        // Keep default state - no session
      }
    }

    /**
     * Create the floating button
     */
    createButton() {
      const position = this.config.buttonPosition || "bottom-right";
      const positionClasses = {
        "bottom-right": "attackbox-btn-bottom-right",
        "bottom-left": "attackbox-btn-bottom-left",
        "top-right": "attackbox-btn-top-right",
        "top-left": "attackbox-btn-top-left",
      };

      const html = `
                <div id="attackbox-launcher" class="attackbox-launcher ${positionClasses[position]}">
                    <div id="attackbox-usage-badge" class="attackbox-usage-badge" style="display: none;">
                        <span class="attackbox-usage-text"></span>
                    </div>
                    <button id="attackbox-btn" class="attackbox-btn" type="button" title="${this.strings.buttonTooltip}">
                        <span class="attackbox-btn-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                <line x1="8" y1="21" x2="16" y2="21"></line>
                                <line x1="12" y1="17" x2="12" y2="21"></line>
                                <path d="M7 8l3 3-3 3M12 14h4"></path>
                            </svg>
                        </span>
                        <span class="attackbox-btn-text">${this.strings.buttonText}</span>
                        <span class="attackbox-btn-pulse"></span>
                    </button>
                    <button id="attackbox-terminate-btn" class="attackbox-btn-terminate" type="button" title="${this.strings.buttonTerminate}" style="display: none;">
                        <span class="attackbox-btn-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                        </span>
                        <span class="attackbox-btn-text">${this.strings.buttonTerminate}</span>
                    </button>
                    <button id="attackbox-minimize-btn" class="attackbox-btn-minimize" type="button" title="Minimise launcher">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <button id="attackbox-restore-btn" class="attackbox-btn-restore ${positionClasses[position]}" type="button" title="Show LynkBox launcher" style="display: none;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <path d="M7 8l3 3-3 3"></path>
                    </svg>
                </button>
            `;

      $("body").append(html);
      this.$button = $("#attackbox-btn");
      this.$terminateButton = $("#attackbox-terminate-btn");
      this.$minimizeButton = $("#attackbox-minimize-btn");
      this.$restoreButton = $("#attackbox-restore-btn");
      this.$launcher = $("#attackbox-launcher");
      this.$timerBadge = $("#attackbox-timer-badge");
      this.$timerText = $("#attackbox-timer-text");
    }

    /**
     * Create notification banner for quota warnings
     */
    createNotificationBanner() {
      const html = `
        <div id="attackbox-quota-notification" class="attackbox-quota-notification" style="display: none;">
          <div class="attackbox-notification-content">
            <span class="attackbox-notification-icon">&#9888;&#65039;</span>
            <span id="attackbox-notification-message" class="attackbox-notification-message"></span>
            <button id="attackbox-notification-close" class="attackbox-notification-close" type="button">×</button>
          </div>
        </div>
      `;
      $("body").append(html);
      this.$notification = $("#attackbox-quota-notification");
      this.$notificationMessage = $("#attackbox-notification-message");

      // Close button handler
      $("#attackbox-notification-close").on("click", () => {
        this.$notification.fadeOut(300);
      });
    }

    /**
     * Create usage dashboard link
     */
    createUsageDashboardLink() {
      const html = `
        <a href="${M.cfg.wwwroot}/local/attackbox/usage.php" 
           id="attackbox-usage-link" 
           class="attackbox-usage-link" 
           title="${this.strings.buttonUsageDashboard}"
           target="_blank">
          <span class="attackbox-usage-link-icon">&#128202;</span>
          <span class="attackbox-usage-link-text">Usage</span>
        </a>
      `;
      this.$launcher.append(html);
    }

    /**
     * Create the custom modal dialog (replaces native alert/confirm)
     */
    createModal() {
      const html = `
        <div id="lynkbox-modal-overlay" class="lynkbox-modal-overlay" style="display: none;">
          <div class="lynkbox-modal">
            <div class="lynkbox-modal-header">
              <div class="lynkbox-modal-icon" id="lynkbox-modal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 class="lynkbox-modal-title" id="lynkbox-modal-title">Confirm</h3>
            </div>
            <div class="lynkbox-modal-body">
              <p class="lynkbox-modal-message" id="lynkbox-modal-message"></p>
            </div>
            <div class="lynkbox-modal-footer" id="lynkbox-modal-footer">
              <button id="lynkbox-modal-cancel" class="lynkbox-modal-btn lynkbox-modal-btn-secondary">Cancel</button>
              <button id="lynkbox-modal-confirm" class="lynkbox-modal-btn lynkbox-modal-btn-primary">Confirm</button>
            </div>
          </div>
        </div>
      `;
      $("body").append(html);
      this.$modal = $("#lynkbox-modal-overlay");
      this.$modalTitle = $("#lynkbox-modal-title");
      this.$modalMessage = $("#lynkbox-modal-message");
      this.$modalIcon = $("#lynkbox-modal-icon");
      this.$modalFooter = $("#lynkbox-modal-footer");
    }

    /**
     * Show a custom alert modal (replaces native alert)
     * @param {string} message - The message to display
     * @param {string} title - Optional title (default: "Notice")
     * @param {string} type - Optional type: "info", "success", "warning", "error" (default: "info")
     * @returns {Promise} Resolves when user clicks OK
     */
    showAlert(message, title = "Notice", type = "info") {
      return new Promise((resolve) => {
        this.$modalTitle.text(title);
        this.$modalMessage.html(message);

        // Set icon based on type
        this.setModalIcon(type);

        // Show only OK button for alerts
        this.$modalFooter.html(`
          <button id="lynkbox-modal-ok" class="lynkbox-modal-btn lynkbox-modal-btn-primary">OK</button>
        `);

        // Bind OK button
        $("#lynkbox-modal-ok")
          .off("click")
          .on("click", () => {
            this.$modal.fadeOut(200);
            resolve();
          });

        // Show modal
        this.$modal.fadeIn(200);

        // Focus OK button
        setTimeout(() => $("#lynkbox-modal-ok").focus(), 100);
      });
    }

    /**
     * Show a custom confirm modal (replaces native confirm)
     * @param {string} message - The message to display
     * @param {string} title - Optional title (default: "Confirm")
     * @param {object} options - Optional: { confirmText, cancelText, type }
     * @returns {Promise<boolean>} Resolves with true (confirm) or false (cancel)
     */
    showConfirm(message, title = "Confirm", options = {}) {
      return new Promise((resolve) => {
        const confirmText = options.confirmText || "Yes";
        const cancelText = options.cancelText || "Cancel";
        const type = options.type || "warning";

        this.$modalTitle.text(title);
        this.$modalMessage.html(message);

        // Set icon based on type
        this.setModalIcon(type);

        // Show confirm/cancel buttons
        this.$modalFooter.html(`
          <button id="lynkbox-modal-cancel" class="lynkbox-modal-btn lynkbox-modal-btn-secondary">${cancelText}</button>
          <button id="lynkbox-modal-confirm" class="lynkbox-modal-btn lynkbox-modal-btn-primary">${confirmText}</button>
        `);

        // Bind buttons
        $("#lynkbox-modal-cancel")
          .off("click")
          .on("click", () => {
            this.$modal.fadeOut(200);
            resolve(false);
          });

        $("#lynkbox-modal-confirm")
          .off("click")
          .on("click", () => {
            this.$modal.fadeOut(200);
            resolve(true);
          });

        // Show modal
        this.$modal.fadeIn(200);

        // Focus confirm button
        setTimeout(() => $("#lynkbox-modal-confirm").focus(), 100);
      });
    }

    /**
     * Set the modal icon based on type
     * @param {string} type - "info", "success", "warning", "error"
     */
    setModalIcon(type) {
      const icons = {
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>`,
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                   <polyline points="22 4 12 14.01 9 11.01"/>
                 </svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                   <line x1="12" y1="9" x2="12" y2="13"/>
                   <line x1="12" y1="17" x2="12.01" y2="17"/>
                 </svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <circle cx="12" cy="12" r="10"/>
                 <line x1="15" y1="9" x2="9" y2="15"/>
                 <line x1="9" y1="9" x2="15" y2="15"/>
               </svg>`,
      };

      this.$modalIcon.html(icons[type] || icons.info);
      this.$modal
        .find(".lynkbox-modal")
        .removeClass("modal-info modal-success modal-warning modal-error")
        .addClass(`modal-${type}`);
    }

    /**
     * Minimise the launcher (hide buttons, show small restore button)
     */
    minimiseLauncher() {
      this.$launcher.addClass("minimised");
      this.$restoreButton.fadeIn(200);
      // Save preference
      localStorage.setItem("lynkbox-launcher-minimised", "true");
    }

    /**
     * Restore the launcher from minimised state
     */
    restoreLauncher() {
      this.$launcher.removeClass("minimised");
      this.$restoreButton.fadeOut(200);
      // Save preference
      localStorage.setItem("lynkbox-launcher-minimised", "false");
    }

    /**
     * Create the fullscreen overlay - Modern compact cyber design
     */
    createOverlay() {
      const html = `
                <div id="attackbox-overlay" class="attackbox-overlay" style="display: none;">
                    <div class="attackbox-overlay-backdrop"></div>
                    <div class="attackbox-overlay-content">
                        <!-- Decorative cyber elements -->
                        <div class="attackbox-cyber-corner attackbox-cyber-corner-tl"></div>
                        <div class="attackbox-cyber-corner attackbox-cyber-corner-tr"></div>
                        <div class="attackbox-cyber-corner attackbox-cyber-corner-bl"></div>
                        <div class="attackbox-cyber-corner attackbox-cyber-corner-br"></div>
                        
                        <!-- Header with animated logo -->
                        <div class="attackbox-overlay-header">
                            <div class="attackbox-overlay-logo">
                                <div class="attackbox-logo-ring"></div>
                                <div class="attackbox-logo-ring attackbox-logo-ring-2"></div>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="attackbox-logo-icon">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                    <path d="M7 8l3 3-3 3"/>
                                    <line x1="12" y1="14" x2="17" y2="14"/>
                                </svg>
                            </div>
                            <div class="attackbox-overlay-titles">
                                <h1 class="attackbox-overlay-title">${this.strings.overlayTitle}</h1>
                                <p class="attackbox-overlay-subtitle">${this.strings.overlaySubtitle}</p>
                            </div>
                        </div>

                        <!-- Progress section -->
                        <div class="attackbox-progress-section">
                            <div class="attackbox-progress-bar">
                                <div class="attackbox-progress-track">
                                    <div class="attackbox-progress-fill" id="attackbox-progress-fill"></div>
                                </div>
                                <span class="attackbox-progress-percent" id="attackbox-progress-percent">0%</span>
                            </div>
                            <span id="attackbox-time-estimate" class="attackbox-time-estimate"></span>
                        </div>

                        <!-- Terminal output -->
                        <div class="attackbox-terminal-mini">
                            <div class="attackbox-terminal-header">
                                <div class="attackbox-terminal-dots">
                                    <span></span><span></span><span></span>
                                </div>
                                <span class="attackbox-terminal-title">terminal</span>
                            </div>
                            <div class="attackbox-terminal-output">
                                <span class="attackbox-terminal-prompt">$</span>
                                <span id="attackbox-status-message" class="attackbox-status-message"></span>
                                <span class="attackbox-cursor"></span>
                            </div>
                        </div>

                        <!-- Tip section - compact -->
                        <div class="attackbox-tip-section">
                            <span class="attackbox-tip-icon">💡</span>
                            <div class="attackbox-tip-content">
                                <span class="attackbox-tip-label">Did you know?</span>
                                <span id="attackbox-edu-text" class="attackbox-tip-text">Loading security tools...</span>
                            </div>
                        </div>

                        <!-- Cancel button -->
                        <button id="attackbox-cancel" class="attackbox-btn-cancel" type="button">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            ${this.strings.cancelButton}
                        </button>
                    </div>

                    <!-- Success state -->
                    <div id="attackbox-success" class="attackbox-success-container" style="display: none;">
                        <div class="attackbox-state-icon attackbox-state-success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                        <h2 class="attackbox-state-title">${this.strings.successTitle}</h2>
                        <p class="attackbox-state-message">${this.strings.successMessage}</p>
                        <button id="attackbox-open" class="attackbox-btn-primary" type="button">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2"/>
                                <path d="M7 8l3 3-3 3"/>
                            </svg>
                            ${this.strings.successOpen}
                        </button>
                    </div>

                    <!-- Error state -->
                    <div id="attackbox-error" class="attackbox-error-container" style="display: none;">
                        <div class="attackbox-state-icon attackbox-state-error">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                        </div>
                        <h2 class="attackbox-state-title attackbox-state-title-error">${this.strings.errorTitle}</h2>
                        <p id="attackbox-error-message" class="attackbox-state-message"></p>
                        <div class="attackbox-state-actions">
                            <button id="attackbox-retry" class="attackbox-btn-primary" type="button">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="23 4 23 10 17 10"/>
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                </svg>
                                ${this.strings.errorRetry}
                            </button>
                            <button id="attackbox-close-error" class="attackbox-btn-secondary" type="button">
                                ${this.strings.errorClose}
                            </button>
                        </div>
                    </div>
                </div>
            `;

      $("body").append(html);
      this.$overlay = $("#attackbox-overlay");
      this.$progressFill = $("#attackbox-progress-fill");
      this.$progressPercent = $("#attackbox-progress-percent");
      this.$timeEstimate = $("#attackbox-time-estimate");
      this.$statusMessage = $("#attackbox-status-message");
      this.$successContainer = $("#attackbox-success");
      this.$errorContainer = $("#attackbox-error");
      this.$overlayContent = this.$overlay.find(".attackbox-overlay-content");
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
      const self = this;

      this.$button.on("click", function (e) {
        e.preventDefault();
        // If we already have an active session with URL, open lab view directly
        if (self.hasActiveSession && self.activeSessionUrl && self.sessionId) {
          self.openLabView();
          return;
        }
        // Otherwise launch a new session - the API will return existing session with fresh URL
        // This handles the case where user logged out of Guacamole (token invalidated)
        // but the session is still "active" in the backend
        self.launch();
      });

      this.$terminateButton.on("click", function (e) {
        e.preventDefault();
        self.terminateSession();
      });

      $("#attackbox-cancel").on("click", function (e) {
        e.preventDefault();
        self.cancel();
      });

      $("#attackbox-retry").on("click", function (e) {
        e.preventDefault();
        self.hideError();
        self.launch();
      });

      $("#attackbox-close-error").on("click", function (e) {
        e.preventDefault();
        self.hideOverlay();
      });

      $("#attackbox-open").on("click", function (e) {
        e.preventDefault();
        if (self.activeSessionUrl) {
          self.openLabView();
        }
        self.hideOverlay();
      });

      // ESC key to cancel
      $(document).on("keydown.attackbox", function (e) {
        if (e.key === "Escape" && self.$overlay.is(":visible")) {
          self.cancel();
        }
      });

      // Minimise/restore launcher buttons
      this.$minimizeButton.on("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.minimiseLauncher();
      });

      this.$restoreButton.on("click", function (e) {
        e.preventDefault();
        self.restoreLauncher();
      });
    }

    /**
     * Launch the AttackBox
     */
    async launch() {
      if (this.isLaunching) {
        return;
      }

      // Check quota before launching
      const quotaOk = await this.checkQuotaBeforeLaunch();
      if (!quotaOk) {
        return;
      }

      this.isLaunching = true;

      // Initialize progress bar before showing overlay to prevent visual glitch
      const $progressFill = $("#attackbox-progress-fill");
      const $progressPercent = $("#attackbox-progress-percent");
      const $timeEstimate = $("#attackbox-time-estimate");
      const $statusMessage = $("#attackbox-status-message");

      if ($progressFill.length) {
        $progressFill.css("width", "0%");
      }
      if ($progressPercent.length) {
        $progressPercent.text("0%");
      }
      if ($timeEstimate.length) {
        $timeEstimate.hide().text("");
      }
      if ($statusMessage.length) {
        $statusMessage.html('<span class="attackbox-cursor">▋</span>');
      }

      this.showOverlay();

      // Small delay to ensure DOM is ready and CSS transitions work properly
      await new Promise((resolve) => setTimeout(resolve, 50));

      this.updateProgress(0, this.strings.progress5);

      try {
        // Step 1: Get token from Moodle
        this.updateProgress(5, this.strings.progress5);
        const tokenData = await this.getToken();

        // Step 2: Create session
        this.updateProgress(10, this.strings.progress10);
        const sessionData = await this.createSession(
          tokenData.token,
          tokenData.api_url
        );

        // API returns { success, message, data, timestamp }
        const session = sessionData.data || sessionData.body || sessionData;

        if (!session || !session.session_id) {
          throw new Error(sessionData.message || "Invalid response from API");
        }

        this.sessionId = session.session_id;

        // Check session status regardless of whether it was reused
        if (session.status === "ready" || session.status === "active") {
          // Session is ready to use
          if (session.reused) {
            this.handleExistingSession(session);
          } else {
            this.handleReady(session);
          }
        } else {
          // Session is still provisioning - start polling
          if (session.reused) {
            this.updateProgress(
              25,
              "Waiting for existing session to be ready..."
            );
          }
          this.startPolling(tokenData.api_url);
        }
      } catch (error) {
        console.error("LynkBox launch error:", error);
        this.showError(error.message || "Failed to launch LynkBox");
      }
    }

    /**
     * Get authentication token from Moodle
     */
    async getToken() {
      const response = await fetch(
        this.config.tokenEndpoint + "?sesskey=" + this.config.sesskey,
        {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get authentication token");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Token generation failed");
      }

      return data;
    }

    /**
     * Create a session via the orchestrator API
     */
    async createSession(token, apiUrl) {
      const response = await fetch(apiUrl + "/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Moodle-Token": token,
        },
        body: JSON.stringify({
          student_id: String(this.config.userId),
          student_name: this.config.userFullname,
          metadata: {
            source: "moodle_attackbox_plugin",
            page_url: window.location.href,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("API error response:", errorData);

        // Handle quota exceeded error (403)
        // Check errorData.details (Lambda response structure)
        const quotaData = errorData.details || errorData.data || errorData;
        if (response.status === 403 && quotaData.error === "quota_exceeded") {
          const hoursUsed =
            Math.round((quotaData.consumed_minutes / 60) * 10) / 10;
          const hoursLimit =
            Math.round((quotaData.quota_minutes / 60) * 10) / 10;
          const resetDate = new Date(quotaData.resets_at).toLocaleDateString();

          throw new Error(
            `Monthly usage limit reached!<br><br>` +
              `<strong>Plan:</strong> ${quotaData.plan || "Freemium"}<br>` +
              `<strong>Used:</strong> ${hoursUsed}h / ${hoursLimit}h<br><br>` +
              `Your quota resets on <strong>${resetDate}</strong>.<br><br>` +
              `<a href="/local/attackbox/upgrade.php" style="color: #00ff88; text-decoration: underline;">Upgrade your plan</a> for more hours.`
          );
        }

        throw new Error(
          errorData.error ||
            errorData.message ||
            `API error: ${response.status}`
        );
      }

      return await response.json();
    }

    /**
     * Start polling for session status
     */
    startPolling(apiUrl) {
      const self = this;
      const pollInterval = this.config.pollInterval || 3000;
      let attempts = 0;
      const maxAttempts = 200; // 10 minutes max (ASG scale-up + status checks can take 5-7 min)

      console.log("Starting polling for session status");

      this.pollTimer = setInterval(async function () {
        attempts++;

        if (attempts > maxAttempts) {
          self.stopPolling();
          self.showError("Session creation timed out. Please try again.");
          return;
        }

        try {
          const response = await fetch(apiUrl + "/sessions/" + self.sessionId, {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error("Failed to get session status");
          }

          const data = await response.json();
          // API returns { success, message, data, timestamp }
          const session = data.data || data.body || data;

          if (!session || !session.session_id) {
            return;
          }

          // Update progress based on API response with more detailed status info
          let progress;
          let message;
          let timeEstimate;

          // Use API-provided stage info if available (includes health check details)
          if (session.stage_message && session.progress) {
            progress = session.progress;
            message = session.stage_message;
            timeEstimate = self.getTimeEstimate(session, progress);

            // Log detailed info when waiting for health checks
            if (session.stage === "waiting_health") {
              console.log("Health check progress:", {
                progress: progress,
                message: message,
                health_checks: session.health_checks,
                timeEstimate: timeEstimate,
              });
            }
          } else if (session.provisioning_stage === "waiting_health_checks") {
            // Fallback: Instance is running but waiting for health checks (2/2)
            const healthInfo = session.health_checks || {};
            const systemStatus = healthInfo.system_status || "unknown";
            const instanceStatus = healthInfo.instance_status || "unknown";

            progress = 85;
            message = `Instance running, verifying readiness... (System: ${systemStatus}, Instance: ${instanceStatus})`;
            timeEstimate = self.getTimeEstimate(session, progress);

            // Log for debugging
            console.log("Waiting for health checks:", healthInfo);
          } else {
            // Use standard progress estimation
            progress =
              session.progress ||
              self.estimateProgress(session.status, attempts);
            message = self.getProgressMessage(progress);
            timeEstimate = self.getTimeEstimate(session, progress);

            // Add instance state info if available
            if (session.instance_state) {
              if (session.instance_state === "pending") {
                message = "Starting instance from warm pool...";
                progress = Math.min(progress, 60);
                timeEstimate = self.getTimeEstimate(session, progress);
              } else if (
                session.instance_state === "running" &&
                session.status === "provisioning"
              ) {
                message = "Instance running, initializing services...";
                progress = Math.max(progress, 75);
                timeEstimate = self.getTimeEstimate(session, progress);
              }
            }
          }

          self.updateProgress(progress, message, timeEstimate);

          if (session.status === "ready" || session.status === "active") {
            self.stopPolling();
            self.handleReady(session);
          } else if (
            session.status === "error" ||
            session.status === "terminated"
          ) {
            self.stopPolling();
            self.showError(session.error || "Session failed to start");
          }
        } catch (error) {
          console.error("Polling error:", error);
          // Continue polling on transient errors
        }
      }, pollInterval);
    }

    /**
     * Stop polling
     */
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    }

    /**
     * Estimate progress based on status when API doesn't return it
     */
    estimateProgress(status, attempts) {
      const baseProgress = {
        pending: 10,
        provisioning: 25,
        ready: 100,
        active: 100,
      };

      let progress = baseProgress[status] || 10;

      // Add some progress based on time
      if (status === "provisioning") {
        progress = Math.min(94, 25 + attempts * 2);
      }

      return progress;
    }

    /**
     * Get progress message for a given percentage
     */
    getProgressMessage(progress) {
      // Find the highest threshold that progress meets or exceeds
      const thresholds = PROGRESS_THRESHOLDS.slice().sort((a, b) => b - a);

      for (const threshold of thresholds) {
        if (progress >= threshold) {
          const key = "progress" + threshold;
          return this.strings[key] || "Processing...";
        }
      }

      return this.strings.progress5 || "Initializing...";
    }

    /**
     * Handle existing session
     */
    handleExistingSession(session) {
      this.isLaunching = false;
      this.hasActiveSession = true;

      console.log("Full session object:", session);

      // Verify session is actually ready
      if (session.status !== "ready" && session.status !== "active") {
        console.warn("Session not ready yet, status:", session.status);
        this.showError(
          `Session is ${session.status}. Please wait a moment and try again.`
        );
        return;
      }

      // Try multiple possible URL locations
      this.activeSessionUrl =
        session?.connection_info?.direct_url ||
        session?.connection_info?.guacamole_connection_url ||
        session?.direct_url ||
        session?.guacamole_url ||
        session?.url ||
        session?.connection_url ||
        null;

      console.log("Existing session found, URL:", this.activeSessionUrl);

      if (this.activeSessionUrl) {
        this.updateProgress(100, this.strings.progress100);

        // Update button state
        this.$button.addClass("attackbox-btn-active");
        this.$button
          .find(".attackbox-btn-text")
          .text(this.strings.buttonTextActive);
        this.$button.attr("title", this.strings.buttonTooltipActive);
        this.$terminateButton.show();

        // Start session timer if expires_at available
        if (session.expires_at) {
          this.startSessionTimer(session.expires_at);
        }

        // Start heartbeat for idle detection
        this.startHeartbeat();

        setTimeout(() => {
          this.showSuccess();
        }, 500);
      } else {
        console.error("No connection URL in session:", session);
        console.error("Available keys:", Object.keys(session));
        this.showError(
          "Session found but no connection URL available. Please check CloudWatch logs or try terminating and creating a new session."
        );
      }
    }

    /**
     * Handle ready state
     */
    handleReady(session) {
      this.isLaunching = false;
      this.hasActiveSession = true;

      console.log("Full session object (ready):", session);

      // Try multiple possible URL locations
      this.activeSessionUrl =
        session?.connection_info?.direct_url ||
        session?.connection_info?.guacamole_connection_url ||
        session?.direct_url ||
        session?.guacamole_url ||
        session?.url ||
        session?.connection_url ||
        null;

      console.log("LynkBox ready, URL:", this.activeSessionUrl);

      if (this.activeSessionUrl) {
        this.updateProgress(100, this.strings.progress100);

        // Update button state
        this.$button.addClass("attackbox-btn-active");
        this.$button
          .find(".attackbox-btn-text")
          .text(this.strings.buttonTextActive);
        this.$button.attr("title", this.strings.buttonTooltipActive);
        this.$terminateButton.show();

        // Start session timer if expires_at available
        if (session.expires_at) {
          this.startSessionTimer(session.expires_at);
        }

        // Start heartbeat for idle detection
        this.startHeartbeat();

        // Show success then open window
        setTimeout(() => {
          this.showSuccess();
        }, 500);
      } else {
        console.error("No connection URL in session:", session);
        console.error("Available keys:", Object.keys(session));
        this.showError(
          "LynkBox is ready but no connection URL available. Please check CloudWatch logs or contact support."
        );
      }
    }

    /**
     * Update progress display
     */
    updateProgress(percent, message, timeEstimate) {
      // Use direct DOM query to ensure elements are found
      const $fill = $("#attackbox-progress-fill");
      const $percent = $("#attackbox-progress-percent");

      if ($fill.length) {
        $fill.css("width", percent + "%");
      }
      if ($percent.length) {
        $percent.text(percent + "%");
      }

      // Also update instance references if they exist
      if (this.$progressFill && this.$progressFill.length) {
        this.$progressFill.css("width", percent + "%");
      }
      if (this.$progressPercent && this.$progressPercent.length) {
        this.$progressPercent.text(percent + "%");
      }

      console.log("[LynkBox] Progress updated:", percent + "%", message);

      if (message) {
        this.typeMessage(message);
      }

      // Update time estimate if provided
      if (timeEstimate) {
        this.updateTimeEstimate(timeEstimate);
      }
    }

    /**
     * Update time estimate display
     */
    updateTimeEstimate(estimate) {
      const $timeEstimate = $("#attackbox-time-estimate");
      if (estimate) {
        $timeEstimate.text(estimate).fadeIn(200);
      } else {
        $timeEstimate.fadeOut(200);
      }
    }

    /**
     * Calculate time estimate based on session stage and progress
     */
    getTimeEstimate(session, progress) {
      if (!session) return null;

      const status = session.status;
      const stage = session.stage || session.provisioning_stage;

      // Ready or active - no estimate needed
      if (status === "ready" || status === "active") {
        return null;
      }

      // Pending stage - quick
      if (status === "pending") {
        return "⏱ ~5-15 seconds";
      }

      // Provisioning stage - varies by sub-stage
      if (status === "provisioning") {
        // Check for specific provisioning stages
        if (
          stage === "instance_starting" ||
          session.stage_message?.includes("Starting")
        ) {
          // Warm pool instance starting
          if (progress < 40) {
            return "⏱ ~30-60 seconds";
          } else {
            return "⏱ ~20-40 seconds";
          }
        } else if (
          stage === "waiting_health" ||
          stage === "waiting_health_checks"
        ) {
          // Health checks phase
          const healthChecks = session.health_checks || {};
          const systemStatus = healthChecks.system_status;
          const instanceStatus = healthChecks.instance_status;

          if (systemStatus === "passed" && instanceStatus === "passed") {
            return "⏱ ~5-10 seconds";
          } else if (
            systemStatus === "initializing" ||
            instanceStatus === "initializing"
          ) {
            return "⏱ ~60-120 seconds";
          } else {
            return "⏱ ~30-90 seconds";
          }
        } else if (stage === "allocating" || progress < 15) {
          // Just allocated, starting provisioning
          return "⏱ ~1-3 minutes";
        } else if (progress >= 85) {
          // Almost done
          return "⏱ ~10-20 seconds";
        } else {
          // General provisioning
          return "⏱ ~1-2 minutes";
        }
      }

      // Default fallback
      return "⏱ ~1-2 minutes";
    }

    /**
     * Type out a message with typewriter effect
     */
    typeMessage(message) {
      const $container = this.$statusMessage;
      $container.html(
        '<span class="attackbox-typed"></span><span class="attackbox-cursor">▋</span>'
      );

      const $typed = $container.find(".attackbox-typed");
      let index = 0;

      const type = () => {
        if (index < message.length) {
          $typed.text($typed.text() + message[index]);
          index++;
          setTimeout(type, 20);
        }
      };

      type();
    }

    /**
     * Show the overlay
     */
    showOverlay() {
      this.$overlay.fadeIn(300);
      this.$overlayContent.show();
      this.$successContainer.hide();
      this.$errorContainer.hide();
      $("body").addClass("attackbox-overlay-open");
      this.startEducationalContent();
    }

    /**
     * Hide the overlay
     */
    hideOverlay() {
      this.$overlay.fadeOut(300);
      $("body").removeClass("attackbox-overlay-open");
      this.isLaunching = false;
      this.stopEducationalContent();
    }

    /**
     * Show success state
     */
    showSuccess() {
      this.$overlayContent.fadeOut(200, () => {
        this.$successContainer.fadeIn(200);
      });
    }

    /**
     * Show error state
     */
    /**
     * Update usage display badge
     */
    async updateUsageDisplay() {
      try {
        const response = await fetch(
          M.cfg.wwwroot +
            "/local/attackbox/ajax/get_usage.php?sesskey=" +
            this.config.sesskey,
          {
            method: "GET",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          console.warn("Failed to fetch usage data");
          return;
        }

        const data = await response.json();

        if (!data.success) {
          console.warn("Usage data error:", data.message);
          return;
        }

        // Store current usage data
        this.currentUsageData = data;

        // Check for quota warnings
        this.checkQuotaWarnings(data);

        // Update the badge
        const $badge = $("#attackbox-usage-badge");
        const $badgeText = $badge.find(".attackbox-usage-text");

        if (data.hours_limit === "Unlimited") {
          $badgeText.html(`<strong>${data.plan}:</strong> Unlimited`);
          $badge
            .removeClass("usage-low usage-medium usage-high")
            .addClass("usage-unlimited");
        } else {
          $badgeText.html(
            `<strong>${data.plan}:</strong> ${data.hours_used}h / ${data.hours_limit}h ` +
              `<span class="usage-remaining">(${data.hours_remaining}h left)</span>`
          );

          // Color coding based on percentage
          $badge.removeClass(
            "usage-low usage-medium usage-high usage-unlimited"
          );
          if (data.percentage >= 90) {
            $badge.addClass("usage-high");
          } else if (data.percentage >= 70) {
            $badge.addClass("usage-medium");
          } else {
            $badge.addClass("usage-low");
          }
        }

        $badge.fadeIn(300);
      } catch (error) {
        console.error("Error updating usage display:", error);
      }
    }

    /**
     * Check quota levels and show warnings
     */
    checkQuotaWarnings(data) {
      // Skip if unlimited plan
      if (data.hours_limit === "Unlimited" || data.percentage === undefined) {
        return;
      }

      const percentage = data.percentage;
      let warningLevel = null;
      let message = "";

      // Determine warning level
      if (percentage >= 100) {
        warningLevel = "critical";
        message = `<strong>Quota Exhausted!</strong> You've used all ${data.hours_limit}h of your ${data.plan} plan. Quota resets ${data.reset_date}.`;
      } else if (percentage >= 90) {
        warningLevel = "high";
        message = `<strong>Low on Time!</strong> Only ${data.hours_remaining}h remaining of your ${data.hours_limit}h ${data.plan} quota.`;
      } else if (percentage >= 80) {
        warningLevel = "medium";
        message = `<strong>Heads up!</strong> You've used ${data.hours_used}h of ${data.hours_limit}h. ${data.hours_remaining}h remaining.`;
      }

      // Show notification if warning level changed
      if (warningLevel && warningLevel !== this.lastQuotaWarning) {
        this.showQuotaWarning(message, warningLevel);
        this.lastQuotaWarning = warningLevel;
      }
    }

    /**
     * Show quota warning notification
     */
    showQuotaWarning(message, level) {
      this.$notificationMessage.html(message);
      this.$notification
        .removeClass("warning-medium warning-high warning-critical")
        .addClass(`warning-${level}`);
      this.$notification.fadeIn(300);

      // Auto-hide medium warnings after 10 seconds
      if (level === "medium") {
        setTimeout(() => {
          this.$notification.fadeOut(300);
        }, 10000);
      }
      // Keep high/critical warnings visible
    }

    /**
     * Check quota before launching
     */
    async checkQuotaBeforeLaunch() {
      if (!this.currentUsageData) {
        return true; // No data yet, allow launch
      }

      const data = this.currentUsageData;

      // Check if quota exhausted
      if (data.hours_limit !== "Unlimited" && data.percentage >= 100) {
        this.showError(
          `Monthly usage limit reached!<br><br>` +
            `<strong>Plan:</strong> ${data.plan}<br>` +
            `<strong>Used:</strong> ${data.hours_used}h / ${data.hours_limit}h<br><br>` +
            `Your quota resets on <strong>${data.reset_date}</strong>.<br><br>` +
            `<a href="/local/attackbox/upgrade.php" style="color: #00ff88; text-decoration: underline;">Upgrade your plan</a> for more hours.`
        );
        return false;
      }

      // Warn if very low (< 10 minutes remaining)
      if (data.hours_limit !== "Unlimited" && data.minutes_remaining < 10) {
        return await this.showConfirm(
          `You only have <strong>${data.minutes_remaining} minutes</strong> remaining in your quota.<br><br>Do you want to continue?`,
          "Low Quota Warning",
          { confirmText: "Continue", cancelText: "Cancel", type: "warning" }
        );
      }

      return true;
    }

    /**
     * Show error message
     */
    showError(message) {
      this.isLaunching = false;
      $("#attackbox-error-message").html(message); // Changed from .text() to .html() to support HTML errors
      this.$overlayContent.fadeOut(200, () => {
        this.$errorContainer.fadeIn(200);
      });
    }

    /**
     * Hide error state
     */
    hideError() {
      this.$errorContainer.hide();
      this.$overlayContent.show();
      this.updateProgress(0, "");
    }

    /**
     * Cancel the launch
     */
    cancel() {
      this.stopPolling();
      this.isLaunching = false;
      this.hideOverlay();
    }

    /**
     * Start session timer countdown
     * @param {string} expiresAt ISO 8601 timestamp when session expires
     */
    startSessionTimer(expiresAt) {
      this.sessionExpiresAt = new Date(expiresAt);
      this.stopSessionTimer(); // Clear any existing timer

      // Update immediately
      this.updateTimerDisplay();

      // Update every second
      this.timerInterval = setInterval(() => {
        this.updateTimerDisplay();
      }, 1000);

      // Show timer badge
      this.$timerBadge.fadeIn(300);
    }

    /**
     * Stop session timer
     */
    stopSessionTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.sessionExpiresAt = null;
      this.$timerBadge.fadeOut(300);
    }

    /**
     * Start educational content rotation
     */
    startEducationalContent() {
      // Show first tip immediately
      this.rotateEducationalContent();

      // Rotate every 5 seconds
      this.eduInterval = setInterval(() => {
        this.rotateEducationalContent();
      }, 5000);
    }

    /**
     * Stop educational content rotation
     */
    stopEducationalContent() {
      if (this.eduInterval) {
        clearInterval(this.eduInterval);
        this.eduInterval = null;
      }
    }

    /**
     * Rotate to next educational content
     */
    rotateEducationalContent() {
      const $eduText = $("#attackbox-edu-text");
      const $attackLabel = $("#attackbox-attack-label");
      const $attackPath = $("#attackbox-attack-path");

      if (!$eduText.length) return;

      // Fade out
      $eduText.css("opacity", "0");
      $attackLabel.css("opacity", "0");

      setTimeout(() => {
        // Update text content
        const tip = this.eduContent[this.currentEduIndex];
        $eduText.text(tip);

        // Update attack visualization
        const attack = this.attackTypes[this.currentAttackIndex];
        $attackLabel.html(`<strong>${attack.icon} ${attack.name}</strong>`);
        $attackPath.css(
          "background",
          `linear-gradient(90deg, ${attack.color}, transparent)`
        );
        $attackPath.attr(
          "data-attack",
          attack.name.toLowerCase().replace(/\\s+/g, "-")
        );

        // Fade in
        $eduText.css("opacity", "1");
        $attackLabel.css("opacity", "1");

        // Increment indices
        this.currentEduIndex =
          (this.currentEduIndex + 1) % this.eduContent.length;
        this.currentAttackIndex =
          (this.currentAttackIndex + 1) % this.attackTypes.length;
      }, 300);
    }

    /**
     * Update timer display
     */
    updateTimerDisplay() {
      if (!this.sessionExpiresAt) {
        return;
      }

      const now = new Date();
      const remaining = this.sessionExpiresAt - now;

      if (remaining <= 0) {
        // Session expired
        this.$timerText.text("Expired");
        this.$timerBadge.addClass("timer-expired");
        this.stopSessionTimer();

        // Auto-terminate expired session
        setTimeout(() => {
          this.sessionId = null;
          this.hasActiveSession = false;
          this.activeSessionUrl = null;
          this.$button.removeClass("attackbox-btn-active");
          this.$button
            .find(".attackbox-btn-text")
            .text(this.strings.buttonText);
          this.$button.attr("title", this.strings.buttonTooltip);
          this.$terminateButton.hide();
          // Close split pane if open
          this.closeSplitPane();
          this.showAlert(
            "Your session has expired. Please launch a new session.",
            "Session Expired",
            "warning"
          );
        }, 2000);
        return;
      }

      // Calculate hours and minutes
      const totalMinutes = Math.floor(remaining / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      // Format display
      let timeText;
      if (hours > 0) {
        timeText = `${hours}h ${minutes}m`;
      } else {
        timeText = `${minutes}m`;
      }

      this.$timerText.text(timeText);

      // Color coding based on time remaining
      this.$timerBadge.removeClass(
        "timer-low timer-medium timer-high timer-expired"
      );
      if (totalMinutes <= 5) {
        this.$timerBadge.addClass("timer-low");
      } else if (totalMinutes <= 15) {
        this.$timerBadge.addClass("timer-medium");
      } else {
        this.$timerBadge.addClass("timer-high");
      }

      // Also update split-pane timer if visible
      this.updateSplitTimer();
    }

    /**
     * Open the lab view (split-pane interface)
     * Injects a split-pane overlay on the CURRENT page so students can see
     * lab instructions alongside the AttackBox terminal
     */
    openLabView() {
      console.log("[LynkBox] openLabView called", {
        activeSessionUrl: this.activeSessionUrl,
        sessionId: this.sessionId,
        openInNewTab: this.config.openInNewTab,
      });

      if (!this.activeSessionUrl || !this.sessionId) {
        console.error(
          "[LynkBox] Cannot open lab view: missing session URL or ID"
        );
        return;
      }

      // Check if user prefers new tab instead (admin setting)
      // Default is FALSE (split-pane view)
      const openInNewTab = this.config.openInNewTab === true;

      console.log("[LynkBox] openInNewTab setting:", openInNewTab);

      if (openInNewTab) {
        // Open in new tab (legacy behavior - only if explicitly enabled)
        console.log("[LynkBox] Opening in new tab (admin setting enabled)");
        window.open(this.activeSessionUrl, "_blank", "noopener");
        return;
      }

      // Check if split-pane is already open
      if ($("#lynkbox-split-container").length > 0) {
        console.log("[LynkBox] Split-pane already open, showing it");
        $("#lynkbox-split-container").show();
        return;
      }

      // Inject split-pane overlay on current page
      console.log("[LynkBox] Injecting split-pane view");
      this.injectSplitPane();
    }

    /**
     * Inject the split-pane container into the current page
     * Uses iframes for both Moodle content and Guacamole for full interactivity
     */
    injectSplitPane() {
      const self = this;
      console.log(
        "[LynkBox] injectSplitPane called with URL:",
        this.activeSessionUrl
      );

      // Get current page URL for the Moodle iframe
      const currentUrl = window.location.href;

      // Add a parameter to prevent infinite split-pane loops
      const moodleUrl = new URL(currentUrl);
      moodleUrl.searchParams.set("lynkbox_embedded", "1");

      // Create the split-pane container HTML
      const splitPaneHtml = `
        <div id="lynkbox-split-container" class="lynkbox-split-container">
          <!-- Header bar -->
          <div class="lynkbox-split-header">
            <div class="lynkbox-split-header-left">
              <span class="lynkbox-split-logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                  <path d="M7 8l3 3-3 3M12 14h4"></path>
                </svg>
                LynkBox Active
              </span>
              <span class="lynkbox-split-timer" id="lynkbox-split-timer"></span>
            </div>
            <div class="lynkbox-split-header-right">
              <button id="lynkbox-split-swap" class="lynkbox-split-btn" title="Swap panels">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
              </button>
              <button id="lynkbox-split-fullscreen" class="lynkbox-split-btn" title="Fullscreen terminal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
                </svg>
              </button>
              <button id="lynkbox-split-endsession" class="lynkbox-split-btn lynkbox-split-btn-end" title="End Session">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                </svg>
                <span>End</span>
              </button>
              <button id="lynkbox-split-close" class="lynkbox-split-btn" title="Minimise (keep session running)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Split pane content -->
          <div class="lynkbox-split-content">
            <!-- Moodle content panel (left) - now an iframe for full interactivity -->
            <div class="lynkbox-split-panel lynkbox-moodle-panel" id="lynkbox-moodle-panel">
              <iframe 
                id="lynkbox-moodle-frame"
                name="lynkbox-moodle-frame"
                class="lynkbox-moodle-frame"
                src="${moodleUrl.toString()}"
                allow="fullscreen">
              </iframe>
            </div>
            
            <!-- Resizer handle -->
            <div class="lynkbox-split-resizer" id="lynkbox-split-resizer">
              <div class="lynkbox-resizer-line"></div>
            </div>
            
            <!-- Guacamole terminal panel (right) -->
            <div class="lynkbox-split-panel lynkbox-terminal-panel" id="lynkbox-terminal-panel">
              <iframe 
                id="lynkbox-guacamole-frame"
                name="lynkbox-guacamole-frame"
                class="lynkbox-guacamole-frame"
                src="${this.activeSessionUrl}"
                allow="clipboard-read; clipboard-write; fullscreen; keyboard-map"
                allowfullscreen
                tabindex="0">
              </iframe>
            </div>
          </div>
        </div>
      `;

      // Inject the split-pane container
      $("body").append(splitPaneHtml);

      // Hide the original page content
      $("body")
        .children()
        .not(
          "#lynkbox-split-container, .attackbox-launcher, .attackbox-overlay, .attackbox-quota-notification, .attackbox-idle-warning, .lynkbox-modal-overlay, .attackbox-btn-restore, script, style, link, noscript"
        )
        .addClass("lynkbox-hidden-original");

      // Add body class to prevent scrolling on main page
      $("body").addClass("lynkbox-split-active");

      // Save split-pane state to sessionStorage for persistence across refreshes
      this.saveSplitPaneState();

      // Bind split-pane events
      this.bindSplitPaneEvents();

      // Update timer display in split header
      this.updateSplitTimer();

      console.log(
        "[LynkBox] Split-pane injection complete. Container exists:",
        $("#lynkbox-split-container").length > 0
      );
    }

    /**
     * Save split-pane state to sessionStorage
     */
    saveSplitPaneState() {
      const state = {
        active: true,
        sessionId: this.sessionId,
        guacamoleUrl: this.activeSessionUrl,
        expiresAt: this.sessionExpiresAt
          ? this.sessionExpiresAt.toISOString()
          : null,
      };
      sessionStorage.setItem("lynkbox-split-state", JSON.stringify(state));
      console.log("[LynkBox] Split-pane state saved:", state);
    }

    /**
     * Clear split-pane state from sessionStorage
     */
    clearSplitPaneState() {
      sessionStorage.removeItem("lynkbox-split-state");
      console.log("[LynkBox] Split-pane state cleared");
    }

    /**
     * Check and restore split-pane state on page load
     */
    checkAndRestoreSplitPane() {
      // Don't restore if we're already in an embedded iframe
      const urlParams = new URLSearchParams(window.location.search);
      const isEmbedded = urlParams.get("lynkbox_embedded") === "1";
      const isInIframe = window.self !== window.top;

      if (
        isEmbedded ||
        (isInIframe && window.name === "lynkbox-moodle-frame")
      ) {
        console.log(
          "[LynkBox] Running in embedded mode, skipping split-pane restore"
        );
        return;
      }

      const stateJson = sessionStorage.getItem("lynkbox-split-state");
      if (!stateJson) {
        return;
      }

      try {
        const state = JSON.parse(stateJson);
        console.log("[LynkBox] Found saved split-pane state:", state);

        if (state.active && state.sessionId && state.guacamoleUrl) {
          // Check if session hasn't expired
          if (state.expiresAt) {
            const expiresAt = new Date(state.expiresAt);
            if (expiresAt <= new Date()) {
              console.log(
                "[LynkBox] Saved session has expired, clearing state"
              );
              this.clearSplitPaneState();
              return;
            }
            this.sessionExpiresAt = expiresAt;
          }

          // Restore session data
          this.sessionId = state.sessionId;
          this.activeSessionUrl = state.guacamoleUrl;
          this.hasActiveSession = true;

          // Update button state
          this.$button.addClass("attackbox-btn-active");
          this.$button
            .find(".attackbox-btn-text")
            .text(this.strings.buttonTextActive);
          this.$button.attr("title", this.strings.buttonTooltipActive);
          this.$terminateButton.show();

          // Start timer if we have expiry
          if (this.sessionExpiresAt) {
            this.startSessionTimer(this.sessionExpiresAt.toISOString());
          }

          // Start heartbeat
          this.startHeartbeat();

          // Restore the split-pane view
          console.log("[LynkBox] Restoring split-pane view");
          this.injectSplitPane();
        }
      } catch (e) {
        console.error("[LynkBox] Error restoring split-pane state:", e);
        this.clearSplitPaneState();
      }
    }

    /**
     * Bind events for the split-pane interface
     */
    bindSplitPaneEvents() {
      const self = this;

      // Focus Guacamole iframe when terminal panel is clicked
      // This ensures keyboard input goes to the terminal
      const focusGuacamole = function () {
        const guacFrame = document.getElementById("lynkbox-guacamole-frame");
        if (guacFrame) {
          // Use setTimeout to ensure focus happens after any other events
          setTimeout(function () {
            guacFrame.focus();
            // Also try to focus the content window
            try {
              guacFrame.contentWindow.focus();
            } catch (e) {
              // Cross-origin - can't focus content window directly
            }
          }, 50);
        }
      };

      // Multiple event handlers to catch focus on terminal panel
      $("#lynkbox-terminal-panel").on("click mousedown", focusGuacamole);

      // When iframe itself is clicked
      $("#lynkbox-guacamole-frame").on("load", function () {
        // Focus on initial load
        focusGuacamole();

        // Also add mouseenter handler for re-focusing
        $(this).on("mouseenter", focusGuacamole);
      });

      // Re-focus when mouse enters terminal panel after being in Moodle
      $("#lynkbox-terminal-panel").on("mouseenter", function (e) {
        // Check if coming from outside the terminal panel
        const $related = $(e.relatedTarget);
        if (!$related.closest("#lynkbox-terminal-panel").length) {
          focusGuacamole();
        }
      });

      // Minimize button - close split view but keep session running
      $("#lynkbox-split-close").on("click", function () {
        self.closeSplitPane();
      });

      // End Session button - terminate session and close split view
      $("#lynkbox-split-endsession").on("click", function () {
        self.terminateSession();
      });

      // Swap panels button
      $("#lynkbox-split-swap").on("click", function () {
        self.swapPanels();
      });

      // Fullscreen terminal button
      $("#lynkbox-split-fullscreen").on("click", function () {
        self.toggleTerminalFullscreen();
      });

      // Resizer drag functionality
      this.initSplitResizer();

      // Escape key to close
      $(document).on("keydown.lynkbox-split", function (e) {
        if (e.key === "Escape") {
          self.closeSplitPane();
        }
      });
    }

    /**
     * Initialize the split-pane resizer
     */
    initSplitResizer() {
      const self = this;
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;

      const $resizer = $("#lynkbox-split-resizer");
      const $moodlePanel = $("#lynkbox-moodle-panel");
      const $terminalPanel = $("#lynkbox-terminal-panel");
      const $container = $(".lynkbox-split-content");

      $resizer.on("mousedown", function (e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = $moodlePanel.width();
        $("body").addClass("lynkbox-resizing");
        e.preventDefault();
      });

      $(document).on("mousemove.lynkbox-resize", function (e) {
        if (!isResizing) return;

        const containerWidth = $container.width();
        const diff = e.clientX - startX;
        const newWidth = ((startWidth + diff) / containerWidth) * 100;

        // Limit between 20% and 80%
        if (newWidth >= 20 && newWidth <= 80) {
          $moodlePanel.css("width", newWidth + "%");
          $terminalPanel.css("width", 100 - newWidth + "%");
        }
      });

      $(document).on("mouseup.lynkbox-resize", function () {
        if (isResizing) {
          isResizing = false;
          $("body").removeClass("lynkbox-resizing");
        }
      });
    }

    /**
     * Close the split-pane view
     */
    closeSplitPane() {
      // Check if split pane exists
      if ($("#lynkbox-split-container").length === 0) {
        return;
      }

      // Clear the saved state
      this.clearSplitPaneState();

      // Show original content
      $(".lynkbox-hidden-original").removeClass("lynkbox-hidden-original");

      // Remove split container
      $("#lynkbox-split-container").remove();

      // Remove body class
      $("body").removeClass("lynkbox-split-active");

      // Unbind events
      $(document).off("keydown.lynkbox-split");
      $(document).off("mousemove.lynkbox-resize");
      $(document).off("mouseup.lynkbox-resize");
    }

    /**
     * Swap the Moodle and terminal panels
     */
    swapPanels() {
      const $moodlePanel = $("#lynkbox-moodle-panel");
      const $terminalPanel = $("#lynkbox-terminal-panel");
      const $resizer = $("#lynkbox-split-resizer");

      // Swap order in DOM
      if ($moodlePanel.index() < $terminalPanel.index()) {
        $terminalPanel.insertBefore($moodlePanel);
        $resizer.insertAfter($terminalPanel);
      } else {
        $moodlePanel.insertBefore($terminalPanel);
        $resizer.insertAfter($moodlePanel);
      }
    }

    /**
     * Toggle terminal fullscreen mode
     */
    toggleTerminalFullscreen() {
      const $container = $("#lynkbox-split-container");
      const $moodlePanel = $("#lynkbox-moodle-panel");
      const $resizer = $("#lynkbox-split-resizer");
      const $btn = $("#lynkbox-split-fullscreen");

      if ($container.hasClass("lynkbox-terminal-fullscreen")) {
        // Exit fullscreen
        $container.removeClass("lynkbox-terminal-fullscreen");
        $moodlePanel.show();
        $resizer.show();
        $btn.attr("title", "Fullscreen terminal");
        $btn
          .find("svg")
          .html(
            '<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>'
          );
      } else {
        // Enter fullscreen
        $container.addClass("lynkbox-terminal-fullscreen");
        $moodlePanel.hide();
        $resizer.hide();
        $btn.attr("title", "Exit fullscreen");
        $btn
          .find("svg")
          .html(
            '<path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>'
          );
      }
    }

    /**
     * Update the timer display in split header
     */
    updateSplitTimer() {
      if (!this.sessionExpiresAt) return;

      const $timer = $("#lynkbox-split-timer");
      if (!$timer.length) return;

      const now = new Date();
      const remaining = this.sessionExpiresAt - now;

      if (remaining <= 0) {
        $timer.text("Expired").addClass("expired");
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

      let timeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      $timer.text(timeText);

      // Update color based on time
      $timer.removeClass("warning critical");
      const totalMinutes = remaining / (1000 * 60);
      if (totalMinutes <= 5) {
        $timer.addClass("critical");
      } else if (totalMinutes <= 15) {
        $timer.addClass("warning");
      }
    }

    /**
     * Terminate the current session
     */
    async terminateSession() {
      if (!this.sessionId) {
        console.warn("No session ID to terminate");
        return;
      }

      // Confirm termination with styled modal
      const confirmed = await this.showConfirm(
        this.strings.terminateConfirm,
        "End Session",
        { confirmText: "End Session", cancelText: "Cancel", type: "warning" }
      );

      if (!confirmed) {
        return;
      }

      try {
        // Show loading state on button
        const $btnText = this.$terminateButton.find(".attackbox-btn-text");
        const originalText = $btnText.text();
        this.$terminateButton.prop("disabled", true);
        this.$terminateButton.css("opacity", "0.6");
        $btnText.html('<span class="spinner"></span> Ending...');

        // Get token first
        const tokenData = await this.getToken();

        // Call terminate endpoint
        // stop_instance=false returns instance to available pool for reuse
        const response = await fetch(
          tokenData.api_url + "/sessions/" + this.sessionId,
          {
            method: "DELETE",
            headers: {
              "X-Moodle-Token": tokenData.token,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              reason: "user_requested",
              stop_instance: false, // Keep instance running, return to pool
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Failed to end session: ${response.status}`
          );
        }

        // Success - reset state
        this.sessionId = null;
        this.hasActiveSession = false;
        this.activeSessionUrl = null;

        // Stop timer and heartbeat
        this.stopSessionTimer();
        this.stopHeartbeat();

        // Close split-pane view if open (returns to normal Moodle view)
        this.closeSplitPane();

        // Update UI
        this.$button.removeClass("attackbox-btn-active");
        this.$button.find(".attackbox-btn-text").text(this.strings.buttonText);
        this.$button.attr("title", this.strings.buttonTooltip);
        this.$terminateButton.hide();
        this.$terminateButton.prop("disabled", false);
        this.$terminateButton.css("opacity", "1");

        // Show success message
        this.showAlert(
          this.strings.terminateSuccess,
          "Session Ended",
          "success"
        );
      } catch (error) {
        console.error("Terminate session error:", error);

        // Restore button state on error
        this.$terminateButton.prop("disabled", false);
        this.$terminateButton.css("opacity", "1");
        this.$terminateButton
          .find(".attackbox-btn-text")
          .text(this.strings.buttonTerminate);

        this.showAlert(
          this.strings.terminateError + ": " + error.message,
          "Error",
          "error"
        );
      }
    }
  }

  /**
   * Load all required strings from Moodle.
   * @returns {Promise<Object>} Promise resolving to strings object
   */
  const loadStrings = function () {
    return Str.get_strings(STRING_KEYS).then(function (results) {
      const strings = {};
      const keyNames = [
        "buttonText",
        "buttonTextActive",
        "buttonTerminate",
        "buttonTooltip",
        "buttonTooltipActive",
        "buttonUsageDashboard",
        "timerTimeRemaining",
        "overlayTitle",
        "overlaySubtitle",
        "cancelButton",
        "errorTitle",
        "errorRetry",
        "errorClose",
        "successTitle",
        "successMessage",
        "successOpen",
        "terminateConfirm",
        "terminateSuccess",
        "terminateError",
        "idleWarningTitle",
        "idleWarningMessage",
        "idleCriticalMessage",
        "idleKeepActive",
        "idleFocusMode",
        "progress5",
        "progress10",
        "progress18",
        "progress25",
        "progress33",
        "progress42",
        "progress50",
        "progress62",
        "progress70",
        "progress85",
        "progress94",
        "progress100",
      ];
      keyNames.forEach(function (key, index) {
        strings[key] = results[index];
      });
      return strings;
    });
  };

  return {
    /**
     * Initialize the launcher
     * @param {Object} config Configuration object
     */
    init: function (config) {
      // Wait for DOM ready and strings to load
      $(document).ready(function () {
        loadStrings()
          .then(function (strings) {
            new AttackBoxLauncher(config, strings);
          })
          .catch(function (error) {
            console.error("Failed to load LynkBox strings:", error);
          });
      });
    },
  };
});
