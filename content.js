(() => {
  // Background also injects into open tabs on startup/reload, so skip if a live copy already runs here.
  // A copy orphaned by an extension reload doesn't count: its captured runtime loses its id.
  if (window.__translatePopup?.()) return;
  const rt = chrome.runtime;
  window.__translatePopup = () => { try { return !!rt.id; } catch { return false; } };

  const LANGS = {
    en: 'English', ja: '日本語', fr: 'Français', 'zh-CN': '中文 (简)', 'zh-TW': '中文 (繁)', ko: '한국어',
    es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', ru: 'Русский', vi: 'Tiếng Việt',
  };
  // Chrome maps the manifest's Alt+T to Option+T on Mac, where the key is labelled ⌥.
  const SHORTCUT = /Mac/.test(navigator.platform) ? '⌥T' : 'Alt+T';
  let target = 'en';
  let glass = true;
  let theme = 'system';
  let pinned = false; // per card, not saved: a pin is for the reply you're writing now

  const LOGO = `<svg viewBox="0 0 128 128" aria-hidden="true">
    <path d="M28 18h46a12 12 0 0 1 12 12v32a12 12 0 0 1-12 12H40l-14 12v-12a12 12 0 0 1-10-12V30a12 12 0 0 1 12-12z" fill="#fff" fill-opacity=".28"/>
    <path d="M56 50h46a12 12 0 0 1 12 12v32a12 12 0 0 1-10 12v12l-14-12H56a12 12 0 0 1-12-12V62a12 12 0 0 1 12-12z" fill="#fff"/>
    <text x="79" y="92" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="38" fill="#5b5cff">A</text>
  </svg>`;
  const ICON_COPY = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>';
  const ICON_DONE = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_GLASS = '<svg viewBox="0 0 24 24"><path d="M12 3.5c3 3.6 6 6.9 6 10.2a6 6 0 0 1-12 0c0-3.3 3-6.6 6-10.2z"/><path d="M9.2 14.2a2.9 2.9 0 0 0 2.4 2.7"/></svg>';
  const ICON_CHEVRON = '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_PIN = '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>';
  const THEME_ICONS = {
    system: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24"><path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"/></svg>',
  };
  const THEME_NEXT = { system: 'light', light: 'dark', dark: 'system' };
  const THEME_NAMES = { system: 'System', light: 'Light', dark: 'Dark' };

  // Shadow DOM so page CSS can't break the popup and ours can't leak into the page.
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  // Dark palette applies when the system is dark (unless forced light) or when forced dark.
  const DARK = `
      --bg:#1f2026; --fg:#ececf1; --muted:#9a9cab; --line:rgba(255,255,255,.08); --soft:#2a2b33;
      --accent:#9b9cff; --accent-soft:rgba(155,156,255,.14); --shadow:0 12px 32px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.3);
      --glass:rgba(32,33,40,.6); --glass-line:rgba(255,255,255,.12); --glass-soft:rgba(255,255,255,.08);`;
  root.innerHTML = `
<style>
  :host {
    --grad: linear-gradient(135deg, #4c8dff, #6b4dff);
    --glass:rgba(255,255,255,.62); --glass-line:rgba(255,255,255,.55); --glass-soft:rgba(15,23,42,.06);
    --bg:#ffffff; --fg:#1d1f24; --muted:#6b7280; --line:rgba(15,23,42,.09); --soft:#f3f4f8;
    --accent:#5b5cff; --accent-soft:rgba(91,92,255,.1); --shadow:0 12px 32px rgba(15,23,42,.16), 0 2px 6px rgba(15,23,42,.08);
  }
  @media (prefers-color-scheme: dark) {
    :host(:not([data-theme="light"])) {${DARK}
    }
  }
  :host([data-theme="dark"]) {${DARK}
  }
  * {
    box-sizing: border-box;
    font-family: system-ui, "Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif,
      "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji";
  }
  [hidden] { display: none !important; }

  #btn {
    position: fixed; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 9px; cursor: pointer;
    background: var(--grad); box-shadow: 0 4px 12px rgba(76,77,255,.35); animation: pop .14s ease-out;
    transition: transform .12s;
  }
  #btn:hover { transform: scale(1.08); }
  #btn svg { width: 100%; height: 100%; display: block; }

  #panel {
    position: fixed; width: min(460px, calc(100vw - 16px)); max-height: 60vh; display: flex; flex-direction: column;
    background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 14px;
    box-shadow: var(--shadow); overflow: hidden; animation: rise .16s ease-out;
  }
  header {
    display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px;
    border-bottom: 1px solid var(--line); cursor: move; user-select: none;
  }
  header .logo { width: 20px; height: 20px; flex: none; border-radius: 5px; background: var(--grad); }
  header .logo svg { width: 100%; height: 100%; display: block; }
  #src {
    font-size: 11px; font-weight: 600; letter-spacing: .04em; color: var(--muted);
    background: var(--soft); border-radius: 6px; padding: 3px 7px; min-width: 26px; text-align: center;
  }
  .arrow { color: var(--muted); font-size: 12px; }
  #lang {
    display: inline-flex; align-items: center; gap: 2px; height: 24px;
    font-size: 12px; font-weight: 600; color: var(--accent); background: var(--accent-soft);
    border: 0; border-radius: 6px; padding: 0 4px 0 8px; cursor: pointer; outline: none; transition: filter .12s;
  }
  #lang:hover, #lang[aria-expanded="true"] { filter: brightness(.96) saturate(1.2); }
  #lang:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
  #lang svg {
    width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2;
    stroke-linecap: round; stroke-linejoin: round; transition: transform .15s;
  }
  #lang[aria-expanded="true"] svg { transform: rotate(180deg); }

  /* Language list: our own menu (a native <select> popup ignores page styling and looks like the OS). */
  #menu {
    position: fixed; width: 184px; max-height: min(320px, 60vh); overflow: auto; padding: 4px;
    display: flex; flex-direction: column; gap: 1px;
    background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 11px;
    box-shadow: var(--shadow); animation: rise .12s ease-out;
    scrollbar-width: thin; scrollbar-color: var(--line) transparent;
  }
  #menu.glass {
    background: var(--glass); border-color: var(--glass-line);
    backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%);
    box-shadow: var(--shadow), inset 0 1px 0 var(--glass-line);
  }
  #menu button {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 7px;
    background: transparent; color: var(--fg); font-size: 13px; text-align: left; cursor: pointer; outline: none;
  }
  #menu button:hover, #menu button:focus-visible { background: var(--soft); }
  #menu.glass button:hover, #menu.glass button:focus-visible { background: var(--glass-soft); }
  #menu button .code {
    min-width: 34px; font-size: 10px; font-weight: 600; letter-spacing: .04em; color: var(--muted);
  }
  #menu button .name { flex: 1; }
  #menu button svg {
    width: 14px; height: 14px; fill: none; stroke: var(--accent); stroke-width: 2.4;
    stroke-linecap: round; stroke-linejoin: round; visibility: hidden;
  }
  #menu button[aria-selected="true"] { color: var(--accent); font-weight: 600; background: var(--accent-soft); }
  #menu button[aria-selected="true"] .code { color: var(--accent); }
  #menu button[aria-selected="true"] svg { visibility: visible; }

  /* Tooltips: our own, since native title tooltips are OS-styled. */
  #tip {
    position: fixed; padding: 5px 9px; white-space: nowrap; pointer-events: none;
    font-size: 12px; font-weight: 500; line-height: 1.35; color: var(--fg);
    background: var(--bg); border: 1px solid var(--line); border-radius: 8px;
    box-shadow: var(--shadow); animation: tip .12s ease-out;
  }
  #tip.glass {
    background: var(--glass); border-color: var(--glass-line);
    backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%);
    box-shadow: var(--shadow), inset 0 1px 0 var(--glass-line);
  }
  #tip kbd {
    margin-left: 6px; padding: 1px 5px; border-radius: 4px; font: inherit; font-size: 10.5px; font-weight: 600;
    color: var(--muted); background: var(--soft);
  }
  #tip.glass kbd { background: var(--glass-soft); }
  .spacer { flex: 1; }
  .icon {
    width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 8px;
    background: transparent; color: var(--muted); cursor: pointer; padding: 0; transition: background .12s, color .12s;
  }
  .icon:hover { background: var(--soft); color: var(--fg); }
  .icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  #copy.done { color: #16a34a; }
  #glass[aria-pressed="true"], #pin[aria-pressed="true"] { color: var(--accent); }
  #pin[aria-pressed="true"] svg { fill: currentColor; }

  #out {
    padding: 12px 14px 14px; overflow: auto; font-size: 15px; line-height: 1.45;
    user-select: text; scrollbar-width: thin; scrollbar-color: var(--line) transparent;
  }
  #out p { margin: 0; white-space: pre-wrap; }
  #out p + p { margin-top: .7em; }

  /* Glass mode (toggle: droplet button on the card, or the toolbar icon's right-click menu). */
  #panel.glass {
    background: var(--glass); border-color: var(--glass-line);
    backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%);
    box-shadow: var(--shadow), inset 0 1px 0 var(--glass-line);
  }
  #panel.glass header { border-bottom-color: var(--glass-line); }
  #panel.glass #src, #panel.glass .icon:hover { background: var(--glass-soft); }
  #out.err { color: #e5484d; font-size: 13px; }
  #out.err a { color: var(--accent); font-weight: 600; }
  .skeleton { display: grid; gap: 8px; padding: 2px 0; }
  .skeleton i {
    display: block; height: 10px; border-radius: 5px;
    background: linear-gradient(90deg, var(--soft) 25%, var(--line) 50%, var(--soft) 75%);
    background-size: 200% 100%; animation: shimmer 1.1s linear infinite;
  }
  .skeleton i:nth-child(2) { width: 85%; }
  .skeleton i:nth-child(3) { width: 60%; }

  @keyframes pop { from { transform: scale(.6); opacity: 0; } }
  @keyframes rise { from { transform: translateY(4px); opacity: 0; } }
  @keyframes shimmer { to { background-position: -200% 0; } }
  @keyframes tip { from { transform: translateY(-2px); opacity: 0; } }
</style>
<button id="btn" data-tip="Translate" data-key="${SHORTCUT}">${LOGO}</button>
<div id="panel" hidden>
  <header>
    <span class="logo">${LOGO}</span>
    <span id="src">…</span>
    <span class="arrow">→</span>
    <button id="lang" data-tip="Target language" aria-haspopup="listbox" aria-expanded="false"><span></span>${ICON_CHEVRON}</button>
    <span class="spacer"></span>
    <button id="theme" class="icon"></button>
    <button id="glass" class="icon" aria-pressed="true">${ICON_GLASS}</button>
    <button id="pin" class="icon" aria-pressed="false">${ICON_PIN}</button>
    <button id="copy" class="icon" data-tip="Copy translation">${ICON_COPY}</button>
    <button id="close" class="icon" data-tip="Close" data-key="Esc">${ICON_CLOSE}</button>
  </header>
  <div id="out"></div>
</div>
<div id="menu" role="listbox" hidden></div>
<div id="tip" role="tooltip" hidden></div>`;
  // #menu sits outside #panel: the panel's backdrop-filter would make it the containing block of a
  // fixed child, and its overflow:hidden would clip the list on short translations.

  const $ = (id) => root.getElementById(id);
  const btn = $('btn'), panel = $('panel'), out = $('out'), src = $('src'), lang = $('lang'), copy = $('copy');
  const menu = $('menu'), glassBtn = $('glass'), themeBtn = $('theme'), pinBtn = $('pin'), tip = $('tip');

  // Tooltip text lives in data-tip (data-key adds a shortcut chip). Shown after a short hover delay,
  // below the button or above it near the bottom edge. Like #menu, it sits outside #panel.
  let tipFor = null, tipTimer = 0, tipHiddenAt = 0;
  function showTip(el) {
    tipFor = el;
    tip.textContent = el.dataset.tip;
    if (el.dataset.key) tip.append(Object.assign(document.createElement('kbd'), { textContent: el.dataset.key }));
    tip.hidden = false;
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(m, Math.min(r.left + r.width / 2 - w / 2, vw - w - m)) + 'px';
    tip.style.top = (r.bottom + 6 + h <= vh - m ? r.bottom + 6 : r.top - 6 - h) + 'px';
  }
  const hideTip = () => {
    clearTimeout(tipTimer);
    if (!tip.hidden) tipHiddenAt = Date.now();
    tipFor = null;
    tip.hidden = true;
  };
  // Updates a visible tip in place, so toggles show their new state right under the cursor.
  const setTip = (el, text) => {
    el.dataset.tip = text;
    el.ariaLabel = text;
    if (tipFor === el && !tip.hidden) showTip(el);
  };
  root.querySelectorAll('[data-tip]').forEach((el) => { el.ariaLabel = el.dataset.tip; });
  root.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el === tipFor) return;
    hideTip();
    if (!el || !menu.hidden) return;
    tipFor = el;
    // Gliding straight from one button to the next shows its tip at once, like native tooltips.
    tipTimer = setTimeout(() => showTip(el), Date.now() - tipHiddenAt < 300 ? 0 : 650);
  });
  root.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && !el.contains(e.relatedTarget)) hideTip();
  });
  for (const [code, name] of Object.entries(LANGS)) {
    const item = document.createElement('button');
    item.role = 'option';
    item.dataset.code = code;
    item.innerHTML = `<span class="code">${code.toUpperCase()}</span><span class="name"></span>${ICON_CHECK}`;
    item.querySelector('.name').textContent = name;
    menu.append(item);
  }

  // Shows a language on the picker without changing the saved target.
  const showLang = (code) => {
    lang.firstChild.textContent = LANGS[code] || code;
    for (const item of menu.children) item.ariaSelected = String(item.dataset.code === code);
  };
  const closeMenu = (refocus) => {
    if (menu.hidden) return;
    menu.hidden = true;
    lang.ariaExpanded = 'false';
    if (refocus) lang.focus();
  };
  function openMenu() {
    hideTip();
    menu.hidden = false;
    lang.ariaExpanded = 'true';
    // Below the picker if it fits, else above it, kept inside the viewport.
    const r = lang.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8;
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(m, Math.min(r.left, vw - w - m)) + 'px';
    menu.style.top = (r.bottom + 6 + h <= vh - m ? r.bottom + 6 : Math.max(m, r.top - 6 - h)) + 'px';
    const sel = menu.querySelector('[aria-selected="true"]') || menu.firstChild;
    sel.scrollIntoView({ block: 'nearest' });
    sel.focus();
  }

  const applyGlass = () => {
    panel.classList.toggle('glass', glass);
    menu.classList.toggle('glass', glass);
    glassBtn.ariaPressed = String(glass);
    tip.classList.toggle('glass', glass);
    setTip(glassBtn, `Liquid glass: ${glass ? 'on' : 'off'}`);
  };
  const applyTheme = (t) => {
    theme = THEME_NAMES[t] ? t : 'system';
    if (theme === 'system') delete host.dataset.theme; else host.dataset.theme = theme;
    themeBtn.innerHTML = THEME_ICONS[theme];
    setTip(themeBtn, `Theme: ${THEME_NAMES[theme]} (click for ${THEME_NAMES[THEME_NEXT[theme]]})`);
  };
  const setPinned = (on) => {
    pinned = on;
    pinBtn.ariaPressed = String(on);
    setTip(pinBtn, on ? 'Unpin (closes on page click again)' : 'Pin: keep open when clicking the page');
  };
  // Fill the toggle buttons' state and tips before storage answers.
  applyTheme(theme); applyGlass(); setPinned(false);
  chrome.storage.sync.get({ target: 'en', glass: true, theme: 'system' }, (v) => {
    target = v.target; glass = v.glass; applyGlass(); applyTheme(v.theme);
  });
  chrome.storage.onChanged.addListener((c) => {
    if (c.glass) { glass = c.glass.newValue; applyGlass(); }
    if (c.theme) applyTheme(c.theme.newValue);
  });

  let pending = null;   // { text, x, y } waiting for button click
  let current = null;   // { text, x, y } shown in panel
  let reqId = 0;
  let copyText = '';   // last translation as Google returned it (the <p> split would lose blank lines)

  const mount = () => { if (!host.isConnected) document.documentElement.appendChild(host); };
  const fromUs = (e) => e.composedPath().includes(host);
  const hideBtn = () => { if (tipFor === btn) hideTip(); btn.hidden = true; pending = null; };
  const hidePanel = () => { closeMenu(); hideTip(); setPinned(false); panel.hidden = true; current = null; reqId++; };

  // Translation starts on selection (before the bubble is clicked) and is reused on click.
  let cache = { key: null, promise: null };
  // After the extension is reloaded, scripts already in open tabs are cut off and chrome.* calls throw.
  const alive = () => !!chrome.runtime?.id;
  function request(text, tl) {
    if (!alive()) return Promise.resolve({ ok: false, error: 'Extension was reloaded, refresh this page.' });
    const key = tl + '\u0000' + text;
    if (cache.key !== key) cache = { key, promise: chrome.runtime.sendMessage({ type: 'translate', text, tl }) };
    return cache.promise;
  }

  // <img> emoji -> real emoji. Alt is the emoji itself on X/Discord, but a shortcode (":v:") on Slack,
  // where the image file name holds the codepoints instead (".../1f31e@2x.png").
  function emojiOf(img) {
    const alt = img.alt || '';
    if (/[^\x00-\x7f]/.test(alt)) return alt;
    const m = (img.getAttribute('src') || '').match(/\/((?:[0-9a-f]{4,6})(?:-[0-9a-f]{4,6})*)(?:@\dx)?\.(?:png|svg|webp|gif)/i);
    if (m) {
      try { return String.fromCodePoint(...m[1].split('-').map((h) => parseInt(h, 16))); } catch { /* bad codepoint */ }
    }
    return alt; // custom workspace emoji: keep the shortcode
  }

  // Elements in the range the user can't actually select (Slack reactions, reply counts) or can't see
  // (hover-only labels). Selection.toString() skips them, a cloned copy doesn't, so we tag them to drop later.
  function unselectableIn(range) {
    let root = range.commonAncestorContainer;
    if (root.nodeType !== Node.ELEMENT_NODE) root = root.parentElement;
    const found = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        if (!range.intersectsNode(el)) return NodeFilter.FILTER_REJECT;
        const cs = getComputedStyle(el);
        if ((cs.userSelect || cs.webkitUserSelect) === 'none' || cs.display === 'none' || cs.visibility === 'hidden') {
          found.push(el);
          return NodeFilter.FILTER_REJECT; // whole subtree goes, no need to look inside
        }
        return NodeFilter.FILTER_SKIP;
      },
    });
    while (walker.nextNode());
    return found;
  }

  // Selection.toString() drops <img> emoji and Slack's paragraph gaps, so rebuild the text when either is present.
  function selectionText(sel) {
    const range = sel.getRangeAt(0);
    if (!range.cloneContents().querySelector('img[alt], [data-stringify-type="paragraph-break"]')) return sel.toString();
    const skip = unselectableIn(range);
    skip.forEach((el) => el.setAttribute('data-tp-skip', ''));
    let frag;
    try { frag = range.cloneContents(); } finally { skip.forEach((el) => el.removeAttribute('data-tp-skip')); }
    frag.querySelectorAll('[data-tp-skip]').forEach((el) => el.remove());
    const imgs = frag.querySelectorAll('img[alt]');
    const gaps = frag.querySelectorAll('[data-stringify-type="paragraph-break"]');
    imgs.forEach((img) => img.replaceWith(emojiOf(img)));
    gaps.forEach((g) => g.replaceWith(document.createElement('br'), document.createElement('br')));
    // innerText needs the nodes rendered to keep line breaks, so render them off-screen briefly.
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;pointer-events:none;';
    box.appendChild(frag);
    document.body.appendChild(box);
    const text = box.innerText;
    box.remove();
    return text;
  }

  function readSelection() {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && /^(text|search|url)$/i.test(ae.type)))) {
      const text = ae.value.slice(ae.selectionStart, ae.selectionEnd).trim();
      return text ? { text, rect: ae.getBoundingClientRect() } : null;
    }
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const text = selectionText(sel).trim();
    if (!text) return null;
    // Bounding rect can miss lines after block elements (Slack's paragraph gap), so take the lowest line box too.
    const range = sel.getRangeAt(0), box = range.getBoundingClientRect();
    const bottom = Math.max(box.bottom, ...[...range.getClientRects()].map((r) => r.bottom));
    return { text, rect: { left: box.left, bottom } };
  }

  // Keep panel inside the viewport: below anchor if it fits, else above, else pinned to bottom edge.
  function place(x, y) {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const left = Math.max(m, Math.min(x, vw - w - m));
    let top = y + 14;
    if (top + h > vh - m) top = y - h - 14 >= m ? y - h - 14 : Math.max(m, vh - h - m);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  // afterVerify: this is the retry right after the user passed Google's check page.
  async function run(afterVerify = false) {
    if (!current) return;
    const id = ++reqId;
    copyText = '';
    out.className = '';
    out.innerHTML = '<div class="skeleton"><i></i><i></i><i></i></div>';
    src.textContent = '…';
    showLang(target);
    let res;
    try {
      res = await request(current.text, target);
    } catch (e) {
      res = { ok: false, error: 'Extension was reloaded, refresh this page.' };
    }
    if (!res?.ok) cache = { key: null, promise: null }; // don't reuse a failure on retry
    if (id !== reqId) return; // a newer request or close happened meanwhile
    if (!res?.ok) {
      out.className = 'err';
      out.textContent = 'Error: ' + (res?.error || 'no response');
      if (res?.verify && afterVerify) {
        // Harder block: Google ignores the pass it just gave, so offering the check again would loop.
        out.textContent = 'Google is still blocking your network, even after the check. Please wait a few minutes and try again.';
      } else if (res?.verify) {
        const a = document.createElement('a');
        a.href = res.verify;
        a.target = '_blank';
        a.textContent = 'Verify with Google';
        // Background opens the check tab so it can close it afterwards and tell us to retry.
        a.addEventListener('click', (e) => {
          e.preventDefault();
          if (alive()) chrome.runtime.sendMessage({ type: 'verify' }).catch(() => {});
        });
        out.append(document.createElement('br'), a);
      }
      src.textContent = '?';
    } else {
      // Blank lines -> paragraphs with a small gap (like the source), single newlines stay tight.
      copyText = res.text;
      out.replaceChildren(...res.text.split(/\n[ \t]*\n+/).map((para) => {
        const p = document.createElement('p');
        p.textContent = para;
        return p;
      }));
      src.textContent = String(res.src).toUpperCase();
      if (res.tl !== target) showLang(res.tl);
    }
    out.scrollTop = 0;
    if (!panel.dataset.dragged) place(current.x, current.y);
  }

  function open(p) {
    mount();
    hideBtn();
    current = p;
    // A pinned card stays where it is and just shows the new translation.
    if (!(pinned && !panel.hidden)) {
      delete panel.dataset.dragged;
      panel.hidden = false;
      place(p.x, p.y);
    }
    run();
  }

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || fromUs(e)) return;
    if (!alive()) { host.remove(); return; } // orphaned copy: stay silent, the fresh one takes over on refresh
    setTimeout(() => {          // let the browser finalize the selection first
      const s = readSelection();
      if (!s) return hideBtn();
      mount();
      pending = { text: s.text, x: e.clientX, y: e.clientY };
      request(s.text, target).catch(() => {}); // prefetch while the user moves to the bubble
      btn.style.left = Math.min(e.clientX + 8, document.documentElement.clientWidth - 38) + 'px';
      btn.style.top = Math.min(e.clientY + 8, window.innerHeight - 38) + 'px';
      btn.hidden = false;
    }, 0);
  }, true);

  document.addEventListener('mousedown', (e) => {
    if (fromUs(e)) return;
    hideBtn();
    if (pinned) closeMenu(); else hidePanel();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!menu.hidden) return closeMenu(true); // first Esc only closes the language list
    hideBtn();
    if (!pinned) hidePanel(); // pages use Esc too (Slack closes threads), so only × closes a pinned card
  }, true);

  btn.addEventListener('mousedown', (e) => e.preventDefault()); // don't clear the page selection
  btn.addEventListener('click', () => pending && open(pending));

  lang.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  lang.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(); }
  });

  menu.addEventListener('click', (e) => {
    const item = e.target.closest('button');
    if (!item) return;
    closeMenu(true);
    if (item.dataset.code === target) return;
    target = item.dataset.code;
    if (alive()) chrome.storage.sync.set({ target });
    run();
  });
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.children], i = items.indexOf(root.activeElement);
    const go = (n) => { e.preventDefault(); items[(n + items.length) % items.length].focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(-1);
    else if (e.key === 'Tab') closeMenu();
  });
  // Clicks elsewhere in the popup close the list (page clicks already close everything).
  root.addEventListener('mousedown', (e) => {
    if (!menu.hidden && !e.composedPath().some((el) => el === menu || el === lang)) closeMenu();
  });

  pinBtn.addEventListener('click', () => {
    setPinned(!pinned);
    if (pinned) panel.dataset.dragged = '1'; // stop re-placing it next to each new selection
  });

  themeBtn.addEventListener('click', () => {
    applyTheme(THEME_NEXT[theme]);
    if (alive()) chrome.storage.sync.set({ theme });
  });

  glassBtn.addEventListener('click', () => {
    glass = !glass;
    applyGlass();
    if (alive()) chrome.storage.sync.set({ glass });
  });

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // The async API is missing on http pages and blocked in iframes or by a page's Permissions-Policy.
      // The old copy command still works from a click, so copy through a hidden textarea instead.
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    root.append(ta);
    ta.select();
    try { return document.execCommand('copy'); } catch { return false; } finally { ta.remove(); copy.focus(); }
  }

  copy.addEventListener('click', async () => {
    if (!copyText || !(await writeClipboard(copyText))) return; // still loading, error shown, or copy refused
    copy.innerHTML = ICON_DONE;
    setTip(copy, 'Copied');
    copy.classList.add('done');
    setTimeout(() => { copy.innerHTML = ICON_COPY; copy.classList.remove('done'); setTip(copy, 'Copy translation'); }, 1200);
  });

  $('close').addEventListener('click', hidePanel);

  // Drag the panel by its header.
  panel.querySelector('header').addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    closeMenu(); // it's positioned off the picker and wouldn't follow the drag
    hideTip();
    const r = panel.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const move = (ev) => {
      panel.dataset.dragged = '1';
      panel.style.left = ev.clientX - sx + 'px';
      panel.style.top = ev.clientY - sy + 'px';
    };
    const up = () => { removeEventListener('mousemove', move, true); removeEventListener('mouseup', up, true); };
    addEventListener('mousemove', move, true);
    addEventListener('mouseup', up, true);
  });

  // From context menu or Alt+T. Frames without a selection ignore it.
  chrome.runtime.onMessage.addListener((msg) => {
    // Back from Google's check page: retry if this frame's popup is still showing the error.
    if (msg.type === 'retry') return void (!panel.hidden && out.className === 'err' && run(true));
    if (msg.type !== 'show') return;
    const s = readSelection();
    const text = s?.text || msg.text;
    if (!text) return;
    const r = s?.rect;
    const x = r ? r.left : window.innerWidth / 2 - 230;
    const y = r ? Math.min(Math.max(r.bottom, 0), window.innerHeight) : 80;
    open({ text, x, y });
  });
})();
