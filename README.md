# Zen Tab Organizer Extension

A Firefox/Zen Browser extension that automatically organizes tabs into spaces based on user-defined regex patterns.

## Installation (Testing)

### For Zen Browser:
0. Before doing anything, review the code. It requires you to give it *full* permission to your browser - it won't be sandboxed. Use it at your own risk. AI was also involved in generating some of the code.
1. Go to [about:config](about:config), set `extensions.experiments.enabled` to true and `xpinstall.signatures.required` to false.
2. Go to the Releases page and download the xpi.
3. Go to [about:addons](about:addons),  and load the downloaded file.

## Build it yourself
Browser extensions aren't built, they are just renamed zip files. Therefore you can just run `make build` to generate a zip file yourself.

## Usage
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