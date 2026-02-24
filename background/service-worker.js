// Background service worker for Web App Reader Extension
// Handles extension action clicks and sends messages to content scripts

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
  }
  return true;
});

// Optional: Listen for installation/update events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Web App Reader Extension installed');
    // Set default values in storage if needed
    chrome.storage.sync.get(['webAppUrl', 'overlayEnabledByDefault'], (result) => {
      if (!result.webAppUrl) {
        // Set a default URL or leave empty
        chrome.storage.sync.set({
          webAppUrl: '',
          overlayEnabledByDefault: false
        });
      }
    });
  } else if (details.reason === 'update') {
    console.log('Web App Reader Extension updated');
  }
});
