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
 * Lab launcher JavaScript module for CyberLab activity.
 *
 * @module     mod_cyberlab/lab_launcher
 * @copyright  2026 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define(["jquery", "core/ajax", "core/notification", "core/str"], function (
  $,
  Ajax,
  Notification,
  Str,
) {
  /**
   * Lab launcher state and configuration.
   */
  let config = {
    cmid: 0,
    templateId: "",
    sessionDuration: 2,
    sessionId: null,
    pollInterval: null,
    pollIntervalMs: 3000,
  };

  /**
   * DOM element references.
   */
  const elements = {
    startBtn: null,
    terminateBtn: null,
    lynkboxBtn: null,
    vpnBtn: null,
    statusDiv: null,
    targetInfo: null,
    targetIp: null,
    copyIpBtn: null,
    progressDiv: null,
    progressBar: null,
    progressText: null,
  };

  /**
   * Initialize the lab launcher.
   *
   * @param {number} cmid - Course module ID
   * @param {string} templateId - Lab template identifier
   * @param {number} sessionDuration - Max session duration in hours
   */
  const init = function (cmid, templateId, sessionDuration) {
    console.log("[CyberLab] Initializing lab launcher...");
    console.log("[CyberLab] Config:", { cmid, templateId, sessionDuration });

    config.cmid = cmid;
    config.templateId = templateId;
    config.sessionDuration = sessionDuration;

    // Cache DOM elements.
    elements.startBtn = $("#cyberlab-start-btn");
    elements.terminateBtn = $("#cyberlab-terminate-btn");
    elements.lynkboxBtn = $("#cyberlab-lynkbox-btn");
    elements.vpnBtn = $("#cyberlab-vpn-btn");
    elements.statusDiv = $("#cyberlab-session-status");
    elements.targetInfo = $("#cyberlab-target-info");
    elements.targetIp = $("#cyberlab-target-ip");
    elements.copyIpBtn = $("#cyberlab-copy-ip");
    elements.progressDiv = $("#cyberlab-launch-progress");
    elements.progressBar = $("#cyberlab-progress-bar");
    elements.progressText = $("#cyberlab-progress-text");

    // Log DOM element status
    console.log("[CyberLab] DOM elements found:", {
      startBtn: elements.startBtn.length > 0,
      terminateBtn: elements.terminateBtn.length > 0,
      lynkboxBtn: elements.lynkboxBtn.length > 0,
      statusDiv: elements.statusDiv.length > 0,
      targetInfo: elements.targetInfo.length > 0,
      progressDiv: elements.progressDiv.length > 0,
    });

    // Bind events.
    elements.startBtn.on("click", startLab);
    elements.terminateBtn.on("click", confirmTerminate);
    elements.lynkboxBtn.on("click", openLynkBox);
    if (elements.vpnBtn.length) {
      elements.vpnBtn.on("click", downloadVpnConfig);
    }
    elements.copyIpBtn.on("click", copyIpAddress);
    console.log("[CyberLab] Event handlers bound");

    // Check for existing session.
    checkExistingSession();
  };

  /**
   * Check if user has an existing active session.
   */
  const checkExistingSession = function () {
    console.log("[CyberLab] Checking for existing session...");
    console.log(
      "[CyberLab] Calling mod_cyberlab_get_active_session with cmid:",
      config.cmid,
    );

    Ajax.call([
      {
        methodname: "mod_cyberlab_get_active_session",
        args: { cmid: config.cmid },
      },
    ])[0]
      .done(function (response) {
        console.log("[CyberLab] get_active_session response:", response);
        if (response.session_id) {
          console.log(
            "[CyberLab] Found existing session:",
            response.session_id,
          );
          config.sessionId = response.session_id;
          if (response.status === "running") {
            console.log(
              "[CyberLab] Session is running, target_ip:",
              response.target_ip,
            );
            showRunningState(response.target_ip);
          } else if (
            response.status === "launching" ||
            response.status === "initializing"
          ) {
            console.log(
              "[CyberLab] Session is still launching/initializing, starting poll...",
            );
            showLaunchingState();
            startPolling();
          }
        } else {
          console.log("[CyberLab] No existing session found");
        }
      })
      .fail(function (error) {
        console.log(
          "[CyberLab] get_active_session failed (normal if no session):",
          error,
        );
        // No existing session - that's fine.
      });
  };

  /**
   * Start a new lab session.
   */
  const startLab = function () {
    console.log("[CyberLab] ========== START LAB CLICKED ==========");
    console.log("[CyberLab] Starting new lab session...");
    console.log("[CyberLab] Config:", {
      cmid: config.cmid,
      templateId: config.templateId,
    });

    elements.startBtn.prop("disabled", true);
    showLaunchingState();

    console.log("[CyberLab] Calling mod_cyberlab_start_session...");
    const startTime = Date.now();

    Ajax.call([
      {
        methodname: "mod_cyberlab_start_session",
        args: {
          cmid: config.cmid,
          template_id: config.templateId,
        },
      },
    ])[0]
      .done(function (response) {
        const elapsed = Date.now() - startTime;
        console.log(
          "[CyberLab] start_session response received in " + elapsed + "ms",
        );
        console.log(
          "[CyberLab] start_session full response:",
          JSON.stringify(response, null, 2),
        );

        if (response.success) {
          console.log("[CyberLab] ✅ Session started successfully!");
          console.log("[CyberLab] Session ID:", response.session_id);
          console.log("[CyberLab] Instance ID:", response.instance_id || "N/A");
          console.log(
            "[CyberLab] Existing session?",
            response.existing || false,
          );
          config.sessionId = response.session_id;
          console.log("[CyberLab] Starting status polling...");
          startPolling();
        } else {
          console.error("[CyberLab] ❌ start_session returned success=false");
          console.error("[CyberLab] Error:", response.error);
          console.error("[CyberLab] Full response:", response);
          showError(response.error || "Failed to start lab session.");
        }
      })
      .fail(function (error) {
        const elapsed = Date.now() - startTime;
        console.error(
          "[CyberLab] ❌ start_session AJAX call FAILED after " +
            elapsed +
            "ms",
        );
        console.error("[CyberLab] Error object:", error);
        console.error("[CyberLab] Error message:", error.message);
        console.error(
          "[CyberLab] Error details:",
          JSON.stringify(error, null, 2),
        );
        showError(error.message || "Failed to start lab session.");
      });
  };

  /**
   * Confirm and terminate the lab session.
   */
  const confirmTerminate = function () {
    Str.get_string("confirmterminate", "mod_cyberlab").done(function (message) {
      Notification.confirm(
        Str.get_string("terminatelab", "mod_cyberlab"),
        message,
        Str.get_string("yes", "core"),
        Str.get_string("no", "core"),
        terminateLab,
      );
    });
  };

  /**
   * Terminate the current lab session.
   */
  const terminateLab = function () {
    console.log("[CyberLab] ========== TERMINATE LAB ==========");
    console.log("[CyberLab] Session ID to terminate:", config.sessionId);

    if (!config.sessionId) {
      console.warn("[CyberLab] No session ID - cannot terminate");
      return;
    }

    elements.terminateBtn.prop("disabled", true);
    console.log("[CyberLab] Calling mod_cyberlab_terminate_session...");

    Ajax.call([
      {
        methodname: "mod_cyberlab_terminate_session",
        args: {
          cmid: config.cmid,
          session_id: config.sessionId,
        },
      },
    ])[0]
      .done(function (response) {
        console.log("[CyberLab] terminate_session response:", response);
        if (response.success) {
          console.log("[CyberLab] ✅ Session terminated successfully");
          stopPolling();
          config.sessionId = null;
          showIdleState();
          Str.get_string("sessionterminated", "mod_cyberlab").done(
            function (message) {
              Notification.addNotification({
                message: message,
                type: "success",
              });
            },
          );
        } else {
          console.error(
            "[CyberLab] ❌ terminate_session returned success=false",
          );
          console.error("[CyberLab] Error:", response.error);
          showError(response.error || "Failed to terminate session.");
        }
      })
      .fail(function (error) {
        console.error("[CyberLab] ❌ terminate_session AJAX FAILED");
        console.error("[CyberLab] Error:", error);
        showError(error.message || "Failed to terminate session.");
      })
      .always(function () {
        elements.terminateBtn.prop("disabled", false);
      });
  };

  /**
   * Open LynkBox in a new tab.
   */
  const openLynkBox = function () {
    // Trigger the local_attackbox launcher.
    if (typeof window.LaunchAttackBox !== "undefined") {
      window.LaunchAttackBox();
    } else {
      // Fallback: trigger click on the floating launcher if present.
      const launcher = document.querySelector(".attackbox-launcher");
      if (launcher) {
        launcher.click();
      } else {
        Notification.addNotification({
          message:
            "LynkBox launcher not available. Please ensure the AttackBox plugin is installed.",
          type: "warning",
        });
      }
    }
  };

  /**
   * Copy target IP to clipboard.
   */
  const copyIpAddress = function () {
    const ip = elements.targetIp.text();
    if (ip && ip !== "-") {
      navigator.clipboard
        .writeText(ip)
        .then(function () {
          Str.get_string("ipcopied", "mod_cyberlab").done(function (message) {
            Notification.addNotification({
              message: message,
              type: "success",
            });
          });
        })
        .catch(function () {
          // Fallback for older browsers.
          const textarea = document.createElement("textarea");
          textarea.value = ip;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        });
    }
  };

  /**
   * Start polling for session status updates.
   */
  const startPolling = function () {
    if (config.pollInterval) {
      console.log("[CyberLab] Polling already active, skipping");
      return;
    }

    console.log(
      "[CyberLab] Starting status polling (every " +
        config.pollIntervalMs +
        "ms)",
    );
    config.pollInterval = setInterval(pollStatus, config.pollIntervalMs);
    pollStatus(); // Immediate first poll.
  };

  /**
   * Stop polling for status updates.
   */
  const stopPolling = function () {
    if (config.pollInterval) {
      console.log("[CyberLab] Stopping status polling");
      clearInterval(config.pollInterval);
      config.pollInterval = null;
    }
  };

  /**
   * Poll the API for session status.
   */
  const pollStatus = function () {
    if (!config.sessionId) {
      console.warn("[CyberLab] No session ID for polling, stopping");
      stopPolling();
      return;
    }

    console.log("[CyberLab] Polling status for session:", config.sessionId);
    const pollTime = new Date().toLocaleTimeString();

    Ajax.call([
      {
        methodname: "mod_cyberlab_get_session_status",
        args: {
          cmid: config.cmid,
          session_id: config.sessionId,
        },
      },
    ])[0]
      .done(function (response) {
        console.log("[CyberLab] [" + pollTime + "] Status poll response:", {
          status: response.status,
          progress: response.progress,
          target_ip: response.target_ip,
          instance_id: response.instance_id,
          error_message: response.error_message,
        });
        updateStatusDisplay(response);

        if (response.status === "running") {
          console.log(
            "[CyberLab] ✅ Lab is now RUNNING! Target IP:",
            response.target_ip,
          );
          showRunningState(response.target_ip);
          stopPolling();
        } else if (response.status === "initializing") {
          // Instance is running but services are still starting up
          console.log(
            "[CyberLab] ⏳ Instance running, waiting for services... Progress:",
            response.progress + "%",
          );
          updateProgress(response.progress || 85);
          elements.statusText.text("Starting services (status checks: 0/2)...");
        } else if (
          response.status === "terminated" ||
          response.status === "error"
        ) {
          console.log("[CyberLab] Session ended with status:", response.status);
          stopPolling();
          if (response.status === "error") {
            console.error(
              "[CyberLab] ❌ Session ERROR:",
              response.error_message,
            );
            showError(
              response.error_message || "Lab session encountered an error.",
            );
          } else {
            console.log("[CyberLab] Session terminated normally");
            showIdleState();
          }
          config.sessionId = null;
        } else if (
          response.status === "launching" ||
          response.status === "pending"
        ) {
          console.log(
            "[CyberLab] Still launching... Progress:",
            response.progress + "%",
          );
          updateProgress(response.progress || 50);
        }
      })
      .fail(function (error) {
        console.warn("[CyberLab] Status poll failed (will retry):", error);
      });
  };

  /**
   * Update the status display based on response.
   *
   * @param {Object} response - Status response from API
   */
  const updateStatusDisplay = function (response) {
    const statusMap = {
      pending: "Initializing...",
      launching: "Launching lab VM...",
      initializing: "Starting services (waiting for status checks)...",
      running: "Lab is running",
      terminated: "Session ended",
      error: "Error",
    };

    let statusText = statusMap[response.status] || response.status;

    // Add more detail based on progress
    if (
      (response.status === "launching" || response.status === "pending") &&
      response.progress
    ) {
      if (response.progress < 30) {
        statusText = "Preparing lab environment...";
      } else if (response.progress < 60) {
        statusText = "Starting lab instance...";
      } else if (response.progress < 85) {
        statusText = "Instance booting up...";
      } else if (response.progress < 100) {
        statusText = "Almost ready, configuring network...";
      } else {
        statusText = "Lab is ready!";
      }
    }

    console.log(
      "[CyberLab] UI Update - Status:",
      response.status,
      "| Progress:",
      response.progress + "%",
      "| Text:",
      statusText,
    );
    elements.progressText.text(statusText);
  };

  /**
   * Update progress bar.
   *
   * @param {number} percent - Progress percentage (0-100)
   */
  const updateProgress = function (percent) {
    console.log("[CyberLab] Progress bar:", percent + "%");
    elements.progressBar.css("width", percent + "%");
    elements.progressBar.attr("aria-valuenow", percent);
  };

  /**
   * Show the idle (no session) state.
   */
  const showIdleState = function () {
    console.log("[CyberLab] UI State -> IDLE");
    elements.startBtn.show().prop("disabled", false);
    elements.terminateBtn.hide();
    elements.lynkboxBtn.hide();
    if (elements.vpnBtn.length) elements.vpnBtn.hide();
    elements.targetInfo.hide();
    elements.progressDiv.hide();
    Str.get_string("nosessionstarted", "mod_cyberlab").done(function (message) {
      elements.statusDiv.html('<p class="text-muted">' + message + "</p>");
    });
  };

  /**
   * Show the launching state.
   */
  const showLaunchingState = function () {
    console.log("[CyberLab] UI State -> LAUNCHING");
    elements.startBtn.hide();
    elements.terminateBtn.show().prop("disabled", false);
    elements.lynkboxBtn.hide();
    if (elements.vpnBtn.length) elements.vpnBtn.hide();
    elements.targetInfo.hide();
    elements.progressDiv.show();
    updateProgress(10);
    Str.get_string("launchinglab", "mod_cyberlab").done(function (message) {
      elements.progressText.text(message);
    });
  };

  /**
   * Show the running state with target IP.
   *
   * @param {string} targetIp - The target VM's IP address
   */
  const showRunningState = function (targetIp) {
    console.log("[CyberLab] UI State -> RUNNING");
    console.log("[CyberLab] Target IP:", targetIp);
    elements.startBtn.hide();
    elements.terminateBtn.show().prop("disabled", false);
    elements.lynkboxBtn.show();
    if (elements.vpnBtn.length) elements.vpnBtn.show();
    elements.targetInfo.show();
    elements.targetIp.text(targetIp || "-");
    elements.progressDiv.hide();
    Str.get_string("labready", "mod_cyberlab").done(function (message) {
      elements.statusDiv.html(
        '<p class="text-success font-weight-bold">' + message + "</p>",
      );
    });
  };

  /**
   * Show an error message.
   *
   * @param {string} message - Error message to display
   */
  const showError = function (message) {
    console.error("[CyberLab] ❌ ERROR:", message);
    showIdleState();
    Notification.addNotification({
      message: message,
      type: "error",
    });
  };

  /**
   * Download VPN configuration.
   */
  const downloadVpnConfig = function () {
    if (!config.sessionId) return;
    
    const url = M.cfg.wwwroot + '/mod/cyberlab/ajax/get_vpn_config.php?cmid=' + config.cmid + '&session_id=' + config.sessionId;
    window.location.href = url;
  };

  return {
    init: init,
  };
});
