// Content script for Web App Reader Extension
// Injects and manages the overlay panel with iframe

(function() {
  'use strict';

  // State management
  let overlayVisible = false;
  let overlayElement = null;
  let webAppUrl = '';
  let enabledByDefault = false;

  // Constants
  const OVERLAY_ID = 'web-app-reader-overlay';
  const OVERLAY_WIDTH = '16.666%'; // 1/6 of viewport
  const Z_INDEX = 2147483647; // Maximum safe z-index

  /**
   * Creates the overlay DOM structure
   */
  function createOverlay() {
    if (overlayElement) {
      return overlayElement;
    }

    // Main overlay container
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'web-app-reader-overlay';

    // Header bar
    const header = document.createElement('div');
    header.className = 'web-app-reader-header';

    const title = document.createElement('span');
    title.className = 'web-app-reader-title';
    title.textContent = 'Web App Reader';

    const closeButton = document.createElement('button');
    closeButton.className = 'web-app-reader-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Close overlay');
    closeButton.addEventListener('click', hideOverlay);

    header.appendChild(title);
    header.appendChild(closeButton);

    // Content area
    const content = document.createElement('div');
    content.className = 'web-app-reader-content';

    // Check if we have a valid URL
    if (webAppUrl && isValidHttpUrl(webAppUrl)) {
      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.className = 'web-app-reader-iframe';
      iframe.src = webAppUrl;
      iframe.setAttribute('title', 'Web App Reader Content');
      
      // Sandbox attributes - allow typical web app functionality
      // SECURITY WARNING: The combination of 'allow-scripts' and 'allow-same-origin'
      // effectively removes most sandbox protections. This means:
      // 1. The iframe can execute JavaScript
      // 2. The iframe is treated as same-origin if the URL matches the parent
      // 3. The iframe can access cookies, localStorage, and make requests
      // 
      // ONLY use this extension with trusted web apps from sources you control.
      // For untrusted content, consider:
      // - Removing 'allow-same-origin' (breaks many web apps but increases security)
      // - Implementing Content Security Policy headers
      // - Using a different approach like opening in a new window instead
      iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-downloads');
      
      content.appendChild(iframe);
    } else {
      // Show placeholder message
      const placeholder = document.createElement('div');
      placeholder.className = 'web-app-reader-placeholder';
      placeholder.innerHTML = `
        <h3>No Web App URL Configured</h3>
        <p>Please configure a web app URL in the extension options.</p>
        <button class="web-app-reader-options-btn">Open Options</button>
      `;
      
      const optionsBtn = placeholder.querySelector('.web-app-reader-options-btn');
      optionsBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
      });
      
      content.appendChild(placeholder);
    }

    overlay.appendChild(header);
    overlay.appendChild(content);
    
    overlayElement = overlay;
    return overlay;
  }

  /**
   * Shows the overlay
   */
  function showOverlay() {
    if (overlayVisible) return;

    const overlay = createOverlay();
    
    if (!document.body.contains(overlay)) {
      document.body.appendChild(overlay);
    }
    
    // Force a reflow to enable CSS transition
    overlay.offsetHeight;
    overlay.classList.add('visible');
    
    overlayVisible = true;
  }

  /**
   * Hides the overlay
   */
  function hideOverlay() {
    if (!overlayVisible || !overlayElement) return;

    overlayElement.classList.remove('visible');
    overlayVisible = false;
    
    // Optional: Remove from DOM after transition
    // setTimeout(() => {
    //   if (overlayElement && !overlayVisible) {
    //     overlayElement.remove();
    //     overlayElement = null;
    //   }
    // }, 300);
  }

  /**
   * Toggles the overlay visibility
   */
  function toggleOverlay() {
    if (overlayVisible) {
      hideOverlay();
    } else {
      showOverlay();
    }
  }

  /**
   * Validates if a string is a valid HTTP/HTTPS URL
   */
  function isValidHttpUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  /**
   * Loads settings from storage
   */
  function loadSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(['webAppUrl', 'overlayEnabledByDefault'], (result) => {
        if (chrome.runtime.lastError) {
          // Fallback to local storage
          chrome.storage.local.get(['webAppUrl', 'overlayEnabledByDefault'], (localResult) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(localResult);
            }
          });
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Initializes the extension
   */
  async function init() {
    try {
      const settings = await loadSettings();
      
      webAppUrl = settings.webAppUrl || '';
      enabledByDefault = settings.overlayEnabledByDefault || false;

      // Auto-show overlay if enabled by default
      if (enabledByDefault && webAppUrl) {
        showOverlay();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_OVERLAY') {
      toggleOverlay();
      sendResponse({ success: true });
    }
    return true; // Keep message channel open for async response
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
