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
 * LynkBox Lab View - Split-pane interface module
 *
 * Provides THM/HTB-style split-pane view with Guacamole terminal
 * alongside course content and notes.
 *
 * @module     local_attackbox/lab-view
 * @copyright  2025 CyberLab
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define(["jquery"], function ($) {
  "use strict";

  /**
   * LabView class - manages the split-pane interface
   */
  class LabView {
    /**
     * Constructor
     * @param {Object} config Configuration object
     */
    constructor(config) {
      this.config = config;
      this.sessionId = config.sessionId;
      this.guacamoleUrl = config.guacamoleUrl;
      this.courseId = config.courseId;
      this.strings = config.strings || {};

      // UI state
      this.isPanelCollapsed = false;
      this.isFullscreen = false;
      this.panelWidth = 35; // Percentage
      this.minPanelWidth = 20;
      this.maxPanelWidth = 50;

      // Session state
      this.sessionExpiresAt = null;
      this.timerInterval = null;
      this.heartbeatInterval = null;
      this.notesAutosaveTimeout = null;

      // Local storage keys
      this.storageKeyNotes = `lynkbox_notes_${this.sessionId}`;
      this.storageKeyPanelWidth = "lynkbox_panel_width";
      this.storageKeyPanelCollapsed = "lynkbox_panel_collapsed";

      this.init();
    }

    /**
     * Initialize the lab view
     */
    init() {
      this.cacheElements();
      this.bindEvents();
      this.restoreState();
      this.loadNotes();
      this.startHeartbeat();
      this.fetchSessionDetails();

      // Load course content if course ID provided
      if (this.courseId > 0) {
        this.loadCourseContent();
      }

      console.log("LynkBox Lab View initialized", {
        sessionId: this.sessionId,
        courseId: this.courseId,
      });
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
      this.$container = $("#cyberlab-container");
      this.$instructionsPanel = $("#cyberlab-instructions-panel");
      this.$terminalPanel = $("#cyberlab-terminal-panel");
      this.$resizer = $("#cyberlab-resizer");
      this.$collapseBtn = $("#cyberlab-collapse-panel");
      this.$expandBtn = $("#cyberlab-expand-panel");
      this.$fullscreenBtn = $("#cyberlab-fullscreen-btn");
      this.$endSessionBtn = $("#cyberlab-end-session-btn");
      this.$timer = $("#cyberlab-timer");
      this.$timerText = $("#cyberlab-timer-text");
      this.$guacamoleFrame = $("#cyberlab-guacamole-frame");
      this.$connectionStatus = $("#cyberlab-connection-status");
      this.$connectionMessage = $("#cyberlab-connection-message");
      this.$notes = $("#cyberlab-notes");
      this.$notesStatus = $("#cyberlab-notes-status");
      this.$notesCopy = $("#cyberlab-notes-copy");
      this.$notesClear = $("#cyberlab-notes-clear");
      this.$tabs = $(".cyberlab-tab");
      this.$tabContents = $(".cyberlab-tab-content");
      this.$toolCards = $(".cyberlab-tool-card");
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
      const self = this;

      // Panel collapse/expand
      this.$collapseBtn.on("click", () => this.togglePanel());
      this.$expandBtn.on("click", () => this.togglePanel());

      // Fullscreen toggle
      this.$fullscreenBtn.on("click", () => this.toggleFullscreen());

      // End session
      this.$endSessionBtn.on("click", () => this.endSession());

      // Tab switching
      this.$tabs.on("click", function () {
        self.switchTab($(this).data("tab"));
      });

      // Tool card click - copy command
      this.$toolCards.on("click", function () {
        const command = $(this).data("command");
        self.copyCommand(command, $(this));
      });

      // Notes autosave
      this.$notes.on("input", () => this.scheduleNotesAutosave());

      // Notes copy button
      this.$notesCopy.on("click", () => this.copyNotes());

      // Notes clear button
      this.$notesClear.on("click", () => this.clearNotes());

      // Resizer drag functionality
      this.initResizer();

      // Keyboard shortcuts
      $(document).on("keydown", (e) => this.handleKeyboard(e));

      // Handle iframe load errors
      this.$guacamoleFrame.on("load", () => this.handleFrameLoad());
      this.$guacamoleFrame.on("error", () => this.handleFrameError());

      // Fullscreen change event
      $(document).on(
        "fullscreenchange webkitfullscreenchange mozfullscreenchange MSFullscreenChange",
        () => {
          this.isFullscreen = !!document.fullscreenElement;
          this.updateFullscreenButton();
        }
      );

      // Warn before leaving
      $(window).on("beforeunload", (e) => {
        // Save notes before leaving
        this.saveNotes();
      });
    }

    /**
     * Initialize the resizer drag functionality
     */
    initResizer() {
      const self = this;
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;

      this.$resizer.on("mousedown", function (e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = self.$instructionsPanel.width();
        self.$container.addClass("cyberlab-resizing");
        e.preventDefault();
      });

      $(document).on("mousemove", function (e) {
        if (!isResizing) return;

        const containerWidth = self.$container.width();
        const diff = e.clientX - startX;
        const newWidth = ((startWidth + diff) / containerWidth) * 100;

        if (newWidth >= self.minPanelWidth && newWidth <= self.maxPanelWidth) {
          self.panelWidth = newWidth;
          self.applyPanelWidth();
        }
      });

      $(document).on("mouseup", function () {
        if (isResizing) {
          isResizing = false;
          self.$container.removeClass("cyberlab-resizing");
          self.savePanelWidth();
        }
      });
    }

    /**
     * Apply panel width
     */
    applyPanelWidth() {
      this.$instructionsPanel.css("width", this.panelWidth + "%");
      this.$terminalPanel.css("width", 100 - this.panelWidth + "%");
    }

    /**
     * Save panel width to localStorage
     */
    savePanelWidth() {
      try {
        localStorage.setItem(this.storageKeyPanelWidth, this.panelWidth);
      } catch (e) {
        // localStorage not available
      }
    }

    /**
     * Restore UI state from localStorage
     */
    restoreState() {
      try {
        // Restore panel width
        const savedWidth = localStorage.getItem(this.storageKeyPanelWidth);
        if (savedWidth) {
          this.panelWidth = parseFloat(savedWidth);
          if (
            this.panelWidth >= this.minPanelWidth &&
            this.panelWidth <= this.maxPanelWidth
          ) {
            this.applyPanelWidth();
          }
        }

        // Restore collapsed state
        const savedCollapsed = localStorage.getItem(
          this.storageKeyPanelCollapsed
        );
        if (savedCollapsed === "true") {
          this.collapsePanel();
        }
      } catch (e) {
        // localStorage not available
      }
    }

    /**
     * Toggle panel collapse/expand
     */
    togglePanel() {
      if (this.isPanelCollapsed) {
        this.expandPanel();
      } else {
        this.collapsePanel();
      }
    }

    /**
     * Collapse the instructions panel
     */
    collapsePanel() {
      this.isPanelCollapsed = true;
      this.$instructionsPanel.addClass("collapsed");
      this.$resizer.hide();
      this.$expandBtn.show();
      this.$terminalPanel.css("width", "100%");

      try {
        localStorage.setItem(this.storageKeyPanelCollapsed, "true");
      } catch (e) {
        // localStorage not available
      }
    }

    /**
     * Expand the instructions panel
     */
    expandPanel() {
      this.isPanelCollapsed = false;
      this.$instructionsPanel.removeClass("collapsed");
      this.$resizer.show();
      this.$expandBtn.hide();
      this.applyPanelWidth();

      try {
        localStorage.setItem(this.storageKeyPanelCollapsed, "false");
      } catch (e) {
        // localStorage not available
      }
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
      if (!document.fullscreenElement) {
        const container = this.$container[0];
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    }

    /**
     * Update fullscreen button icon
     */
    updateFullscreenButton() {
      const icon = this.isFullscreen
        ? '<path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>'
        : '<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>';

      this.$fullscreenBtn.find("svg").html(icon);
      this.$fullscreenBtn.attr(
        "title",
        this.isFullscreen
          ? this.strings.exitFullscreen
          : this.strings.fullscreen
      );
    }

    /**
     * Switch tab
     * @param {string} tabId Tab identifier
     */
    switchTab(tabId) {
      this.$tabs.removeClass("active");
      this.$tabs.filter(`[data-tab="${tabId}"]`).addClass("active");

      this.$tabContents.removeClass("active");
      $(`#tab-${tabId}`).addClass("active");
    }

    /**
     * Copy command to clipboard
     * @param {string} command Command to copy
     * @param {jQuery} $card The tool card element
     */
    copyCommand(command, $card) {
      navigator.clipboard
        .writeText(command)
        .then(() => {
          // Visual feedback
          $card.addClass("copied");
          setTimeout(() => $card.removeClass("copied"), 1500);
        })
        .catch((err) => {
          console.error("Failed to copy command:", err);
        });
    }

    /**
     * Load notes from localStorage
     */
    loadNotes() {
      try {
        const savedNotes = localStorage.getItem(this.storageKeyNotes);
        if (savedNotes) {
          this.$notes.val(savedNotes);
        }
      } catch (e) {
        // localStorage not available
      }
    }

    /**
     * Schedule notes autosave with debounce
     */
    scheduleNotesAutosave() {
      this.$notesStatus.text("Saving...").removeClass("saved");

      if (this.notesAutosaveTimeout) {
        clearTimeout(this.notesAutosaveTimeout);
      }

      this.notesAutosaveTimeout = setTimeout(() => {
        this.saveNotes();
      }, 1000);
    }

    /**
     * Save notes to localStorage
     */
    saveNotes() {
      try {
        const notes = this.$notes.val();
        localStorage.setItem(this.storageKeyNotes, notes);
        this.$notesStatus.text("Saved").addClass("saved");
      } catch (e) {
        this.$notesStatus.text("Error saving").removeClass("saved");
      }
    }

    /**
     * Copy notes to clipboard
     */
    copyNotes() {
      const notes = this.$notes.val();
      navigator.clipboard
        .writeText(notes)
        .then(() => {
          this.$notesCopy.addClass("success");
          setTimeout(() => this.$notesCopy.removeClass("success"), 1500);
        })
        .catch((err) => {
          console.error("Failed to copy notes:", err);
        });
    }

    /**
     * Clear notes
     */
    clearNotes() {
      if (confirm("Are you sure you want to clear all notes?")) {
        this.$notes.val("");
        this.saveNotes();
      }
    }

    /**
     * Handle keyboard shortcuts
     * @param {Event} e Keyboard event
     */
    handleKeyboard(e) {
      // Ignore if typing in notes textarea
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
        return;
      }

      // Ctrl/Cmd + B: Toggle panel
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        this.togglePanel();
      }

      // Ctrl/Cmd + Enter: Fullscreen
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        this.toggleFullscreen();
      }

      // Escape: Exit fullscreen
      if (e.key === "Escape" && this.isFullscreen) {
        document.exitFullscreen();
      }
    }

    /**
     * Handle iframe load event
     */
    handleFrameLoad() {
      this.$connectionStatus.fadeOut(200);
    }

    /**
     * Handle iframe error
     */
    handleFrameError() {
      this.showConnectionStatus(this.strings.connectionLost);
    }

    /**
     * Show connection status overlay
     * @param {string} message Status message
     */
    showConnectionStatus(message) {
      this.$connectionMessage.text(message);
      this.$connectionStatus.fadeIn(200);
    }

    /**
     * Fetch session details from API
     */
    async fetchSessionDetails() {
      try {
        const tokenData = await this.getToken();
        const response = await fetch(
          `${tokenData.api_url}/sessions/${this.sessionId}`,
          {
            method: "GET",
            headers: {
              "X-Moodle-Token": tokenData.token,
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          console.warn("Failed to fetch session details");
          return;
        }

        const data = await response.json();
        const session = data.data || data;

        if (session.expires_at) {
          this.startSessionTimer(session.expires_at);
        }
      } catch (error) {
        console.error("Error fetching session details:", error);
      }
    }

    /**
     * Get authentication token from Moodle
     */
    async getToken() {
      const response = await fetch(
        `${this.config.tokenEndpoint}?sesskey=${this.config.sesskey}`,
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
     * Start session countdown timer
     * @param {string} expiresAt ISO 8601 timestamp
     */
    startSessionTimer(expiresAt) {
      this.sessionExpiresAt = new Date(expiresAt);

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }

      this.updateTimerDisplay();
      this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
    }

    /**
     * Update timer display
     */
    updateTimerDisplay() {
      if (!this.sessionExpiresAt) return;

      const now = new Date();
      const remaining = this.sessionExpiresAt - now;

      if (remaining <= 0) {
        this.$timerText.text("Expired");
        this.$timer.addClass("expired");
        clearInterval(this.timerInterval);
        this.handleSessionExpired();
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      let timeText;
      if (hours > 0) {
        timeText = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      } else {
        timeText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }

      this.$timerText.text(timeText);

      // Update timer color based on remaining time
      this.$timer.removeClass("warning critical");
      const totalMinutes = remaining / (1000 * 60);
      if (totalMinutes <= 5) {
        this.$timer.addClass("critical");
      } else if (totalMinutes <= 15) {
        this.$timer.addClass("warning");
      }
    }

    /**
     * Handle session expiration
     */
    handleSessionExpired() {
      alert(
        "Your session has expired. You will be redirected to the dashboard."
      );
      window.location.href = M.cfg.wwwroot;
    }

    /**
     * Start heartbeat to keep session alive
     */
    startHeartbeat() {
      // Send heartbeat every 30 seconds
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 30000);
    }

    /**
     * Send heartbeat to API
     */
    async sendHeartbeat() {
      try {
        const tokenData = await this.getToken();
        await fetch(
          `${tokenData.api_url}/sessions/${this.sessionId}/heartbeat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Moodle-Token": tokenData.token,
            },
            body: JSON.stringify({
              activity_type: "lab_view",
              tab_visible: !document.hidden,
            }),
          }
        );
      } catch (error) {
        console.warn("Heartbeat failed:", error);
      }
    }

    /**
     * End the current session
     */
    async endSession() {
      if (!confirm(this.strings.confirmEnd)) {
        return;
      }

      try {
        // Save notes before ending
        this.saveNotes();

        const tokenData = await this.getToken();
        const response = await fetch(
          `${tokenData.api_url}/sessions/${this.sessionId}`,
          {
            method: "DELETE",
            headers: {
              "X-Moodle-Token": tokenData.token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reason: "user_requested",
              stop_instance: false,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to end session");
        }

        alert(this.strings.sessionEnded);
        window.location.href = M.cfg.wwwroot;
      } catch (error) {
        console.error("Error ending session:", error);
        alert("Failed to end session. Please try again.");
      }
    }

    /**
     * Load course content if course ID is provided
     */
    async loadCourseContent() {
      const $loading = $("#cyberlab-course-loading");
      const $content = $("#cyberlab-course-content");

      try {
        // For now, show a placeholder - you can implement actual course content loading
        // via Moodle web services or AJAX
        $loading.hide();
        $content.html(`
          <div class="cyberlab-course-placeholder">
            <h3>${this.config.courseTitle}</h3>
            <p>Course content integration coming soon. For now, use the terminal on the right to complete your lab exercises.</p>
            <a href="${M.cfg.wwwroot}/course/view.php?id=${this.courseId}" target="_blank" class="cyberlab-course-link">
              Open course in new tab
            </a>
          </div>
        `);
        $content.show();
      } catch (error) {
        console.error("Error loading course content:", error);
        $loading.html(
          '<p class="error">Failed to load course content</p>'
        );
      }
    }

    /**
     * Cleanup on destroy
     */
    destroy() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      if (this.notesAutosaveTimeout) {
        clearTimeout(this.notesAutosaveTimeout);
      }
      this.saveNotes();
    }
  }

  return {
    /**
     * Initialize the lab view
     * @param {Object} config Configuration object
     */
    init: function (config) {
      $(document).ready(function () {
        new LabView(config);
      });
    },
  };
});
