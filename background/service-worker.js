// Background service worker for Web App Reader Extension
// Handles extension action clicks and sends messages to content scripts

// Track pinned state and overlay state per tab
let pinnedMode = false;
let tabOverlayState = {}; // Map of tabId -> isVisible

/**
 * Load pinned mode state from storage
 */
async function loadPinnedState() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['pinnedMode'], (result) => {
      if (chrome.runtime.lastError) {
        chrome.storage.local.get(['pinnedMode'], (localResult) => {
          resolve(localResult.pinnedMode || false);
        });
      } else {
        resolve(result.pinnedMode || false);
      }
    });
  });
}

/**
 * Initialize pinned mode on startup
 */
async function initPinnedMode() {
  pinnedMode = await loadPinnedState();
}

// Listen for extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Send message to the active tab to toggle the overlay
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
  } catch (error) {
    console.error('Error sending message to tab:', error);
    // If content script is not loaded yet, we can't send the message
    // This might happen on restricted pages like chrome:// URLs
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  } else if (message.type === 'UPDATE_PINNED_MODE') {
    pinnedMode = message.pinned;
    // Save to storage
    chrome.storage.sync.set({ pinnedMode }, () => {
      if (chrome.runtime.lastError) {
        chrome.storage.local.set({ pinnedMode });
      }
    });
    sendResponse({ success: true });
  } else if (message.type === 'GET_PINNED_MODE') {
    sendResponse({ pinned: pinnedMode });
  } else if (message.type === 'UPDATE_OVERLAY_STATE') {
    // Track overlay state per tab
    if (sender.tab) {
      tabOverlayState[sender.tab.id] = message.visible;
    }
    sendResponse({ success: true });
  }
  return true;
});

// Clean up tab state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabOverlayState[tabId];
});

// Optional: Listen for installation/update events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Web App Reader Extension installed');
    // Set default values in storage if needed
    chrome.storage.sync.get(['webAppUrl', 'overlayEnabledByDefault', 'useBackdrop', 'pinnedModeDefault', 'overlayWidth'], (result) => {
      const defaults = {};
      if (!result.webAppUrl) defaults.webAppUrl = '';
      if (result.overlayEnabledByDefault === undefined) defaults.overlayEnabledByDefault = false;
      if (result.useBackdrop === undefined) defaults.useBackdrop = false;
      if (result.pinnedModeDefault === undefined) defaults.pinnedModeDefault = false;
      if (!result.overlayWidth) defaults.overlayWidth = 16.666;
      
      if (Object.keys(defaults).length > 0) {
        chrome.storage.sync.set(defaults);
      }
    });
    
    initPinnedMode();
  } else if (details.reason === 'update') {
    console.log('Web App Reader Extension updated');
    initPinnedMode();
  }
});

// Initialize on startup
initPinnedMode();
