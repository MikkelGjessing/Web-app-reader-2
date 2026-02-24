// Content script for Web App Reader Extension
// Injects and manages the overlay panel with iframe
// 
// CSS Isolation Strategy:
// We use Shadow DOM to isolate our styles from the host page. This prevents:
// 1. Host page styles from breaking our overlay UI
// 2. Our styles from affecting the host page
// 
// Tradeoffs of Shadow DOM:
// - Pros: Complete CSS isolation, cleaner DOM separation, better encapsulation
// - Cons: Slight complexity in event handling, requires careful setup for accessibility
// - We attach event listeners to elements inside shadow DOM which works perfectly
// - We use :host selector for the container styles
//
// Performance considerations:
// - Single root container (shadow host) minimizes DOM operations
// - Resize events throttled with requestAnimationFrame to avoid layout thrashing
// - Transform-based animations for smooth 60fps transitions
// - Avoid forced synchronous layouts during resize

(function() {
  'use strict';

  // State management
  let overlayVisible = false;
  let overlayHost = null;
  let shadowRoot = null;
  let webAppUrl = '';
  let enabledByDefault = false;
  let useBackdrop = false;
  let pinnedMode = false;
  let overlayWidth = 16.666; // Default width percentage
  
  // Resize state
  let isResizing = false;
  let resizeRAF = null;

  // Constants
  const OVERLAY_HOST_ID = 'web-app-reader-host';
  const BACKDROP_ID = 'web-app-reader-backdrop';
  const MIN_WIDTH_PERCENT = 10;
  const MAX_WIDTH_PERCENT = 50;
  const Z_INDEX = 2147483647; // Maximum safe z-index

  /**
   * Creates styles for the shadow DOM
   * All styles are scoped to shadow root - no conflicts with host page
   */
  function createStyles() {
    return `
      :host {
        all: initial;
        display: block;
      }

      /* Main overlay container */
      .overlay {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        z-index: ${Z_INDEX};
        background: #ffffff;
        border-left: 2px solid #e0e0e0;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      .overlay.visible {
        transform: translateX(0);
      }

      /* Resize handle on left edge */
      .resize-handle {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 8px;
        cursor: ew-resize;
        background: transparent;
        z-index: 10;
        transition: background-color 0.2s;
      }

      .resize-handle:hover,
      .resize-handle.active {
        background: rgba(0, 102, 204, 0.3);
      }

      .resize-handle::before {
        content: '';
        position: absolute;
        left: 2px;
        top: 50%;
        transform: translateY(-50%);
        width: 4px;
        height: 40px;
        background: #d0d0d0;
        border-radius: 2px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .resize-handle:hover::before,
      .resize-handle.active::before {
        opacity: 1;
      }

      /* Header bar */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f5f5f5;
        border-bottom: 1px solid #e0e0e0;
        flex-shrink: 0;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .title {
        font-size: 14px;
        font-weight: 600;
        color: #333333;
        margin: 0;
      }

      /* Pin button */
      .pin-button {
        background: transparent;
        border: none;
        font-size: 16px;
        color: #666666;
        cursor: pointer;
        padding: 4px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s, color 0.2s;
        line-height: 1;
      }

      .pin-button:hover {
        background: #e0e0e0;
        color: #333333;
      }

      .pin-button.pinned {
        color: #0066cc;
      }

      /* Close button */
      .close-button {
        background: transparent;
        border: none;
        font-size: 24px;
        line-height: 1;
        color: #666666;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s, color 0.2s;
      }

      .close-button:hover {
        background: #e0e0e0;
        color: #333333;
      }

      .close-button:active {
        background: #d0d0d0;
      }

      /* Content area */
      .content {
        flex: 1;
        overflow: hidden;
        position: relative;
        background: #ffffff;
      }

      /* Iframe */
      .iframe {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
      }

      /* Placeholder */
      .placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 24px;
        text-align: center;
        color: #666666;
      }

      .placeholder h3 {
        font-size: 16px;
        font-weight: 600;
        color: #333333;
        margin: 0 0 12px 0;
      }

      .placeholder p {
        font-size: 14px;
        margin: 0 0 20px 0;
        line-height: 1.5;
      }

      .options-button {
        background: #0066cc;
        color: #ffffff;
        border: none;
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .options-button:hover {
        background: #0052a3;
      }

      .options-button:active {
        background: #004182;
      }
    `;
  }

  /**
   * Creates the backdrop element (outside shadow DOM for full-page coverage)
   */
  function createBackdrop() {
    let backdrop = document.getElementById(BACKDROP_ID);
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = BACKDROP_ID;
      backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        z-index: ${Z_INDEX - 1};
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
        backdrop-filter: blur(2px);
      `;
      backdrop.addEventListener('click', hideOverlay);
    }
    return backdrop;
  }

  /**
   * Creates the overlay DOM structure using Shadow DOM
   */
  function createOverlay() {
    if (overlayHost) {
      return { host: overlayHost, shadow: shadowRoot };
    }

    // Create shadow host element
    const host = document.createElement('div');
    host.id = OVERLAY_HOST_ID;
    
    // Attach shadow root for CSS isolation
    const shadow = host.attachShadow({ mode: 'open' });

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = createStyles();
    shadow.appendChild(styleEl);

    // Main overlay container
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.width = `${overlayWidth}%`;

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.addEventListener('mousedown', startResize);

    // Header bar
    const header = document.createElement('div');
    header.className = 'header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'header-left';

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = 'Web App Reader';

    headerLeft.appendChild(title);

    const headerRight = document.createElement('div');
    headerRight.className = 'header-right';

    // Pin button
    const pinButton = document.createElement('button');
    pinButton.className = 'pin-button';
    pinButton.textContent = '📌';
    pinButton.setAttribute('aria-label', 'Toggle pin mode');
    pinButton.title = 'Pin overlay to all sites';
    pinButton.addEventListener('click', togglePinMode);

    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Close overlay');
    closeButton.addEventListener('click', hideOverlay);

    headerRight.appendChild(pinButton);
    headerRight.appendChild(closeButton);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Content area
    const content = document.createElement('div');
    content.className = 'content';

    // Check if we have a valid URL
    if (webAppUrl && isValidHttpUrl(webAppUrl)) {
      const iframe = document.createElement('iframe');
      iframe.className = 'iframe';
      iframe.src = webAppUrl;
      iframe.setAttribute('title', 'Web App Reader Content');
      
      // Sandbox attributes - allow typical web app functionality
      // Security tradeoff: allow-same-origin is required for most web apps to work
      // but it does allow the iframe content to access storage and potentially
      // make requests on behalf of the parent domain if they share origin.
      // Consider removing allow-same-origin if loading untrusted content.
      iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-downloads');
      
      content.appendChild(iframe);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder';
      placeholder.innerHTML = `
        <h3>No Web App URL Configured</h3>
        <p>Please configure a web app URL in the extension options.</p>
      `;
      
      const optionsBtn = document.createElement('button');
      optionsBtn.className = 'options-button';
      optionsBtn.textContent = 'Open Options';
      optionsBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
      });
      
      placeholder.appendChild(optionsBtn);
      content.appendChild(placeholder);
    }

    overlay.appendChild(resizeHandle);
    overlay.appendChild(header);
    overlay.appendChild(content);
    shadow.appendChild(overlay);
    
    overlayHost = host;
    shadowRoot = shadow;
    
    // Update pin button state
    updatePinButtonState();
    
    return { host, shadow };
  }

  /**
   * Updates the pin button visual state
   */
  function updatePinButtonState() {
    if (!shadowRoot) return;
    const pinButton = shadowRoot.querySelector('.pin-button');
    if (pinButton) {
      if (pinnedMode) {
        pinButton.classList.add('pinned');
        pinButton.title = 'Unpin from all sites';
      } else {
        pinButton.classList.remove('pinned');
        pinButton.title = 'Pin overlay to all sites';
      }
    }
  }

  /**
   * Toggle pin mode
   */
  function togglePinMode() {
    pinnedMode = !pinnedMode;
    updatePinButtonState();
    
    // Notify background script
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_PINNED_MODE', 
      pinned: pinnedMode 
    });
    
    // Save to storage
    chrome.storage.sync.set({ pinnedMode }, () => {
      if (chrome.runtime.lastError) {
        chrome.storage.local.set({ pinnedMode });
      }
    });
  }

  /**
   * Start resize operation
   */
  function startResize(e) {
    e.preventDefault();
    isResizing = true;
    
    const handle = e.target;
    handle.classList.add('active');
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
  }

  /**
   * Handle resize with requestAnimationFrame throttling
   */
  function handleResize(e) {
    if (!isResizing) return;
    
    // Cancel previous animation frame if exists
    if (resizeRAF) {
      cancelAnimationFrame(resizeRAF);
    }
    
    // Throttle with requestAnimationFrame for 60fps
    resizeRAF = requestAnimationFrame(() => {
      const viewportWidth = window.innerWidth;
      const rightEdge = viewportWidth - e.clientX;
      const newWidthPercent = (rightEdge / viewportWidth) * 100;
      
      // Constrain between min and max
      const constrainedWidth = Math.max(MIN_WIDTH_PERCENT, Math.min(MAX_WIDTH_PERCENT, newWidthPercent));
      
      overlayWidth = constrainedWidth;
      
      const overlay = shadowRoot.querySelector('.overlay');
      if (overlay) {
        overlay.style.width = `${overlayWidth}%`;
      }
    });
  }

  /**
   * Stop resize operation
   */
  function stopResize() {
    if (!isResizing) return;
    
    isResizing = false;
    
    const handle = shadowRoot.querySelector('.resize-handle');
    if (handle) {
      handle.classList.remove('active');
    }
    
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
    
    // Save width to storage
    chrome.storage.sync.set({ overlayWidth }, () => {
      if (chrome.runtime.lastError) {
        chrome.storage.local.set({ overlayWidth });
      }
    });
  }

  /**
   * Shows the overlay
   */
  function showOverlay() {
    if (overlayVisible) return;

    const { host, shadow } = createOverlay();
    
    if (!document.body.contains(host)) {
      document.body.appendChild(host);
    }
    
    // Show backdrop if enabled
    if (useBackdrop) {
      const backdrop = createBackdrop();
      if (!document.body.contains(backdrop)) {
        document.body.appendChild(backdrop);
      }
      // Force reflow
      backdrop.offsetHeight;
      backdrop.style.opacity = '1';
      backdrop.style.visibility = 'visible';
    }
    
    const overlay = shadow.querySelector('.overlay');
    // Force a reflow to enable CSS transition
    overlay.offsetHeight;
    overlay.classList.add('visible');
    
    overlayVisible = true;
    
    // Notify background script
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_OVERLAY_STATE', 
      visible: true 
    });
  }

  /**
   * Hides the overlay
   */
  function hideOverlay() {
    if (!overlayVisible || !shadowRoot) return;

    const overlay = shadowRoot.querySelector('.overlay');
    if (overlay) {
      overlay.classList.remove('visible');
    }
    
    // Hide backdrop
    const backdrop = document.getElementById(BACKDROP_ID);
    if (backdrop) {
      backdrop.style.opacity = '0';
      backdrop.style.visibility = 'hidden';
    }
    
    overlayVisible = false;
    
    // Notify background script
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_OVERLAY_STATE', 
      visible: false 
    });
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
      chrome.storage.sync.get([
        'webAppUrl', 
        'overlayEnabledByDefault', 
        'useBackdrop', 
        'pinnedModeDefault',
        'pinnedMode',
        'overlayWidth'
      ], (result) => {
        if (chrome.runtime.lastError) {
          // Fallback to local storage
          chrome.storage.local.get([
            'webAppUrl', 
            'overlayEnabledByDefault', 
            'useBackdrop', 
            'pinnedModeDefault',
            'pinnedMode',
            'overlayWidth'
          ], (localResult) => {
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
      useBackdrop = settings.useBackdrop || false;
      overlayWidth = settings.overlayWidth || 16.666;
      
      // Check if pinned mode is active
      pinnedMode = settings.pinnedMode || false;
      
      // If no pinned mode set yet, use the default from settings
      if (settings.pinnedMode === undefined && settings.pinnedModeDefault) {
        pinnedMode = true;
        chrome.storage.sync.set({ pinnedMode }, () => {
          if (chrome.runtime.lastError) {
            chrome.storage.local.set({ pinnedMode });
          }
        });
      }

      // Auto-show overlay if:
      // 1. Pinned mode is active, OR
      // 2. Enabled by default setting is on
      if ((pinnedMode || enabledByDefault) && webAppUrl) {
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
