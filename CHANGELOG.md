# Changelog

All notable changes to this project are documented here.

## [1.0.0] - 2026-09-23

### Added

- Optional Base64 image embedding for DOCX / PPTX results, producing a single Markdown file when requested.
- Final Japanese / English export labels and help copy for the Base64 image mode.

### Changed

- Refined the Markdown export area so the filename, basic actions, and image-specific save options are visually separated instead of appearing as one long button row.
- Kept **Markdown + images ZIP** as the primary image export while presenting Base64 embedding as an explicit optional mode.
- Updated README / README.ja.md to the Browser Kitty release format used by PDF Organizer, including demo, feature, usage, privacy, build, limitation, and dependency sections.
- Promoted the application version from v0.9.0 to v1.0.0.

### Security / Privacy

- Base64 embedding runs entirely in browser memory and does not introduce external requests.
- `connect-src 'none'` and the existing local-processing model remain unchanged.

## [0.9.0] - 2026-09-23

### Added

- Optional **Base64-embedded Markdown** export for DOCX/PPTX results with extracted images. The normal Markdown and ZIP export behavior remains unchanged.
- Drag-and-drop append support while the existing multi-file queue is already visible, without changing the v0.8.0 batch layout.

### Changed

- Restored the v0.8.0 batch/queue layout unchanged after UX review.
- Replaced the generic header subtitle with app-specific copy and shortened the introductory sentence.
- Increased spacing between the major File / Markdown / Preview / Info blocks without changing the overall Browser Kitty visual style.
- Fixed the Help dialog so only the dialog body scrolls instead of showing two vertical scrollbars.

### Security / Privacy

- Base64 embedding is performed only from image bytes already extracted locally from the selected DOCX/PPTX package. No network request is made.

## [0.8.0] - 2026-09-23

### Added

- Multi-file conversion queue for up to 20 files and 300 MB total selected source bytes, while preserving the 100 MB per-file limit.
- Per-file queued, processing, done, review, partial, failed, and cancelled states.
- Sequential queue processing to limit peak CPU and memory usage on desktop and mobile devices.
- File appending while a queue is active plus **Cancel remaining** for queued/current work.
- Result switching by selecting a completed queue row without discarding other results.
- **Save all as ZIP** export with one de-duplicated folder per successful document, including extracted DOCX/PPTX `images/` assets.
- Individual queue-row removal with Undo where practical.

### Changed

- The File page is now a responsive queue instead of a single selected-file card.
- Mobile File / Markdown / Preview / Info navigation now works across multi-file sessions while keeping the fixed bottom bar clear of content.

### Security / Privacy

- Batch conversion remains fully local with `connect-src 'none'`; no selected file or generated result is uploaded or automatically persisted.

## [0.7.0] - 2026-09-23

### Added

- Embedded DOCX image extraction through OOXML image relationships, with relative `images/...` Markdown references.
- Embedded PPTX slide / notes image extraction through DrawingML relationships.
- **Markdown + images ZIP** export for results containing extracted DOCX/PPTX images.
- Deterministic `images/image-001.ext` output names while preserving the original embedded image bytes.
- Clear UI note explaining that `.md`-only output does not contain the referenced image files.
- Image extraction regression coverage that verifies exported image bytes match the Office package bytes exactly.

### Changed

- Extracted DOCX/PPTX images are no longer reported as intentionally omitted conversion items when they are successfully resolved.
- External Office image references remain local-only: URLs may be preserved in Markdown but are never downloaded.

## [0.6.0] - 2026-09-23

### Added

- Unified conversion-quality report with separate Converted, Check recommended, Not converted, and Partial failure sections.
- Source locations for PPTX slide, XLSX sheet, and PDF page diagnostics where available.
- Explicit partial-conversion state so readable output remains usable when part of a document cannot be parsed.

### Changed

- OOXML expanded-data safety-limit errors are now distinguished from the 100 MB source-file limit.
- Existing format warnings are classified consistently across DOCX, PPTX, XLSX, PDF, HTML, CSV, TSV, and TXT.

## [0.5.0] - 2026-09-23

### Added

