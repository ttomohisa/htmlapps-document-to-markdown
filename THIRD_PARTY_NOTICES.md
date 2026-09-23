# Third-Party Notices

Document to Markdown v1.0.0 embeds the following runtime library and selected package assets at build time.

## PDF.js / pdfjs-dist 6.2.108

- Project: PDF.js
- Package: `pdfjs-dist`
- Version: `6.2.108`
- License: Apache License 2.0
- Homepage: https://mozilla.github.io/pdf.js/
- Source: https://github.com/mozilla/pdf.js

PDF.js is used to parse selected PDFs locally and read their text and annotation data. The standalone build also embeds the PDF.js worker and the selected Japanese CMaps `UniJIS-UCS2-H` and `Adobe-Japan1-UCS2`.

The exact package version and npm tarball SHA-256 are pinned in `dependencies.json` and `dependencies.lock.json`. No PDF.js asset is fetched at runtime.

The repository is based on the Browser Kitty `htmlapps-template`. GitHub Actions in the repository reference their respective GitHub-maintained actions under the terms published by those projects.
