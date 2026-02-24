# Web App Reader - Chrome Extension

A Chrome Extension (Manifest V3) that displays a configurable web app in an overlay panel on the right side of any webpage you visit.

## Features

- **Overlay Panel**: Fixed-position panel on the right side (16.666% width, 100% height)
- **Toggle Control**: Click the extension icon to show/hide the overlay
- **Configurable URL**: Set any web app URL in the options page
- **Auto-show Option**: Choose whether to show the overlay by default on new pages
- **Clean UI**: Minimal header bar with close button
- **Security**: Iframe sandboxing with configurable attributes

## Installation

### From Source

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the directory containing this extension's files
6. The Web App Reader icon should appear in your extensions toolbar

## Usage

### Initial Setup

1. Click the Web App Reader icon in the extensions toolbar
2. If no URL is configured, a placeholder message will appear
3. Click "Open Options" or right-click the extension icon and select "Options"
4. Enter a valid HTTP or HTTPS URL (e.g., `https://keep.google.com`)
5. Optionally enable "Show overlay by default when visiting pages"
6. Click "Save Settings"

### Using the Overlay

- **Show/Hide**: Click the extension icon in the toolbar
- **Close**: Click the × button in the overlay header
- **Resize**: The overlay automatically adjusts to 16.666% of viewport width (1/6)

### Example Web Apps to Try

- Google Keep: `https://keep.google.com`
- Notion: `https://www.notion.so`
- Trello: `https://trello.com`
- ChatGPT: `https://chat.openai.com`
- Any other web application with an HTTPS URL

## Project Structure

```
Web-app-reader-2/
├── manifest.json                 # Extension configuration (Manifest V3)
├── background/
│   └── service-worker.js        # Background service worker (handles icon clicks)
├── content-script.js            # Content script (injects overlay into pages)
├── overlay.css                  # Styles for the overlay panel
├── options.html                 # Options page UI
├── options.js                   # Options page logic
├── icons/
│   ├── icon16.png              # 16x16 icon
│   ├── icon48.png              # 48x48 icon
│   └── icon128.png             # 128x128 icon
└── README.md                    # This file
```

## Technical Details

### Manifest V3

This extension uses Manifest V3, the latest Chrome extension platform with:
- Service worker instead of background pages
- Improved security and performance
- Modern Chrome APIs

### Message Passing

- Background service worker listens for extension icon clicks
- Sends `{type: "TOGGLE_OVERLAY"}` message to active tab
- Content script receives message and toggles overlay visibility

### Storage

- Settings are saved to `chrome.storage.sync` (synced across devices)
- Falls back to `chrome.storage.local` if sync is unavailable
- Stored values:
  - `webAppUrl`: The web app URL to display
  - `overlayEnabledByDefault`: Whether to auto-show overlay

### Security Considerations

The iframe uses sandbox attributes to restrict capabilities:
```html
sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
```

**Security Tradeoffs**:
- `allow-same-origin`: Required for most web apps but allows iframe to access storage
- `allow-scripts`: Required for interactive web apps
- `allow-forms`: Allows form submission
- `allow-popups`: Allows opening new windows
- `allow-downloads`: Allows file downloads

⚠️ Only configure URLs from trusted sources as the iframe can execute scripts.

## Development

### Making Changes

1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Web App Reader extension
4. Test your changes

### Debugging

- **Background Script**: `chrome://extensions/` → Click "service worker" link
- **Content Script**: Open DevTools on any page → Console tab
- **Options Page**: Right-click options page → Inspect

## Browser Compatibility

- Chrome 88+ (Manifest V3 support)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers with MV3 support

## License

This project is open source and available for use and modification.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
