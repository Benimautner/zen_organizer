try {
  var { ExtensionCommon } = ChromeUtils.importESModule(
    "resource://gre/modules/ExtensionCommon.sys.mjs"
  );
  var { Services } = ChromeUtils.importESModule(
    "resource://gre/modules/Services.sys.mjs"
  );
  console.log("[zenSpaces] Imports successful");
} catch (e) {
  console.error("[zenSpaces] Failed to import modules:", e);
  throw e;
}

function getBrowserWindow() {
  try {
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    if (!window) {
      throw new Error("No browser window is available");
    }
    if (!window.gZenWorkspaces) {
      console.warn("[zenSpaces] window.gZenWorkspaces not available on this window");
      console.warn("[zenSpaces] window keys:", Object.keys(window).filter(k => k.startsWith('g')).slice(0, 20));
      throw new Error("Zen workspaces (gZenWorkspaces) are not available in this window");
    }
    if (!window.gZenWindowSync) {
      console.warn("[zenSpaces] window.gZenWindowSync not available on this window");
      throw new Error("Zen window sync (gZenWindowSync) are not available in this window");
    }
    return window;
  } catch (e) {
    console.error("[zenSpaces] getBrowserWindow error:", e);
    throw e;
  }
}

function toSpaceInfo(space, activeSpaceId) {
  return {
    id: space.uuid,
    name: space.name,
    active: space.uuid === activeSpaceId,
  };
}

class zenSpaces extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    console.log("[zenSpaces] getAPI called with context");
    return {
      zenSpaces: {
        async listSpaces() {
          console.log("[zenSpaces] listSpaces called");
          const window = getBrowserWindow();
          await window.gZenWorkspaces.promiseInitialized;
          const activeSpaceId = window.gZenWorkspaces.activeWorkspace;
          return window.gZenWorkspaces
            .getWorkspaces(true)
            .map(space => toSpaceInfo(space, activeSpaceId));
        },

        async getActiveSpace() {
          console.log("[zenSpaces] getActiveSpace called");
          const window = getBrowserWindow();
          await window.gZenWorkspaces.promiseInitialized;
          const activeSpace = window.gZenWorkspaces.getActiveWorkspaceFromCache();
          if (!activeSpace) {
            throw new Error("No active workspace is available");
          }
          return toSpaceInfo(activeSpace, activeSpace.uuid);
        },

        async moveTabToWorkspace(tabId, workspaceId) {
          console.log("[zenSpaces] moveTabToWorkspace called with", tabId, workspaceId);
          const window = getBrowserWindow();
          await window.gZenWorkspaces.promiseInitialized;
          const tab = window.gZenWindowSync.getItemFromWindow(window, tabId);
          if (!tab) {
            throw new Error(`Unable to find tab ${tabId}`);
          }

          const moved = window.gZenWorkspaces.moveTabToWorkspace(tab, workspaceId);
          if (!moved) {
            throw new Error(`Failed to move tab ${tabId} to workspace ${workspaceId}`);
          }
          return true;
        },

        async changeWorkspace(workspaceId) {
          console.log("[zenSpaces] changeWorkspace called with", workspaceId);
          const window = getBrowserWindow();
          await window.gZenWorkspaces.promiseInitialized;
          await window.gZenWorkspaces.changeWorkspaceWithID(workspaceId);
          return true;
        },
      },
    };
  }
}

try {
  this.zenSpaces = zenSpaces;
  console.log("[zenSpaces] API exported successfully");
} catch (e) {
  console.error("[zenSpaces] Failed to export API:", e);
  throw e;
}