// Default target space
const DEFAULT_SPACE = 'Fsinf';

// Track the last URL processed per tab so redirects can re-evaluate regex rules
const processedTabUrls = new Map();

async function getRulesFromStorage() {
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    const result = await browser.storage.local.get('rules');
    return Array.isArray(result?.rules) ? result.rules : [];
  }

  return await new Promise((resolve, reject) => {
    chrome.storage.local.get('rules', (result) => {
      const lastError = chrome.runtime && chrome.runtime.lastError;
      if (lastError) {
        reject(lastError);
        return;
      }

      resolve(Array.isArray(result?.rules) ? result.rules : []);
    });
  });
}

async function moveTabToZenSpace(tabId, workspaceId) {
  console.log('[Zen Tab Organizer] moveTabToZenSpace called');
  // Support multiple possible registration points for the experiment API
  const apiCandidates = [
    browser?.zenSpaces,
    browser?.experiments?.zen_spaces,
    browser?.experiments?.zenSpaces,
    browser?.experiments?.zen_spaces,
  ];
  let api = null;
  for (const candidate of apiCandidates) {
    if (candidate && typeof candidate.moveTabToWorkspace === 'function') {
      api = candidate;
      break;
    }
  }

  if (!api) {
    console.log('[Zen Tab Organizer] Available top-level APIs:', Object.keys(browser || {}).filter(k => !k.startsWith('_')).slice(0, 40));
    console.log('[Zen Tab Organizer] Available experiments keys:', Object.keys(browser?.experiments || {}));
    throw new Error('[Zen Tab Organizer] No usable zenSpaces experiment API found');
  }

  console.log('[Zen Tab Organizer] Using Zen bridge API to move tab to workspace');
  return await api.moveTabToWorkspace(tabId, workspaceId);
}

// Listen for tab updates - this is when URL becomes available
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    console.log(`[Zen Tab Organizer] onUpdated fired for tab ${tabId}`, changeInfo);

    // Only process when we have a URL, and re-process if it changed
    if (!changeInfo.url) {
      return;
    }

    const currentUrl = changeInfo.url;
    if (processedTabUrls.get(tabId) === currentUrl) {
      return;
    }

    console.log(`[Zen Tab Organizer] opened tab: ${currentUrl}`);

    // Record the URL we last handled for this tab
    processedTabUrls.set(tabId, currentUrl);

    // Dump full context for debugging on first 3 tabs
    if (processedTabUrls.size <= 3) {
      console.log('[Zen Tab Organizer] ===== TAB CONTEXT DUMP =====');
      console.log('[Zen Tab Organizer] Tab object:', tab);
      console.log('[Zen Tab Organizer] Tab ID:', tabId);
      console.log('[Zen Tab Organizer] Tab URL:', currentUrl);
      console.log('[Zen Tab Organizer] Tab groupId:', tab.groupId);
      console.log('[Zen Tab Organizer] changeInfo:', changeInfo);
      console.log('[Zen Tab Organizer] ===== END DUMP =====');
    }

    console.log('[Zen Tab Organizer] About to load rules from storage');
    const rules = await getRulesFromStorage();
    console.log('[Zen Tab Organizer] Loaded rules:', rules);
    let targetSpace = null;

    // Match URL against rules
    if (rules.length > 0 && currentUrl && !currentUrl.startsWith('about:')) {
      for (const rule of rules) {
        try {
          const regex = new RegExp(rule.pattern);
          if (regex.test(currentUrl)) {
            targetSpace = rule.space;
            console.log(`[Zen Tab Organizer] matched rule: ${rule.pattern} → ${rule.space}`);
            break;
          }
        } catch (e) {
          console.error(`[Zen Tab Organizer] invalid regex: ${rule.pattern}`, e);
        }
      }
    }
    if(!targetSpace) return;

    console.log(`[Zen Tab Organizer] Calling moveTabToZenSpace(${tabId}, ${targetSpace})`);
    let tabDescriptor = tabId;
    try {
      const tabInfo = await browser.tabs.get(tabId);
      tabDescriptor = { id: tabId, url: tabInfo.url, title: tabInfo.title };
    } catch (e) {
      console.warn('[Zen Tab Organizer] Could not fetch tab details; falling back to numeric tab id:', e);
    }

    await moveTabToZenSpace(tabDescriptor, targetSpace);
  } catch (error) {
    console.error('[Zen Tab Organizer] Listener failed before moveTabToSpace ran:', error);
  }
});

