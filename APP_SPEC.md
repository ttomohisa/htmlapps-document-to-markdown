# Application Specification

## Product

**Document to Markdown v1.0.1**

Browser-only document-to-Markdown converter for Browser Kitty.

- Repository: `ttomohisa/htmlapps-document-to-markdown`
- Slug: `document-to-markdown`
- Japanese display name: `文書→Markdown`
- Release artifacts: `dist/index.html` and `dist/index.self-extract.html`
- Languages: Japanese / English in the same HTML

## 1. Problem and outcome

Users often need document content in a reusable text format for GitHub, Obsidian, Wiki systems, static sites, text processing, or AI chat tools. Copying and reformatting content by hand is slow, and uploading documents to a conversion service may be undesirable.

Document to Markdown extracts useful document structure into Markdown while keeping the selected file inside the browser.

The product prioritizes semantic structure over visual fidelity. It does not promise pixel-perfect reconstruction of the source document.

## 2. Current release scope — v1.0.0

Supported input formats:

- Microsoft Word Open XML: `.docx`
- Microsoft PowerPoint Open XML: `.pptx`
- Microsoft Excel Open XML: `.xlsx`
- PDF with an extractable text layer: `.pdf`
- UTF-8 plain text: `.txt`
- HTML: `.html`, `.htm`
- CSV: `.csv`
- TSV: `.tsv`

Core flow:

1. Select or drop one or more supported files.
2. Validate per-file and batch limits, then add accepted files to the queue.
3. Convert queued files locally and sequentially in the page.
4. Show a per-file state and continue processing even when another file fails or is cancelled.
5. Select a completed row to review its Markdown, preview, and document information.
6. Copy or save an individual `.md`; for DOCX / PPTX results with extracted images, either save a ZIP containing the Markdown and `images/` assets or optionally save a self-contained Markdown file with image bytes embedded as Base64 data URIs.
7. Save all successful results as one batch ZIP when needed.
8. Remove individual queue entries or clear the full in-memory session when finished.

DOCX, PPTX, and XLSX OOXML packages are read with browser-native `DecompressionStream` and `DOMParser`. v1.0.0 uses one pinned runtime dependency, PDF.js / `pdfjs-dist` 6.2.108, embedded into the standalone HTML together with the selected Japanese CMaps required by the existing Browser Kitty PDF implementation. No dependency is fetched at runtime.

## 3. Markdown conversion rules

Generated Markdown uses a GitHub-Flavored-Markdown-compatible subset where practical.

### DOCX

- Treat DOCX as an OOXML ZIP package.
- Parse `word/document.xml`, `word/styles.xml`, `word/numbering.xml`, and document relationships when present.
- Resolve paragraph numbering from paragraph styles and their `basedOn` chain before applying direct paragraph overrides. Explicit `numId=0` removes numbering; malformed style cycles terminate safely.
- Convert Heading 1–6 / Title-like paragraph styles, normal paragraphs, ordered and unordered lists, tables, hyperlinks, bold, italic, and strikethrough text.
- Preserve external hyperlink targets as Markdown text without requesting them.
- Resolve embedded images referenced by the main document through OOXML relationships, emit relative Markdown references such as `![alt](images/image-001.png)`, and preserve the original embedded image bytes for ZIP export.
- Only images that are actually resolved from converted main-document content are exported; external image references are never downloaded.
- Detect merged table cells, text boxes, SmartArt, and embedded objects where practical and surface concrete warnings.
- One unsupported document feature must not be described as successfully converted when it is intentionally omitted.
- Encrypted or password-protected packages are rejected.
- ZIP safety limits: at most 10,000 entries, at most 512 MB declared total expanded content, and at most 128 MB for one expanded entry.
- ZIP64 and compression methods other than STORE / DEFLATE are outside the v1.0.0 implementation.


### PPTX

