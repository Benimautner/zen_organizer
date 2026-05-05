// In the addon_parent scope the globals `ExtensionAPI` and `Services` are
// usually provided by the host environment (see firefox-bridge example). Do
// not attempt an ES module import here because it can fail when loaded from
// the XPI/jar context. Prefer the existing globals and log if they're
// unavailable.
if (typeof Services === 'undefined') {
  console.warn('[zenSpaces] global Services is not defined in this scope');
} else {
  console.log('[zenSpaces] Services global is available');
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

function resolveWorkspaceByName(workspaces, workspaceName) {
  if (!Array.isArray(workspaces) || !workspaceName) {
    return null;
  }

  const normalizedName = String(workspaceName).trim().toLowerCase();
  return (
    workspaces.find(workspace => String(workspace?.name || '').trim().toLowerCase() === normalizedName) ||
    workspaces.find(workspace => String(workspace?.uuid || '').trim().toLowerCase() === normalizedName) ||
    null
  );
}

this.experiments_zen_spaces = class extends ExtensionAPI {
  getAPI(context) {
    console.log("[zenSpaces] getAPI called with context");

    function resolveNativeTabFromWebExtensionId(tabDescriptor) {
      const extensionTabId =
        typeof tabDescriptor === 'number'
          ? tabDescriptor
          : (tabDescriptor && typeof tabDescriptor === 'object' && typeof tabDescriptor.id === 'number'
              ? tabDescriptor.id
              : null);

      if (extensionTabId === null) {
        return null;
      }

      const managers = [
        context?.tabManager,
        context?.extension?.tabManager,
      ];

      for (const manager of managers) {
        if (!manager || typeof manager.get !== 'function') {
          continue;
        }
        try {
          const managedTab = manager.get(extensionTabId);
          if (managedTab?.nativeTab) {
            return managedTab.nativeTab;
          }
          if (managedTab?.tab) {
            return managedTab.tab;
          }
          if (managedTab && managedTab.localName === 'tab') {
            return managedTab;
          }
        } catch (e) {
          // try next manager
        }
      }

      return null;
    }

    return {
      experiments: {
        zen_spaces: {
        async listSpaces() {
          try {
            console.log("[zenSpaces] listSpaces called");
            const window = getBrowserWindow();
            await window.gZenWorkspaces.promiseInitialized;
            const activeSpaceId = window.gZenWorkspaces.activeWorkspace;
            return window.gZenWorkspaces
              .getWorkspaces(true)
              .map(space => toSpaceInfo(space, activeSpaceId));
          } catch (e) {
            console.error('[zenSpaces] listSpaces error:', e);
            throw e;
          }
        },

        async getActiveSpace() {
          try {
            console.log("[zenSpaces] getActiveSpace called");
            const window = getBrowserWindow();
            await window.gZenWorkspaces.promiseInitialized;
            const activeSpace = window.gZenWorkspaces.getActiveWorkspaceFromCache();
            if (!activeSpace) {
              throw new Error("No active workspace is available");
            }
            return toSpaceInfo(activeSpace, activeSpace.uuid);
          } catch (e) {
            console.error('[zenSpaces] getActiveSpace error:', e);
            throw e;
          }
        },

        async moveTabToWorkspace(tabDescriptor, workspaceId) {
          try {
            console.log("[zenSpaces] moveTabToWorkspace called with", tabDescriptor, workspaceId);
            const window = getBrowserWindow();
            await window.gZenWorkspaces.promiseInitialized;

            let tabElement = resolveNativeTabFromWebExtensionId(tabDescriptor);

            if (tabElement) {
              console.log('[zenSpaces] Resolved native tab via tabManager mapping', tabElement);
            }

            // If caller provided an object with a URL or title, try to locate the DOM tab
            const seenTabs = [];
            if (!tabElement && tabDescriptor && typeof tabDescriptor === 'object' && (tabDescriptor.url || tabDescriptor.title)) {
              const targetUrl = tabDescriptor.url;
              const targetTitle = tabDescriptor.title && String(tabDescriptor.title).toLowerCase();
              for (const t of window.gBrowser.tabs) {
                try {
                  const lb = t.linkedBrowser;
                  const current = lb && lb.currentURI && lb.currentURI.spec;
                  const label = (t.label || t.getAttribute && t.getAttribute('label') || '').toString();
                  const candidate = { id: t.id, current, label };
                  seenTabs.push(candidate);

                  if (targetUrl && current) {
                    if (current === targetUrl || current.startsWith(targetUrl) || targetUrl.startsWith(current)) {
                      tabElement = t;
                      break;
                    }
                    // Compare origins as a fallback
                    try {
                      const u1 = new URL(current);
                      const u2 = new URL(targetUrl);
                      if (u1.origin === u2.origin) {
                        tabElement = t;
                        break;
                      }
                    } catch (e) {
                      // ignore URL parse errors
                    }
                  }

                  if (!tabElement && targetTitle && label) {
                    if (label.toLowerCase().includes(targetTitle) || targetTitle.includes(label.toLowerCase())) {
                      tabElement = t;
                      break;
                    }
                  }
                } catch (e) {
                  // ignore per-tab inspect errors
                }
              }
            }

            // Fallback: if a string/number id was provided, try the original DOM id lookup
            if (!tabElement) {
              const id = typeof tabDescriptor === 'object' ? String(tabDescriptor.id) : String(tabDescriptor);
              // If id looks numeric, it won't match internal string ids like "1777988003562-37"; try both forms
              tabElement = window.gZenWindowSync.getItemFromWindow(window, id) || window.gZenWindowSync.getItemFromWindow(window, `tab-${id}`) || null;
            }

            if (!tabElement) {
              console.warn('[zenSpaces] tab lookup failed; seenTabs:', seenTabs.slice(0,50));
            }

            if (!tabElement) {
              throw new Error(`Unable to find tab ${JSON.stringify(tabDescriptor)}`);
            }

            const workspaces = window.gZenWorkspaces.getWorkspaces(true);
            const workspaceObject = resolveWorkspaceByName(workspaces, workspaceId);

            if (!workspaceObject) {
              console.warn('[zenSpaces] Available workspaces:', workspaces.map(workspace => ({ name: workspace.name, uuid: workspace.uuid })));
              throw new Error(`Unable to find workspace ${workspaceId}`);
            }

            console.log('[zenSpaces] Resolved workspace object:', {
              name: workspaceObject.name,
              uuid: workspaceObject.uuid,
            });

            const moved = window.gZenWorkspaces.moveTabToWorkspace(tabElement, workspaceObject);
            if (!moved) {
              throw new Error(`Failed to move tab to workspace ${workspaceId}`);
            }

            await window.gZenWorkspaces.changeWorkspace(workspaceObject);
            console.log('[zenSpaces] Switched to workspace:', workspaceObject.name);

            const targetWindow = tabElement.ownerGlobal || window;
            if (targetWindow?.gBrowser && tabElement) {
              targetWindow.gBrowser.selectedTab = tabElement;
              if (typeof tabElement.focus === 'function') {
                tabElement.focus();
              }
              console.log('[zenSpaces] Focused moved tab');
            }
            return true;
          } catch (e) {
            console.error('[zenSpaces] moveTabToWorkspace error:', e);
            throw e;
          }
        },

        async changeWorkspace(workspaceId) {
          try {
            console.log("[zenSpaces] changeWorkspace called with", workspaceId);
            const window = getBrowserWindow();
            await window.gZenWorkspaces.promiseInitialized;
            await window.gZenWorkspaces.changeWorkspaceWithID(workspaceId);
            return true;
          } catch (e) {
            console.error('[zenSpaces] changeWorkspace error:', e);
            throw e;
          }
        },
        // Diagnostic test: return whether gZenWorkspaces is present and some quick info
        async testWindowAccess() {
          try {
            console.log('[zenSpaces] testWindowAccess called');
            const win = Services.wm.getMostRecentWindow('navigator:browser');
            if (!win) {
              return { found: false, message: 'No browser window' };
            }
            const hasG = !!win.gZenWorkspaces;
            const keys = Object.keys(win).filter(k => k.startsWith('g')).slice(0, 50);
            return { found: hasG, windowKeys: keys };
          } catch (e) {
            console.error('[zenSpaces] testWindowAccess error:', e);
            return { found: false, error: String(e) };
          }
        },
        },
      },
    };
  }
};

try {
  console.log("[zenSpaces] API class defined and exported as experiments_zen_spaces");
} catch (e) {
  console.error("[zenSpaces] Failed during export logging:", e);
  throw e;
}