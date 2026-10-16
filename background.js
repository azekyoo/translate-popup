// Google's free "gtx" endpoint (same one Simple Translate uses). POST so long text isn't capped by URL length.
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=';
const CHUNK = 1800;     // chars per request, stays well under the endpoint's limit
const PARALLEL = 4;     // concurrent requests for very long selections

// Split on newlines, then sentence ends, then hard-cut, so each chunk <= CHUNK and formatting survives.
function split(text) {
  const pieces = [];
  for (const line of text.split(/(?<=\n)/)) {
    if (line.length <= CHUNK) { pieces.push(line); continue; }
    for (const sentence of line.match(/[^.!?。！？]*[.!?。！？]+\s*|[^.!?。！？]+$/g) || [line]) {
      for (let i = 0; i < sentence.length; i += CHUNK) pieces.push(sentence.slice(i, i + CHUNK));
    }
  }
  const chunks = [];
  let cur = '';
  for (const p of pieces) {
    if (cur.length + p.length > CHUNK && cur) { chunks.push(cur); cur = ''; }
    cur += p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function translateChunk(q, tl) {
  const res = await fetch(ENDPOINT + encodeURIComponent(tl), {
    method: 'POST',
    body: new URLSearchParams({ q }),
  });
  if (!res.ok) throw new Error(`Google returned HTTP ${res.status}`);
  const data = await res.json();
  return { text: (data[0] || []).map((s) => s[0]).join(''), src: data[2] };
}

async function translateAll(text, tl) {
  const chunks = split(text);
  const out = new Array(chunks.length);
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const batch = chunks.slice(i, i + PARALLEL).map((c) => translateChunk(c, tl));
    (await Promise.all(batch)).forEach((r, j) => { out[i + j] = r; });
  }
  return { text: out.map((r) => r.text).join(''), src: out[0]?.src || '?', tl };
}

async function translate(text, tl) {
  let r = await translateAll(text, tl);
  // Text already in the target language -> translate the other way instead (en <-> ja).
  if (r.src === tl) r = await translateAll(text, tl === 'ja' ? 'en' : 'ja');
  return r;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'translate') return;
  translate(msg.text, msg.tl)
    .then((r) => sendResponse({ ok: true, ...r }))
    .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true; // keep channel open for async reply
});

// Tabs restored at browser startup can load before the extension and miss the manifest injection,
// and tabs open during a reload keep only a dead copy. Inject into them so no refresh is needed.
async function injectOpenTabs() {
  for (const tab of await chrome.tabs.query({})) {
    if (tab.discarded) continue; // sleeping tab: gets the script normally when it wakes up
    chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] })
      .catch(() => {}); // chrome://, Web Store, etc. refuse injection
  }
}
chrome.runtime.onStartup.addListener(injectOpenTabs);
chrome.runtime.onInstalled.addListener(injectOpenTabs);

const THEMES = { system: 'Theme: System', light: 'Theme: Light', dark: 'Theme: Dark' };

// Page menu: translate selection. Toolbar icon right-click menu: theme + glass settings.
chrome.runtime.onInstalled.addListener(async () => {
  const { glass, theme } = await chrome.storage.sync.get({ glass: true, theme: 'system' });
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'tp', title: 'Translate selection', contexts: ['selection'] });
    for (const [id, title] of Object.entries(THEMES)) {
      chrome.contextMenus.create({ id: 'theme-' + id, title, type: 'radio', checked: theme === id, contexts: ['action'] });
    }
    chrome.contextMenus.create({ id: 'sep', type: 'separator', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'glass', title: 'Glass effect', type: 'checkbox', checked: glass, contexts: ['action'] });
  });
});

// Settings live only in the right-click menu: a left-click toggle was too easy to hit by accident
// (e.g. clicking the extension's row in Chrome's puzzle menu while pinning it).
async function showGlassState() {
  const { glass } = await chrome.storage.sync.get({ glass: true });
  chrome.contextMenus.update('glass', { checked: glass }, () => void chrome.runtime.lastError);
}
chrome.runtime.onStartup.addListener(showGlassState);
chrome.runtime.onInstalled.addListener(showGlassState);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('theme-')) return void chrome.storage.sync.set({ theme: info.menuItemId.slice(6) });
  if (info.menuItemId === 'glass') return void chrome.storage.sync.set({ glass: info.checked }).then(showGlassState);
  chrome.tabs.sendMessage(tab.id, { type: 'show', text: info.selectionText }, { frameId: info.frameId })
    .catch(() => {});
});

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'translate-selection' && tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'show' }).catch(() => {});
});
