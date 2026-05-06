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
  let api = browser?.experiments?.zen_spaces;

  if (!api) {
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

console.log('[Zen Tab Organizer] Background script loaded');