- Fully local `.pdf` to Markdown conversion using pinned PDF.js / `pdfjs-dist` 6.2.108 embedded in the standalone HTML.
- Page-order extraction with `<!-- Page N -->` source markers and best-effort paragraph, heading, and list reconstruction from PDF text coordinates and font sizes.
- Bundled Japanese PDF CMaps (`UniJIS-UCS2-H` and `Adobe-Japan1-UCS2`) using the same offline asset pattern proven by Browser Kitty PDF Review Notes.
- PDF warnings for inferred structure, rotated/vertical text, possible columns, table-like positioning, form/annotation content, link annotations, and partially unreadable pages where detectable.
- Explicit scan/image-only PDF detection with an OCR-not-supported message, plus explicit password-protected PDF handling.
- Deterministic text-PDF and image-only-PDF regression fixtures, including Japanese CID text and external-link coverage.

### Security

- PDF.js scripting and JavaScript evaluation are disabled, worker/module/CMap assets are embedded locally, and `connect-src 'none'` remains in effect.

## [0.4.0] - 2026-09-22

### Added

- Local `.xlsx` to Markdown conversion using the existing browser-native OOXML ZIP/XML reader.
- Visible worksheet conversion in workbook order with one Markdown table per sheet.
- Shared-string and inline-string support plus numbers, booleans, date/time values, cached formula results, and formula-text fallback when no cached result exists.
- Hidden-sheet exclusion with counts in Document Information.
- XLSX warnings for merged cells, drawings/images/charts, comments/notes, external workbook links, and formulas without cached results.
- Deterministic XLSX regression fixture covering multiple visible sheets, a hidden sheet, dates, booleans, formulas, merged cells, and unsupported workbook objects.

### Fixed

- OOXML relationship resolution now accepts package-absolute targets such as `/xl/worksheets/sheet1.xml`, improving compatibility with files generated by Excel-compatible libraries.

## [0.3.0] - 2026-09-22

### Added

- Local `.pptx` to Markdown conversion using the existing browser-native OOXML ZIP reader.
- PPTX slide-order preservation with `<!-- Slide N -->` source markers.
- Slide titles, text shapes, inherited content-placeholder bullet lists, tables, hyperlinks, and Speaker Notes.
- PPTX statistics for slides, speaker notes, headings, paragraphs, lists, tables, links, and media references.
- Concrete warnings for images, charts, SmartArt/diagrams, audio/video, embedded objects, external links, animations, and transitions where detectable.
- Safe rejection of encrypted/password-protected PPTX and unsupported ZIP compression methods.
- Deterministic PPTX regression fixture with notes, table, hyperlink, image, and chart coverage.
- User-provided Document to Markdown SVG applied as both canonical favicon and app header icon.

## [0.2.0] - 2026-09-22

### Added

- Local `.docx` to Markdown conversion without adding a runtime dependency.
- Browser-native OOXML ZIP reader using `DecompressionStream` and `DOMParser`.
- DOCX headings, paragraphs, bold / italic / strikethrough runs, ordered and unordered lists, tables, and hyperlinks.
- DOCX image counting for the conversion-quality view; image export remains planned for v0.7.0.
- DOCX warnings for merged table cells, text boxes, SmartArt, embedded objects, and external links.
- OOXML safety limits for entry count, total expanded size, and single-entry expanded size.
- Safe rejection of encrypted/password-protected DOCX and unsupported ZIP compression methods.

## [0.1.0] - 2026-09-22

### Added

- Initial Document to Markdown implementation based on the current Browser Kitty `htmlapps-template`.
- Local TXT, HTML, CSV, and TSV to Markdown conversion.
- Safe HTML parsing without executing source scripts or loading remote resources.
- RFC-style CSV/TSV quoted field and multiline field parsing.
- Markdown source, safe preview, and document information views.
- Editable `.md` output filename, copy, and download actions.
- Japanese / English UI in one HTML.
- Smartphone bottom page tabs for File / Markdown / Preview / Info.
- Template confirmation dialog and toast patterns.
- Restrictive no-runtime-network CSP and zero third-party runtime dependencies.