- Treat PPTX as an OOXML ZIP package.
- Preserve the order in `ppt/presentation.xml` rather than relying on numeric filenames alone.
- Parse presentation, slide, slide-relationship, notes-slide, and notes-relationship parts when present.
- Emit `<!-- Slide N -->` source markers in generated Markdown.
- Convert title placeholders to level-2 Markdown headings.
- Convert text shapes, basic bold/italic/strikethrough runs, hyperlinks, content-placeholder bullet levels, and tables.
- Append Speaker Notes under a consistent `### Speaker Notes` heading when a slide contains notes text.
- Preserve external hyperlink targets as Markdown without requesting them.
- Resolve embedded slide / notes images through `p:pic` / DrawingML relationships, emit relative Markdown image references, and preserve original embedded image bytes for ZIP export.
- Externally linked images may remain as Markdown URLs but are never downloaded.
- Detect charts, SmartArt/diagram parts, audio/video media, embedded objects, animations/transitions, and external links where practical and surface concrete warnings.
- Chart visuals/data structures, SmartArt layout, media content, animations, and transitions are not represented as if they were converted.
- A problematic unsupported object should not prevent unrelated slide text from being extracted where recovery is possible.
- Encrypted/password-protected PPTX packages are rejected.
- PPTX uses the same OOXML ZIP safety limits as DOCX: at most 10,000 entries, at most 512 MB declared expanded content, and at most 128 MB for one expanded entry.
- ZIP64 and compression methods other than STORE / DEFLATE remain outside the current implementation.

### XLSX

- Treat XLSX as an OOXML ZIP package.
- Preserve worksheet order from `xl/workbook.xml` and resolve worksheet parts through workbook relationships.
- Support both relative relationship targets and package-absolute targets such as `/xl/worksheets/sheet1.xml`.
- Convert visible worksheets to level-2 headings followed by Markdown tables.
- Exclude `hidden` and `veryHidden` worksheets from Markdown and report their count in Document Information.
- Read shared strings and inline strings.
- Preserve strings, numbers, booleans, error values, ISO date cells, and cached formula results.
- Never execute spreadsheet formulas. If a formula has no cached result, preserve the formula text with a leading `=` and show a warning.
- Interpret common Excel date/time number formats, including the 1900/1904 workbook date systems, without changing the workbook.
- Detect merged cells and surface a layout warning because Markdown tables cannot reproduce Excel merges.
- Detect drawings/images/charts, comments/notes, and external workbook links where practical and surface concrete warnings rather than implying that these objects were converted.
- Spreadsheet drawings, chart visuals, comments, and external workbook content are not converted in v1.0.0.
- Encrypted/password-protected XLSX packages are rejected.
- XLSX uses the same OOXML ZIP safety limits as DOCX/PPTX: at most 10,000 entries, at most 512 MB declared expanded content, and at most 128 MB for one expanded entry.
- ZIP64 and compression methods other than STORE / DEFLATE remain outside the current implementation.

### PDF

- Parse PDFs locally with embedded PDF.js / `pdfjs-dist` 6.2.108.
- Disable PDF scripting and JavaScript evaluation (`enableScripting: false`, `isEvalSupported: false`) and never request external PDF resources.
- Process pages in source order and emit `<!-- Page N -->` source markers.
- Extract the PDF text layer and reconstruct lines and paragraphs best-effort from text coordinates.
- Infer obvious headings from relative font size and short-line structure.
- Convert common bullet and ordered-list prefixes where they are recoverable from the text layer.
- Preserve HTTP/HTTPS link annotation URLs without requesting them; do not duplicate a URL appendix when the URL is already visible in extracted text.
- Detect likely rotated/vertical text, multi-column layouts, table-like positioning, form/annotation content, and partially unreadable pages where practical, and surface concrete warnings.
- PDFs have no guaranteed semantic reading order. Complex columns, tables, unusual encodings, and positioned text are best-effort and must not be described as exact reconstruction.
- If no extractable text exists, stop with an explicit scanned/image-only PDF message. OCR is not performed in v1.0.0.
- Password-protected PDFs are rejected with a specific user-readable error.
- The input limit remains 100 MB.

### TXT

- Decode as UTF-8 through browser File APIs.
- Normalize CRLF/CR line endings to LF.
- Preserve text rather than inventing headings or lists.

### HTML

- Parse using `DOMParser` as an inert document.
- Never execute scripts or inline event handlers.
- Ignore `script`, `style`, `noscript`, and `template` content.
- Convert headings, paragraphs, lists, blockquotes, links, images as references, code, preformatted text, horizontal rules, and tables.
- Do not fetch linked pages or remote images.
- Tables without explicit header cells are converted best-effort and produce a warning.

### CSV / TSV

- Support RFC-4180-style quoting behavior required for quoted delimiters, escaped double quotes, and multiline quoted cells.
- The first record becomes the Markdown table header.
- Escape Markdown table pipe characters and normalize cell newlines to `<br>`.
- Empty files produce an understandable error instead of an empty success result.

