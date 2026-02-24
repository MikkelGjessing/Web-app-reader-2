# Web App Reader - Architecture Overview

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CHROME BROWSER                                  │
│                                                                          │
│  ┌────────────────┐                                                     │
│  │  Extension     │ 1. User clicks extension icon                       │
│  │  Action Icon   │───────────────────┐                                 │
│  └────────────────┘                   │                                 │
│                                        ▼                                 │
│  ┌──────────────────────────────────────────────────┐                   │
│  │  background/service-worker.js                    │                   │
│  │  ┌────────────────────────────────────────────┐  │                   │
│  │  │  chrome.action.onClicked.addListener()    │  │                   │
│  │  │  • Receives icon click event               │  │                   │
│  │  │  • Gets active tab                         │  │                   │
│  │  └────────────────────────────────────────────┘  │                   │
│  └──────────────────────────────────────────────────┘                   │
│                          │                                               │
│                          │ 2. Sends message: {type: "TOGGLE_OVERLAY"}   │
│                          ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  ACTIVE TAB (any website)                                        │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │  content-script.js (injected)                              │  │   │
│  │  │  ┌──────────────────────────────────────────────────────┐  │  │   │
│  │  │  │  chrome.runtime.onMessage.addListener()             │  │  │   │
│  │  │  │  • Receives TOGGLE_OVERLAY message                  │  │  │   │
│  │  │  │  • Calls toggleOverlay()                            │  │  │   │
│  │  │  └──────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                              │  │   │
│  │  │  3. Creates/shows overlay DOM                               │  │   │
│  │  │  ┌──────────────────────────────────────────────────────┐  │  │   │
│  │  │  │  <div id="web-app-reader-overlay">                  │  │  │   │
│  │  │  │    <div class="web-app-reader-header">              │  │  │   │
│  │  │  │      [Web App Reader] [×]                           │  │  │   │
│  │  │  │    </div>                                            │  │  │   │
│  │  │  │    <div class="web-app-reader-content">             │  │  │   │
│  │  │  │      <iframe src="https://configured-url.com"       │  │  │   │
│  │  │  │               sandbox="allow-scripts...">           │  │  │   │
│  │  │  │      </iframe>                                       │  │  │   │
│  │  │  │    </div>                                            │  │  │   │
│  │  │  │  </div>                                              │  │  │   │
│  │  │  └──────────────────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  │                                                                    │   │
│  │  Page Content ◄──────────────── Overlay (16.666% width) ────────►│   │
│  │  (83.334%)                       (slides from right)             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────────────────────────────────────┐                 │
│  │  options.html + options.js                         │                 │
│  │  ┌──────────────────────────────────────────────┐  │                 │
│  │  │  [Web App URL: ____________________]        │  │                 │
│  │  │  [✓] Show overlay by default                │  │                 │
│  │  │  [Save Settings]  [Reset]                   │  │                 │
│  │  └──────────────────────────────────────────────┘  │                 │
│  │                  │                                  │                 │
│  │                  │ chrome.storage.sync.set()        │                 │
│  │                  ▼                                  │                 │
│  │  ┌──────────────────────────────────────────────┐  │                 │
│  │  │  Chrome Storage                              │  │                 │
│  │  │  {                                            │  │                 │
│  │  │    webAppUrl: "https://...",                 │  │                 │
│  │  │    overlayEnabledByDefault: false            │  │                 │
│  │  │  }                                            │  │                 │
│  │  └──────────────────────────────────────────────┘  │                 │
│  └────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Initialization Flow
```
1. Extension loads
   ├─> manifest.json defines content_scripts
   ├─> content-script.js injected into all pages
   ├─> overlay.css injected into all pages
   └─> background/service-worker.js starts

2. Content script initialization
   ├─> Loads settings from chrome.storage
   ├─> Reads webAppUrl and overlayEnabledByDefault
   └─> Auto-shows overlay if enabled by default
```

### Toggle Flow
```
User clicks extension icon
    ↓
background/service-worker.js: chrome.action.onClicked event
    ↓
Send message to active tab: {type: "TOGGLE_OVERLAY"}
    ↓
content-script.js: chrome.runtime.onMessage listener
    ↓
toggleOverlay() function
    ↓
    ├─ if hidden: showOverlay()
    │   ├─> Create overlay DOM if not exists
    │   ├─> Add to document.body
    │   ├─> Add "visible" class (CSS transition)
    │   └─> overlayVisible = true
    │
    └─ if visible: hideOverlay()
        ├─> Remove "visible" class (CSS transition)
        └─> overlayVisible = false
```

### Settings Flow
```
User opens options page
    ↓
options.js loads: chrome.storage.sync.get()
    ↓
Display current settings in form
    ↓
User modifies settings and clicks Save
    ↓
Validate URL (HTTP/HTTPS only)
    ↓
Save to chrome.storage.sync.set()
    ↓
Storage syncs across devices (if signed in)
    ↓
Content scripts load new settings on next page load
```

## File Responsibilities

### manifest.json
- Defines extension metadata (name, version, description)
- Declares permissions (storage, activeTab)
- Configures service worker
- Registers content scripts
- Specifies extension action and icons

### background/service-worker.js
- Listens for extension icon clicks
- Manages extension lifecycle events
- Sends messages to content scripts
- Opens options page on request
- Initializes default storage values

### content-script.js
- Injects overlay DOM into pages
- Manages overlay visibility state
- Handles toggle messages
- Loads settings from storage
- Creates iframe with configured URL
- Shows placeholder if URL not configured

### overlay.css
- Styles overlay container (fixed position, right side)
- Defines header bar and close button styles
- Handles iframe container styling
- Provides smooth transitions
- Ensures high z-index for overlay

### options.html + options.js
- Provides settings UI
- Validates URL input
- Saves/loads from chrome.storage
- Shows success/error messages
- Resets to defaults

## Key Design Decisions

1. **Content Script Injection**: Runs on all URLs (`<all_urls>`) to ensure overlay available everywhere
2. **Storage**: Uses `chrome.storage.sync` with fallback to `local` for cross-device sync
3. **Message Passing**: Simple {type: "..."} pattern for clear routing
4. **Overlay Position**: Fixed right side to avoid layout shift
5. **Z-Index**: Maximum safe value (2147483647) to ensure overlay is always on top
6. **Sandbox**: Allows scripts/forms/same-origin for web app functionality
7. **No Frameworks**: Pure JavaScript for minimal size and dependencies
8. **Responsive**: Adjusts width on smaller screens (33% on tablet, 100% on mobile)

## Security Considerations

### Iframe Sandbox
- `allow-scripts`: Required for interactive web apps
- `allow-forms`: Required for form submission
- `allow-same-origin`: Required for storage access (⚠️ reduces protection)
- `allow-popups`: Required for opening new windows
- `allow-downloads`: Required for file downloads

### Risks
- Malicious web app could access parent page storage
- XSS if untrusted URL configured
- Data exfiltration through iframe

### Mitigations
- URL validation (HTTP/HTTPS only)
- Clear security warnings in UI and docs
- Recommendation to only use trusted sources
- User explicitly configures URL (no automatic loading)
