# Zen Tab Organizer Extension

A Firefox/Zen Browser extension that automatically organizes tabs into spaces based on user-defined regex patterns.

## Current Status

**Minimum Test Version** - The extension currently:
- ✅ Logs "opened tab <URL>" to the browser console when a new tab is created
- ✅ Has a popup UI for managing regex rules (frontend only, no action yet)
- ⏳ Next: Implement the actual space-switching logic once Zen Browser API is confirmed

## Installation (Testing)

### For Zen Browser:
1. Open Zen Browser
2. Go to `about:debugging#/runtime/this-firefox` (or similar Firefox debug page)
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from this folder
5. The extension will load temporarily (until browser restart)

### For Firefox:
Same process as Zen Browser since Zen is Firefox-based.

## Usage

### Testing Tab Logging
1. Open DevTools Console (F12 → Console tab)
2. Open a new tab
3. You should see: `[Zen Tab Organizer] opened tab: https://example.com`

### Managing Rules (UI Ready)
1. Click the extension icon in the toolbar
2. Enter a regex pattern (e.g., `github\.com`)
3. Enter a space name (e.g., `Work`)
4. Click "Add"
5. Rules are saved to browser storage

## Configuration Format

Rules are stored in browser storage as:
```json
{
  "rules": [
    { "pattern": "github\\.com", "space": "Work" },
    { "pattern": "youtube\\.com", "space": "Entertainment" }
  ]
}
```

## Next Steps

1. **Confirm Zen Browser API**: Research how Zen Browser handles "spaces" (tabs groups? workspaces? something custom?)
2. **Implement Matching Logic**: Add regex matching in `background.js`
3. **Implement Space Assignment**: Call appropriate Zen/Firefox API to move tabs to spaces
4. **Add Options Page**: Create a dedicated settings page for more advanced configuration
5. **Add Error Handling**: Handle invalid URLs, special tabs (about:, extensions, etc.)

## Files

- `manifest.json` - Extension manifest (permissions, entry points)
- `background.js` - Service worker that listens for tab events
- `popup.html` - UI for managing rules
- `popup.js` - Logic for rule management UI
- `README.md` - This file

## Browser Compatibility

- ✅ Zen Browser (Firefox-based)
- ✅ Firefox 109+
- ✅ Should work on any Chromium browser with minor changes (URL scheme differences)
