// Primary: Google's keyless "gtx" endpoint. Translates line by line, so line breaks and blank lines stay exact.
// Google sometimes blocks it for a whole network IP (HTTP 429).
const GTX_ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=';
// Fallback during those blocks: translate-pa with the public key Google's own web clients use (Simple Translate's
// main endpoint). Quota is per key, not per IP, so the block doesn't reach it. It reflows line breaks a bit,
// hence fallback only. GET only: text goes in the URL.
const PA_ENDPOINT = 'https://translate-pa.googleapis.com/v1/translate';
const PA_KEY = 'AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA';
const GTX_COOLDOWN = 10 * 60 * 1000; // after a block, skip gtx for this long instead of hitting it on every request
// Opening this in a tab during a block lands on Google's "unusual traffic" check page; passing it sets a cookie
// that lifts the block for this browser. No query: a real translation would come back as a .json download.
const VERIFY_URL = 'https://translate.googleapis.com/translate_a/single';
const CHUNK = 1500;     // chars per request: worst case (all CJK) ~13.5 KB of URL, under translate-pa's limit
const PARALLEL = 4;     // concurrent requests for very long selections
const CACHE_MAX = 200;  // recent chunk translations kept, so re-selecting the same text costs no request

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

async function viaPa(q, tl) {
  const params = new URLSearchParams([
    ['params.client', 'gtx'], ['query.source_language', 'auto'], ['query.target_language', tl],
    ['query.display_language', tl], ['query.text', q], ['key', PA_KEY], ['data_types', 'TRANSLATION'],
  ]);
  const res = await fetch(`${PA_ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`translate-pa returned HTTP ${res.status}`);
  const data = await res.json();
  return { text: data.translation ?? '', src: data.sourceLanguage };
}

async function viaGtx(q, tl) {
  const res = await fetch(GTX_ENDPOINT + encodeURIComponent(tl), {
    method: 'POST',
    body: new URLSearchParams({ q }),
    credentials: 'include', // carries Google's pass cookie once the user has solved its check page
  });
  // 429 (and 500 alongside it) = Google's anti-bot block on the whole network IP. It lifts by itself in minutes,
  // or right away once the user passes Google's check page (see VERIFY_URL).
  if (res.status === 429 || res.status === 500) {
    const err = new Error(`Google is temporarily blocking translations from your network. Try again in a few minutes. (HTTP ${res.status})`);
    err.blocked = true;
    throw err;
  }
  if (!res.ok) throw new Error(`Google returned HTTP ${res.status}`);
  const data = await res.json();
  return { text: (data[0] || []).map((s) => s[0]).join(''), src: data[2] };
}

const cache = new Map(); // tl + chunk -> result, oldest first
let gtxBlockedUntil = 0;

async function translateChunk(q, tl) {
  const key = tl + '\u0000' + q;
  if (cache.has(key)) return cache.get(key);
  if (!q.trim()) return { text: q, src: undefined }; // blank lines: nothing to translate
  let r;
  try {
    if (Date.now() < gtxBlockedUntil) throw Object.assign(new Error('gtx cooling down'), { blocked: true });
    r = await viaGtx(q, tl);
  } catch (e) {
    if (e.blocked && Date.now() >= gtxBlockedUntil) gtxBlockedUntil = Date.now() + GTX_COOLDOWN;
    try {
      r = await viaPa(q, tl);
    } catch {
      if (e.message === 'gtx cooling down') r = await viaGtx(q, tl); // fallback broke too: retry gtx for real
      else throw e; // both failed: show gtx's error (it carries the Verify with Google link)
    }
    // translate-pa trims edge whitespace, but chunks often end in "\n": put it back so chunks join cleanly.
    // It also inserts blank lines between sentences: drop them when the source had none.
    const lead = q.match(/^\s*/)[0], trail = q.slice(lead.length).match(/\s*$/)[0];
    let text = r.text.trim();
    if (!/\n[ \t]*\n/.test(q)) text = text.replace(/\n[ \t]*\n+/g, '\n');
    r = { ...r, text: lead + text + trail };
  }
  cache.set(key, r);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return r;
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

// Verify tab -> tab that asked, kept in session storage because the service worker may sleep during the check.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'verify' || !sender.tab) return;
  chrome.tabs.create({ url: VERIFY_URL, openerTabId: sender.tab.id })
    .then((t) => chrome.storage.session.set({ ['verify' + t.id]: sender.tab.id }));
});

// Back on translate.googleapis.com = check passed (or there was no block): the page itself is useless, close it.
chrome.tabs.onUpdated.addListener(async (id, info, tab) => {
  if (info.status !== 'complete' || !tab.url?.startsWith('https://translate.googleapis.com/')) return;
  if ((await chrome.storage.session.get('verify' + id))['verify' + id] !== undefined) chrome.tabs.remove(id);
});

// Verify tab gone (closed by us or the user): return to the page and let its popup retry.
chrome.tabs.onRemoved.addListener(async (id) => {
  const key = 'verify' + id;
  const from = (await chrome.storage.session.get(key))[key];
  if (from === undefined) return;
  chrome.storage.session.remove(key);
  chrome.tabs.update(from, { active: true }).catch(() => {});
  chrome.tabs.sendMessage(from, { type: 'retry' }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'translate') return;
  translate(msg.text, msg.tl)
    .then((r) => sendResponse({ ok: true, ...r }))
    .catch((e) => sendResponse({ ok: false, error: String(e.message || e), verify: e.blocked ? VERIFY_URL : undefined }));
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
