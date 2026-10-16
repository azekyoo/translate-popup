# Chrome Web Store submission

Copy-paste source for the developer dashboard. Images are in this folder.

## Store listing

**Category:** Tools  
**Language:** English

**Summary** (max 132 chars)

> Select text, click the bubble, read the translation right next to it. No length limit, keeps line breaks and emoji.

**Description**

```
Select text on any page, click the small bubble, and the translation appears in a card right next to your selection. No new tab, no copy-paste.

• Instant: translation starts as soon as you select, so the card opens ready
• No length limit: long text is split and translated in chunks
• Keeps line breaks, paragraphs and emoji (including image emoji on Slack, X and Discord)
• Auto-detects the source language; text already in your target language is translated to English/Japanese instead
• Alt+T shortcut, or right-click → Translate selection
• Light and dark theme (follows the system or forced), optional glass effect
• Settings: right-click the toolbar icon

Uses Google Translate. If Google temporarily blocks your network, the card shows "Verify with Google": pass the check once and translation resumes.

Open source: https://github.com/azekyoo/translate-popup
```

**Images**

| Field | File |
|---|---|
| Store icon (128×128) | `../icons/icon128.png` |
| Screenshots (1280×800) | `screenshot-light.png`, `screenshot-dark.png` |
| Small promo tile (440×280) | `promo-small.png` |

**Homepage URL:** https://github.com/azekyoo/translate-popup  
**Support URL:** https://github.com/azekyoo/translate-popup/issues

## Privacy practices

**Single purpose**

> Translate text the user selects on a web page and show the translation in a popup next to the selection.

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's target language, theme and glass-effect settings. |
| `contextMenus` | Adds "Translate selection" to the page right-click menu, and the theme/glass settings to the toolbar icon's right-click menu. |
| `scripting` | Injects the popup script into tabs that were already open when the browser started or the extension was updated, so they work without a page reload. |
| Host permission `<all_urls>` | The popup must work on any page the user reads, and the script has to be injectable into those already-open tabs. |
| Host permissions `translate.googleapis.com`, `translate-pa.googleapis.com` | Send the selected text to Google Translate to get the translation (the second is a fallback when the first is temporarily unavailable). |

**Remote code:** No, I am not using remote code.

**Data usage: what is collected**

- [x] **Website content**: only the text the user selects, sent to Google Translate to translate it
- Everything else: unchecked

**Certifications** (check all three)

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/azekyoo/translate-popup/blob/main/PRIVACY.md

## Distribution

**Visibility:** Public, or Unlisted (only people with the link can find it)  
**Regions:** All
