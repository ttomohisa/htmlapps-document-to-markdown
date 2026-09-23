# Security Policy

## Supported versions

Security fixes target the latest released version of Document to Markdown.

## Security model

Document to Markdown is a browser-only local-processing application. User-selected files are read with browser File APIs and are not uploaded by the app. The default CSP blocks runtime connections with `connect-src 'none'`. Batch processing is sequential by default; selected source bytes and conversion results remain in memory only for the active page session and are never uploaded or automatically persisted.

HTML input is treated as untrusted: source scripts and event handlers are not executed, and remote resources are not automatically loaded. Generated Markdown preview is rendered through a controlled local subset renderer rather than by inserting source HTML.

## Reporting

Please report security issues privately to the repository owner rather than publishing exploit details in a public issue before a fix is available.

## Office Open XML safety

DOCX, PPTX, and XLSX files are treated as untrusted ZIP/XML input. The app does not execute macros, spreadsheet formulas, media, animations, or embedded objects. v1.0.0 rejects encrypted packages, limits central-directory entry counts and declared expanded sizes, and only accepts STORE / DEFLATE ZIP entries required by normal OOXML documents. External hyperlinks and externally linked images may be retained as Markdown references but are never requested automatically. Embedded DOCX/PPTX image bytes are read only from the selected OOXML package and written only to a user-initiated local ZIP download.


## PDF safety

PDF input is treated as untrusted binary data and parsed with the pinned, embedded PDF.js 6.2.108 assets. PDF scripting is disabled (`enableScripting: false`), JavaScript evaluation is disabled (`isEvalSupported: false`), worker fetching is disabled, and the required worker/module/CMap assets are loaded only from the embedded standalone asset bundle. External link annotations may be retained as Markdown text but are never requested automatically. Password-protected PDFs are rejected, and image-only PDFs are not sent to an OCR service.

## Conversion diagnostics

The v1.0.0 quality report is derived only from local parser observations. It does not send document content to a server and does not claim a probabilistic accuracy score.

## Base64 image export

The optional Base64-embedded Markdown export uses only image bytes already extracted locally from the selected DOCX/PPTX package. It performs no fetch, upload, remote image resolution, or automatic persistence.
