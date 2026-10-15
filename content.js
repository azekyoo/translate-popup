(() => {
  if (window.__translatePopup) return;
  window.__translatePopup = true;

  const LANGS = {
    en: 'English', ja: '日本語', fr: 'Français', 'zh-CN': '中文 (简)', 'zh-TW': '中文 (繁)', ko: '한국어',
    es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', ru: 'Русский', vi: 'Tiếng Việt',
  };
  let target = 'en';
  let glass = true;

  const LOGO = `<svg viewBox="0 0 128 128" aria-hidden="true">
    <path d="M28 18h46a12 12 0 0 1 12 12v32a12 12 0 0 1-12 12H40l-14 12v-12a12 12 0 0 1-10-12V30a12 12 0 0 1 12-12z" fill="#fff" fill-opacity=".28"/>
    <path d="M56 50h46a12 12 0 0 1 12 12v32a12 12 0 0 1-10 12v12l-14-12H56a12 12 0 0 1-12-12V62a12 12 0 0 1 12-12z" fill="#fff"/>
    <text x="79" y="92" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="38" fill="#5b5cff">A</text>
  </svg>`;
  const ICON_COPY = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>';
  const ICON_DONE = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // Shadow DOM so page CSS can't break the popup and ours can't leak into the page.
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
<style>
  :host {
    --grad: linear-gradient(135deg, #4c8dff, #6b4dff);
    --glass:rgba(255,255,255,.62); --glass-line:rgba(255,255,255,.55); --glass-soft:rgba(15,23,42,.06);
    --bg:#ffffff; --fg:#1d1f24; --muted:#6b7280; --line:rgba(15,23,42,.09); --soft:#f3f4f8;
    --accent:#5b5cff; --accent-soft:rgba(91,92,255,.1); --shadow:0 12px 32px rgba(15,23,42,.16), 0 2px 6px rgba(15,23,42,.08);
  }
  @media (prefers-color-scheme: dark) {
    :host {
      --bg:#1f2026; --fg:#ececf1; --muted:#9a9cab; --line:rgba(255,255,255,.08); --soft:#2a2b33;
      --accent:#9b9cff; --accent-soft:rgba(155,156,255,.14); --shadow:0 12px 32px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.3);
      --glass:rgba(32,33,40,.6); --glass-line:rgba(255,255,255,.12); --glass-soft:rgba(255,255,255,.08);
    }
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
    font-size: 12px; font-weight: 600; color: var(--accent); background: var(--accent-soft);
    border: 0; border-radius: 6px; padding: 4px 6px; cursor: pointer; outline: none;
  }
  #lang option { color: var(--fg); background: var(--bg); }
  .spacer { flex: 1; }
  .icon {
    width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 8px;
    background: transparent; color: var(--muted); cursor: pointer; padding: 0; transition: background .12s, color .12s;
  }
  .icon:hover { background: var(--soft); color: var(--fg); }
  .icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  #copy.done { color: #16a34a; }

  #out {
    padding: 12px 14px 14px; overflow: auto; font-size: 15px; line-height: 1.45;
    user-select: text; scrollbar-width: thin; scrollbar-color: var(--line) transparent;
  }
  #out p { margin: 0; white-space: pre-wrap; }
  #out p + p { margin-top: .7em; }

  /* Glass mode (toggle: click the extension's toolbar icon). */
  #panel.glass {
    background: var(--glass); border-color: var(--glass-line);
    backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%);
    box-shadow: var(--shadow), inset 0 1px 0 var(--glass-line);
  }
  #panel.glass header { border-bottom-color: var(--glass-line); }
  #panel.glass #src, #panel.glass .icon:hover { background: var(--glass-soft); }
  #out.err { color: #e5484d; font-size: 13px; }
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
</style>
<button id="btn" title="Translate (Alt+T)">${LOGO}</button>
<div id="panel" hidden>
  <header>
    <span class="logo">${LOGO}</span>
    <span id="src">…</span>
    <span class="arrow">→</span>
    <select id="lang" title="Target language"></select>
    <span class="spacer"></span>
    <button id="copy" class="icon" title="Copy translation">${ICON_COPY}</button>
    <button id="close" class="icon" title="Close (Esc)">${ICON_CLOSE}</button>
  </header>
  <div id="out"></div>
</div>`;

  const $ = (id) => root.getElementById(id);
  const btn = $('btn'), panel = $('panel'), out = $('out'), src = $('src'), lang = $('lang'), copy = $('copy');
  for (const [code, name] of Object.entries(LANGS)) lang.add(new Option(name, code));

  const applyGlass = () => panel.classList.toggle('glass', glass);
  chrome.storage.sync.get({ target: 'en', glass: true }, (v) => { target = v.target; glass = v.glass; applyGlass(); });
  chrome.storage.onChanged.addListener((c) => { if (c.glass) { glass = c.glass.newValue; applyGlass(); } });

  let pending = null;   // { text, x, y } waiting for button click
  let current = null;   // { text, x, y } shown in panel
  let reqId = 0;

  const mount = () => { if (!host.isConnected) document.documentElement.appendChild(host); };
  const fromUs = (e) => e.composedPath().includes(host);
  const hideBtn = () => { btn.hidden = true; pending = null; };
  const hidePanel = () => { panel.hidden = true; current = null; reqId++; };

  // Translation starts on selection (before the bubble is clicked) and is reused on click.
  let cache = { key: null, promise: null };
  function request(text, tl) {
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

  async function run() {
    if (!current) return;
    const id = ++reqId;
    out.className = '';
    out.innerHTML = '<div class="skeleton"><i></i><i></i><i></i></div>';
    src.textContent = '…';
    lang.value = target;
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
      src.textContent = '?';
    } else {
      // Blank lines -> paragraphs with a small gap (like the source), single newlines stay tight.
      out.replaceChildren(...res.text.split(/\n[ \t]*\n+/).map((para) => {
        const p = document.createElement('p');
        p.textContent = para;
        return p;
      }));
      src.textContent = String(res.src).toUpperCase();
      if (res.tl !== target) lang.value = res.tl;
    }
    out.scrollTop = 0;
    if (!panel.dataset.dragged) place(current.x, current.y);
  }

  function open(p) {
    mount();
    hideBtn();
    current = p;
    delete panel.dataset.dragged;
    panel.hidden = false;
    place(p.x, p.y);
    run();
  }

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || fromUs(e)) return;
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
    hidePanel();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideBtn(); hidePanel(); }
  }, true);

  btn.addEventListener('mousedown', (e) => e.preventDefault()); // don't clear the page selection
  btn.addEventListener('click', () => pending && open(pending));

  lang.addEventListener('change', () => {
    target = lang.value;
    chrome.storage.sync.set({ target });
    run();
  });

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(out.textContent);
      copy.innerHTML = ICON_DONE;
      copy.classList.add('done');
      setTimeout(() => { copy.innerHTML = ICON_COPY; copy.classList.remove('done'); }, 1200);
    } catch { /* clipboard blocked on this page */ }
  });

  $('close').addEventListener('click', hidePanel);

  // Drag the panel by its header.
  panel.querySelector('header').addEventListener('mousedown', (e) => {
    if (e.target.closest('select,button')) return;
    e.preventDefault();
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
