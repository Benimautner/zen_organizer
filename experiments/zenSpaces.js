function getBrowserWindow() {
  const window = Services.wm.getMostRecentWindow("navigator:browser");
  if (!window) {
    throw new Error("No browser window is available");
  }
  return window;
}

function resolveWorkspaceByName(workspaces, workspaceName) {
  if (!Array.isArray(workspaces) || !workspaceName) {
    return null;
  }

  const normalizedName = String(workspaceName).trim().toLowerCase();
  return (
    workspaces.find(
      (workspace) =>
        String(workspace?.name || "")
          .trim()
          .toLowerCase() === normalizedName,
    ) ||
    workspaces.find(
      (workspace) =>
        String(workspace?.uuid || "")
          .trim()
          .toLowerCase() === normalizedName,
    ) ||
    null
  );
}

this.experiments_zen_spaces = class extends ExtensionAPI {
  getAPI(context) {
    console.log("[zenSpaces] getAPI called with context");

    function resolveNativeTabFromWebExtensionId(tabDescriptor) {
      const extensionTabId = tabDescriptor.id;

      if (extensionTabId === null) {
        return null;
      }
      return context?.extension?.tabManager.get(extensionTabId).nativeTab;
    }

    return {
      experiments: {
        zen_spaces: {
          async moveTabToWorkspace(tabDescriptor, workspaceId) {
            try {
              console.log(
                "[zenSpaces] moveTabToWorkspace called with",
                tabDescriptor,
                workspaceId,
              );
              const window = getBrowserWindow();
              await window.gZenWorkspaces.promiseInitialized;

              let tabElement =
                resolveNativeTabFromWebExtensionId(tabDescriptor);

              const workspaces = window.gZenWorkspaces.getWorkspaces(true);
              const workspaceObject = resolveWorkspaceByName(
                workspaces,
                workspaceId,
              );

              if (!workspaceObject) {
                console.warn(
                  "[zenSpaces] Available workspaces:",
                  workspaces.map((workspace) => ({
                    name: workspace.name,
                    uuid: workspace.uuid,
                  })),
                );
                throw new Error(`Unable to find workspace ${workspaceId}`);
              }

              console.log("[zenSpaces] Resolved workspace object:", {
                name: workspaceObject.name,
                uuid: workspaceObject.uuid,
              });

              const moved = window.gZenWorkspaces.moveTabToWorkspace(
                tabElement,
                workspaceObject,
              );
              if (!moved) {
                throw new Error(
                  `Failed to move tab to workspace ${workspaceId}`,
                );
              }

              await window.gZenWorkspaces.changeWorkspace(workspaceObject);
              console.log(
                "[zenSpaces] Switched to workspace:",
                workspaceObject.name,
              );

              const targetWindow = tabElement.ownerGlobal || window;
              if (targetWindow?.gBrowser && tabElement) {
                targetWindow.gBrowser.selectedTab = tabElement;
                if (typeof tabElement.focus === "function") {
                  tabElement.focus();
                }
                console.log("[zenSpaces] Focused moved tab");
              }
              return true;
            } catch (e) {
              console.error("[zenSpaces] moveTabToWorkspace error:", e);
              throw e;
            }
          },
        },
      },
    };
  }
};
