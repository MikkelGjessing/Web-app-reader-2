// Options page script for Web App Reader Extension
// Handles saving and loading settings

(function() {
  'use strict';

  // DOM elements
  const form = document.getElementById('options-form');
  const webAppUrlInput = document.getElementById('webAppUrl');
  const overlayEnabledCheckbox = document.getElementById('overlayEnabledByDefault');
  const saveButton = document.getElementById('save-btn');
  const resetButton = document.getElementById('reset-btn');
  const statusMessage = document.getElementById('status-message');
  const urlError = document.getElementById('url-error');

  /**
   * Validates if a string is a valid HTTP/HTTPS URL
   */
  function isValidHttpUrl(string) {
    if (!string || string.trim() === '') {
      return false;
    }
    
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  /**
   * Shows a status message
   */
  function showStatus(message, type = 'success') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} visible`;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusMessage.classList.remove('visible');
    }, 3000);
  }

  /**
   * Shows URL validation error
   */
  function showUrlError(show = true) {
    if (show) {
      webAppUrlInput.classList.add('error');
      urlError.classList.add('visible');
    } else {
      webAppUrlInput.classList.remove('error');
      urlError.classList.remove('visible');
    }
  }

  /**
   * Loads settings from storage
   */
  function loadSettings() {
    // Try sync storage first, fallback to local
    chrome.storage.sync.get(['webAppUrl', 'overlayEnabledByDefault'], (result) => {
      if (chrome.runtime.lastError) {
        // Fallback to local storage
        chrome.storage.local.get(['webAppUrl', 'overlayEnabledByDefault'], (localResult) => {
          if (!chrome.runtime.lastError) {
            applySettings(localResult);
          } else {
            console.error('Error loading settings:', chrome.runtime.lastError);
          }
        });
      } else {
        applySettings(result);
      }
    });
  }

  /**
   * Applies loaded settings to the form
   */
  function applySettings(settings) {
    webAppUrlInput.value = settings.webAppUrl || '';
    overlayEnabledCheckbox.checked = settings.overlayEnabledByDefault || false;
  }

  /**
   * Saves settings to storage
   */
  function saveSettings(event) {
    event.preventDefault();
    
    const url = webAppUrlInput.value.trim();
    const enabledByDefault = overlayEnabledCheckbox.checked;

    // Validate URL if provided
    if (url && !isValidHttpUrl(url)) {
      showUrlError(true);
      showStatus('Please enter a valid HTTP or HTTPS URL', 'error');
      return;
    }

    showUrlError(false);

    const settings = {
      webAppUrl: url,
      overlayEnabledByDefault: enabledByDefault
    };

    // Disable save button during save
    saveButton.disabled = true;

    // Try to save to sync storage first
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        // Fallback to local storage
        chrome.storage.local.set(settings, () => {
          saveButton.disabled = false;
          
          if (chrome.runtime.lastError) {
            console.error('Error saving settings:', chrome.runtime.lastError);
            showStatus('Error saving settings. Please try again.', 'error');
          } else {
            showStatus('Settings saved successfully! (Using local storage)', 'success');
          }
        });
      } else {
        saveButton.disabled = false;
        showStatus('Settings saved successfully!', 'success');
      }
    });
  }

  /**
   * Resets settings to defaults
   */
  function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      webAppUrlInput.value = '';
      overlayEnabledCheckbox.checked = false;
      showUrlError(false);
      
      const defaultSettings = {
        webAppUrl: '',
        overlayEnabledByDefault: false
      };

      // Save default settings
      chrome.storage.sync.set(defaultSettings, () => {
        if (chrome.runtime.lastError) {
          chrome.storage.local.set(defaultSettings, () => {
            if (!chrome.runtime.lastError) {
              showStatus('Settings reset to defaults', 'success');
            }
          });
        } else {
          showStatus('Settings reset to defaults', 'success');
        }
      });
    }
  }

  /**
   * Handle URL input changes
   */
  function handleUrlInput() {
    // Clear error state when user starts typing
    if (urlError.classList.contains('visible')) {
      showUrlError(false);
    }
  }

  // Event listeners
  form.addEventListener('submit', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  webAppUrlInput.addEventListener('input', handleUrlInput);

  // Load settings when page loads
  document.addEventListener('DOMContentLoaded', loadSettings);
})();