## 4. Result views

Each successful conversion exposes three result views:

- **Markdown** — selectable source with copy and `.md` save actions. When extracted DOCX/PPTX images exist, also expose **Markdown + images ZIP** and optional **Base64-embedded Markdown** actions. Image-specific export controls remain hidden when the result contains no extracted images. The normal `.md` output keeps relative image paths and does not contain the image bytes.
- **Preview** — safe local rendering of the generated Markdown subset.
- **Information** — source filename, type, size, generated Markdown size, format-specific statistics, and concrete warnings.

The preview renderer must not execute raw HTML and must not automatically load remote images.

## 5. Output filename and asset ZIP

The user can edit the output filename before saving.

- Default: source filename without its extension.
- Output extension: `.md`, added by the app.
- Invalid filename characters are replaced safely.
- Reserved Windows base names are adjusted.
- The source file is never modified.
- Image ZIP output uses `<name>.zip` with `<name>.md` at the archive root and extracted files under `images/`.
- Optional Base64 output uses `<name>-embedded.md` and replaces extracted `images/...` references with `data:<mime>;base64,...` URIs. It is user-initiated, does not change the normal Markdown result, and may substantially increase Markdown file size.
- Extracted images are stored without recompression so their bytes match the embedded Office assets.
- Image output names are deterministic (`images/image-001.ext`, `image-002.ext`, ...), preserve a compatible source extension, and cannot overwrite the Markdown file.
- Batch export uses `document-to-markdown.zip`. Each successful document is placed in its own sanitized folder with its `.md` and any `images/` assets. Duplicate folder names are suffixed (`name-2`, `name-3`, ...) rather than overwritten.

## 6. Data and privacy

- All conversion happens in the browser.
- User files and generated Markdown are never uploaded by this app.
- No runtime CDN, API, analytics, telemetry, remote font, or other hidden network dependency.
- CSP keeps `connect-src 'none'`.
- Document bytes and generated content are not automatically persisted in `localStorage` or IndexedDB.
- Only the selected UI language may be persisted.
- Clearing the session removes the in-memory source and result references from the UI.

UI privacy wording uses **完全ローカル処理** in Japanese.

## 7. Input and security

- Maximum file size: 100 MB per file.
- Maximum batch size: 20 files and 300 MB total selected source bytes.
- Files are converted sequentially to bound peak memory and CPU load.
- New files can be appended while a batch is running.
- Queued files can be cancelled immediately; a currently processing file is cancelled at the next supported checkpoint and its result is discarded.
- Unsupported formats are represented as failed queue items without blocking other files.
- HTML input is untrusted. Source scripts are never executed or inserted into the live DOM.
- Markdown preview is generated from escaped text with a controlled subset renderer.
- External links may be represented in the generated Markdown but are never requested automatically.

## 7. Conversion quality model

Every successful converter result is normalized into a common quality model. The UI groups findings as:

- **Converted** — Markdown output was generated from readable content.
- **Check recommended** — content was converted or preserved with approximation, layout sensitivity, or external-reference caveats.
- **Not converted** — a detected source feature is intentionally omitted from Markdown.
- **Partial failure** — a bounded source unit could not be fully parsed, while other readable content remains available.

No synthetic accuracy percentage or score is shown.

When a converter can identify the source location, the quality report includes it:

- PPTX — slide number
- XLSX — sheet name
- PDF — page number

A partial failure must not discard already converted content. The top-level result status is distinct from a normal success-with-review state.

## 8. States

The UI distinguishes both per-file and batch states:

- empty
- queued
- processing
- success
- success with review items
- partial conversion
- failed
- cancelled

Failed and cancelled rows expose a localized Retry button. Retry keeps the same queue entry, source file, and output filename; it clears the previous error/result and requeues conversion. Processing rows cannot retry until cancellation has settled. Repeated clicks do not create duplicate work.

A failed or cancelled file must not stop remaining queued files from being processed.

A failed conversion must explain what happened and suggest a useful next action where possible.

## 9. Desktop and smartphone UX

Desktop keeps a multi-file queue visible in the File page. Each row shows filename, format, size, and conversion state. Selecting a completed row switches the Markdown, Preview, and Info pages to that result. The queue supports adding more files, cancelling remaining work, removing individual entries, and exporting all successful results as one ZIP.

