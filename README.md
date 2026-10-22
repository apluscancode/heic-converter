# HEIC to JPG Converter — Free, Private, Batch Compress

Convert **HEIC** photos to **JPG**, **PNG** or **WebP** — and compress them by up to 90%.
Everything runs **inside the browser**: files are never uploaded, never stored, never logged.

🔗 **Live demo:** https://apluscancode.github.io/heic-converter/

---

## Why this exists

HEIC is the default photo format on every modern iPhone and iPad, but **Windows, most
email providers, Microsoft Word, and older design software still cannot open it**. The
usual fix is to upload your private photos to some random online converter — which means
your images leave your device, get stored on someone's server, and may end up in a
training dataset.

This tool does the conversion **locally**. There is no backend, no database, no
analytics, and no upload endpoint. Open DevTools → Network and you will see the only
requests are for `index.html`, `style.css`, `app.js` and the decoder library.

---

## Features

| Feature | Detail |
|---------|--------|
| **HEIC → JPG / PNG / WebP** | Full decode via `heic2any` (libheif, WebAssembly) |
| **Batch conversion** | Up to 50 files per batch, drag-and-drop or file picker |
| **Compression** | Quality slider 10–100 with live hints |
| **Resize** | Max width 320–6000 px, aspect ratio preserved |
| **Transparency** | Auto-detected; PNG/WebP keep alpha, JPG gets a solid background |
| **Live preview** | Thumbnail of the converted image plus exact byte sizes |
| **Batch download** | One-by-one or "Download all" |
| **100% private** | No upload, no storage, no account, no watermark |
| **SEO-ready** | JSON-LD `WebApplication` + `FAQPage`, OG/Twitter cards, sitemap, robots |
| **No build step** | Plain HTML + CSS + JS, hosted free on GitHub Pages |

---

## Tech

| Layer | Choice | Why |
|-------|--------|-----|
| HEIC decode | [`heic2any`](https://github.com/catdad-express/heic2any) (MIT) | libheif compiled to WASM, works in every modern browser |
| Re-encode | Canvas `toBlob()` | Native JPEG / PNG / WebP encoders — no extra library |
| Resize | Canvas `drawImage` with `imageSmoothingQuality: 'high'` | Good enough for a converter; avoids a second 200 KB dependency |
| UI | Vanilla JS, no framework | The whole app is ~11 KB of JS |
| Hosting | GitHub Pages | Free, static, HTTPS, global CDN |

**Browser support:** Chrome/Edge 94+, Firefox 90+, Safari 15+ (WASM + WebP encode).

---

## Run locally

```bash
git clone https://github.com/apluscancode/heic-converter.git
cd heic-converter
python3 -m http.server 8000
# open http://localhost:8000
```

> Must be served over HTTP — `file://` blocks the WASM worker and Blob URLs.

---

## Structure

```
heic-converter/
├── index.html          # markup + SEO meta + JSON-LD
├── style.css           # light/dark theme, responsive
├── app.js              # conversion logic
├── vendor/
│   └── heic2any.min.js # HEIC decoder (vendored, no CDN dependency)
├── og.png              # 1200x630 social share card
├── robots.txt
├── sitemap.xml
├── 404.html
├── .nojekyll
└── README.md
```

---

## Privacy implementation notes

- Input: `File` → `Blob` → `heic2any` decode → `Image` → `Canvas` → `toBlob()`.
- The decoder runs in a Web Worker backed by WASM — the file bytes never leave the tab.
- Output is handed to the user as a `blob:` URL created with `URL.createObjectURL()`.
- `URL.revokeObjectURL()` is called after every image load, so blobs are released.
- No `fetch()`/`XMLHttpRequest`/`sendBeacon` call carries a file payload — ever.

---

## SEO notes

- Target query: **"heic to jpg"** (highest-volume HEIC search term), with supporting
  terms in the title, meta description, keywords, H1 and FAQ.
- `FAQPage` JSON-LD mirrors the visible FAQ, so answers can surface directly in Google.
- `WebApplication` JSON-LD with `offers.price = 0` for the free-tool rich result.
- Open Graph + Twitter Card with a hand-built 1200×630 share image.
- `canonical` → the GitHub Pages URL; `sitemap.xml` + `robots.txt` published.
- A future custom domain (e.g. `heicconverter.app`) would need the canonical, OG URLs
  and sitemap updated in one place.

---

## License

MIT — the converter source and the vendored `heic2any` library (both MIT).