// DEPRECATED: Tab-group fallback removed. Use browser.zenSpaces only.
async function moveTabToSpace_DEPRECATED(tabId, spaceName, url) {
  try {
    console.log(`[Zen Tab Organizer] Moving tab ${tabId} (${url}) to space: ${spaceName}`);

    // Get all existing tab groups
    try {
      const groups = await chrome.tabGroups.query({});
      console.log('[Zen Tab Organizer] Available tab groups:', groups.map(g => ({ id: g.id, title: g.title })));

      // Find group matching space name
      let targetGroup = groups.find(g => g.title === spaceName);

      if (!targetGroup) {
        console.warn(`[Zen Tab Organizer] Space "${spaceName}" not found. Creating it now.`);
        const createdGroupId = await chrome.tabs.group({ tabIds: tabId });
        await chrome.tabGroups.update(createdGroupId, { title: spaceName });
        console.log(`[Zen Tab Organizer] ✓ Created and renamed group ${createdGroupId} to "${spaceName}"`);
        return;
      }

      // Move tab to group
      console.log(`[Zen Tab Organizer] Found group: ${targetGroup.title} (ID: ${targetGroup.id})`);
      await chrome.tabs.group({ tabIds: tabId, groupId: targetGroup.id });
      console.log(`[Zen Tab Organizer] ✓ Successfully moved tab ${tabId} to group "${spaceName}"`);
      return;
    } catch (groupError) {
      console.error('[Zen Tab Organizer] Error with tabGroups API:', groupError);
    }

    // Fallback: Try using browser.tabGroups (might be a getter)
    if (typeof browser !== 'undefined' && browser.tabGroups) {
      try {
        const groups = await browser.tabGroups.query({});
        console.log('[Zen Tab Organizer] (Firefox API) Available tab groups:', groups.map(g => ({ id: g.id, title: g.title })));

        let targetGroup = groups.find(g => g.title === spaceName);
        if (!targetGroup) {
          console.warn(`[Zen Tab Organizer] Space "${spaceName}" not found. Creating it now.`);
          const createdGroupId = await browser.tabs.group({ tabIds: tabId });
          await browser.tabGroups.update(createdGroupId, { title: spaceName });
          console.log(`[Zen Tab Organizer] ✓ (Firefox API) Created and renamed group ${createdGroupId} to "${spaceName}"`);
          return;
        }

        await browser.tabs.group({ tabIds: tabId, groupId: targetGroup.id });
        console.log(`[Zen Tab Organizer] ✓ (Firefox API) Moved tab to group "${spaceName}"`);
        return;
      } catch (e) {
        console.error('[Zen Tab Organizer] Firefox tabGroups API also failed:', e);
      }
    }

    console.error('[Zen Tab Organizer] No working space API found');
  } catch (error) {
    console.error(`[Zen Tab Organizer] Unexpected error moving tab:`, error);
  }
}

console.log('[Zen Tab Organizer] Background script loaded');

// Diagnostic runner: call experiment test and log results
async function runZenTest() {
  try {
    const api =
      (typeof browser !== 'undefined' &&
        (browser.zenSpaces || browser.experiments?.zen_spaces || browser.experiments?.zenSpaces || browser.experiments?.zen_spaces)) ||
      null;
    if (!api) {
      console.warn('[Zen Tab Organizer] No experiment API object available (checked zenSpaces and experiments.zen_spaces)');
      return;
    }
    if (typeof api.testWindowAccess !== 'function') {
      console.warn('[Zen Tab Organizer] experiment API loaded but testWindowAccess() is not present');
      return;
    }

    console.log('[Zen Tab Organizer] Running zenSpaces.testWindowAccess()');
    const res = await api.testWindowAccess();
    console.log('[Zen Tab Organizer] zenSpaces.testWindowAccess result:', res);
  } catch (e) {
    console.error('[Zen Tab Organizer] runZenTest error:', e);
  }
}

// Run at startup
runZenTest();

// Also run when user clicks the browser action
if (typeof browser !== 'undefined' && browser.browserAction && browser.browserAction.onClicked) {
  try {
    browser.browserAction.onClicked.addListener(() => runZenTest());
  } catch (e) {
    console.warn('[Zen Tab Organizer] Failed to register browserAction click listener:', e);
  }
}
