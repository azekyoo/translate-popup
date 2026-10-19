# Translate Popup

Chrome extension: select text, click the bubble, read the translation in a small glass card next to it.

![Demo](screenshots/demo.webp)

- No length limit (long text is split and translated in chunks)
- Keeps line breaks, paragraphs and emoji (incl. image emoji on Slack, X, Discord)
- Auto-detects source; if already in target language, translates to EN/JA instead
- `Alt+T` or right-click → *Translate selection*
- Light/dark theme follows the system, or force it
- Glass effect on/off
- Settings: right-click the toolbar icon

## Install

**[Get it on the Chrome Web Store](https://chromewebstore.google.com/detail/translate-popup/kbmaganhckffnmjjhhpbggmeahfdldmd)**: updates install automatically.

<details>
<summary>Manual install (unpacked)</summary>

1. Download the zip from the [latest release](https://github.com/azekyoo/translate-popup/releases/latest) and unzip it somewhere permanent
   (or `git clone` this repo)
2. `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select the `translate-popup` folder

To update: unzip the new release into the *same* folder (a new folder installs it as a separate extension and resets
settings), or `git pull`, then click **Reload** on the extension card. Watch → Custom → Releases on this repo to get
notified. If you switch to the store version, remove the unpacked one first so both don't run at once.

</details>

## Notes

Uses Google Translate's free public endpoint (unofficial, no API key). Google sometimes blocks it for a whole network
for a few minutes (HTTP 429); translation then switches automatically to Google's `translate-pa` API (the one
Simple Translate uses), which isn't affected. Line breaks may be slightly less exact during that time. If both fail,
the popup shows **Verify with Google**.

## Why?

I wasn't happy with the official Google Translate extension