At `<=600px`, use four fixed bottom page tabs based on the template mobile-bottom-bar pattern:

- File
- Markdown
- Preview
- Info

Only the active mobile page is shown. Markdown / Preview / Info tabs remain disabled until a valid result exists. Bottom safe-area padding must prevent content from being hidden.

Minimum checks: 320px and 360px widths, long filenames, long Markdown, tables, dialogs, and bottom navigation.

## 10. Accessibility

Required:

- visible keyboard focus
- sufficient contrast
- touch-friendly controls
- labels for file input and output filename
- `aria-live` processing/status announcements
- Escape closes dialogs
- Enter / Space activate buttons
- focus restoration after confirmation dialogs
- `prefers-reduced-motion`

## 11. Destructive actions

Clearing all loaded files/results is destructive for the current in-memory session and uses the template `AppConfirm` dialog.

Removing an individual non-processing queue entry is immediately reversible with an Undo toast. Processing entries use Cancel rather than immediate removal.

The app never deletes the original source file from the user's device.

## 12. Build and repository contract

The implementation follows the attached `htmlapps-template` repository contract.

Required properties:

- edit `src/index.template.html`, never generated `dist` files by hand
- exact Browser Kitty icon source at `assets/favicon.svg`
- readable single HTML: `dist/index.html`
- normal builds regenerate `document-to-markdown.html` as an exact byte copy; repository checks verify SHA-256 equality
- same-repository PR previews and cleanup use the template Cloudflare Workers Preview workflow with existing repository credentials; absent credentials must be reported as a skipped preview, not a successful deployment
- development-only Node.js 24 tests cover conversion fixtures, retry/cancel state, exports, and header contracts
- gzip self-extracting single HTML: `dist/index.self-extract.html`
- direct `file://` use
- runtime network blocked
- dependencies pinned through `dependencies.json` / `dependencies.lock.json`
- `dependencies.json` / `dependencies.lock.json` pin PDF.js / `pdfjs-dist` 6.2.108 and its npm tarball SHA-256; selected module/worker/CMap assets are embedded at build time

## 13. Browser targets

Primary:

- current Chrome
- current Edge

Best effort:

- current Firefox
- current Safari
- modern Android Chromium
- current iPhone Safari

## 14. v1.0.0 acceptance criteria

- Existing DOCX / PPTX / XLSX / PDF / HTML / CSV / TSV / TXT conversion output remains compatible with v0.7.0.
- Up to 20 files can be selected or dropped in one batch, subject to a 300 MB total-source limit and the existing 100 MB per-file limit.
- Queue rows show filename, format, size, and one of: queued, processing, done, review, partial, failed, or cancelled.
- Conversion is sequential so heavy Office/PDF jobs do not run concurrently by default.
- Failure of one file does not stop later queued files.
- Queued items can be cancelled immediately; current PDF conversion checks cancellation between pages, while other converters discard the result at the next supported checkpoint.
- Additional files can be appended to an active queue while processing continues.
- Selecting a completed queue row switches Markdown, Preview, and Info to that result.
- Individual result export supports normal `.md`, DOCX/PPTX image ZIP output, and optional Base64-embedded Markdown when extracted images exist.
- **Save all as ZIP** includes one folder per successful result, with its Markdown and any extracted `images/` assets.
- Duplicate output folder names are de-duplicated rather than overwritten.
- Individual completed/failed/cancelled rows can be removed; removal offers Undo where practical.
- Clear all uses a confirmation dialog and never deletes original source files.
- Smartphone File / Markdown / Preview / Info bottom tabs remain usable at 320px and 360px with no horizontal scrolling or content hidden behind the bottom bar.
- Japanese and English batch labels fit on narrow screens.
- Runtime external network access remains blocked.
- Both standalone variants open directly from `file://`, and the self-extracting build restores byte-for-byte to the readable standalone HTML.

## 15. Future candidates after v1.0.0

Future work should be prioritized from real usage and issues rather than added automatically. Candidates include:

- PDF layout / table reconstruction improvements
- EPUB input
- OCR for scanned PDFs and image-only documents
- Legacy `.xls` where browser-side compatibility can be kept practical
- OpenDocument formats
- Optional Markdown formatting / Front Matter presets

Legacy `.doc` / `.ppt`, AI summarization, external AI APIs, remote URL conversion, and cloud storage remain outside the v1.0.0 scope unless the specification is changed later.
