function setStatus(message, isError = false) {
  const status = document.getElementById('status');
  if (!status) {
    return;
  }
  status.textContent = message;
  status.style.color = isError ? '#ff8a80' : '#9bd1ff';
}

function normalizeRules(rawRules) {
  if (!Array.isArray(rawRules)) {
    throw new Error('Rules JSON must be an array');
  }

  return rawRules.map((rule, index) => {
    if (!rule || typeof rule !== 'object') {
      throw new Error(`Rule at index ${index} must be an object`);
    }

    const pattern = String(rule.pattern || '').trim();
    const space = String(rule.space || '').trim();
    if (!pattern || !space) {
      throw new Error(`Rule at index ${index} must include pattern and space`);
    }

    new RegExp(pattern);
    return { pattern, space };
  });
}

async function getRules() {
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

async function saveRules(rules) {
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    await browser.storage.local.set({ rules });
    return;
  }

  return await new Promise((resolve, reject) => {
    chrome.storage.local.set({ rules }, () => {
      const lastError = chrome.runtime && chrome.runtime.lastError;
      if (lastError) {
        reject(lastError);
        return;
      }

      resolve();
    });
  });
}

// Load and display rules
async function loadRules() {
  const rules = await getRules();
  const container = document.getElementById('rulesContainer');
  const jsonInput = document.getElementById('jsonInput');

  if (jsonInput) {
    jsonInput.value = JSON.stringify(rules, null, 2);
  }

  if (rules.length === 0) {
    container.innerHTML = '<div class="empty-state">No rules configured yet</div>';
    return;
  }

  container.innerHTML = rules.map((rule, index) => `
    <div class="rule">
      <div class="rule-pattern">/${rule.pattern}/</div>
      <div class="rule-space">${rule.space}</div>
      <button class="delete-btn" data-index="${index}">Delete</button>
    </div>
  `).join('');

  // Attach delete listeners
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => deleteRule(parseInt(e.target.dataset.index)));
  });
}

// Add a new rule
async function addRule() {
  const pattern = document.getElementById('patternInput').value.trim();
  const space = document.getElementById('spaceInput').value.trim();

  if (!pattern || !space) {
    alert('Please enter both a pattern and a space name');
    return;
  }

  // Validate regex
  try {
    new RegExp(pattern);
  } catch (e) {
    alert(`Invalid regex pattern: ${e.message}`);
    return;
  }

  const rules = await getRules();
  rules.push({ pattern, space });
  await saveRules(rules);

  document.getElementById('patternInput').value = '';
  document.getElementById('spaceInput').value = '';
  setStatus('Rule added');
  loadRules();
}

// Delete a rule
async function deleteRule(index) {
  const rules = await getRules();
  rules.splice(index, 1);
  await saveRules(rules);
  setStatus('Rule deleted');
  loadRules();
}

async function importRulesFromJson() {
  const jsonInput = document.getElementById('jsonInput');
  try {
    const parsed = JSON.parse(jsonInput.value);
    const rules = normalizeRules(parsed);
    await saveRules(rules);
    setStatus(`Imported ${rules.length} rule(s)`);
    await loadRules();
  } catch (e) {
    setStatus(`Import failed: ${e.message}`, true);
  }
}

async function importRulesFromFile(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rules = normalizeRules(parsed);
    await saveRules(rules);
    setStatus(`Imported ${rules.length} rule(s) from file`);
    await loadRules();
  } catch (e) {
    setStatus(`File import failed: ${e.message}`, true);
  }
}

async function exportRulesToJson() {
  try {
    const rules = await getRules();
    const json = JSON.stringify(rules, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'zen-tab-organizer-rules.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Exported JSON rules');
  } catch (e) {
    setStatus(`Export failed: ${e.message}`, true);
  }
}

async function copyJsonToClipboard() {
  try {
    const rules = await getRules();
    const json = JSON.stringify(rules, null, 2);
    await navigator.clipboard.writeText(json);
    setStatus('Copied JSON to clipboard');
  } catch (e) {
    setStatus(`Copy failed: ${e.message}`, true);
  }
}

// Initialize
document.getElementById('addRuleForm').addEventListener('submit', (e) => {
  e.preventDefault();
  addRule();
});
document.getElementById('patternInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addRule();
});
document.getElementById('spaceInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addRule();
});

document.getElementById('exportBtn').addEventListener('click', exportRulesToJson);
document.getElementById('importBtn').addEventListener('click', importRulesFromJson);
document.getElementById('copyJsonBtn').addEventListener('click', copyJsonToClipboard);
document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) {
    await importRulesFromFile(file);
    e.target.value = '';
  }
});

loadRules();
