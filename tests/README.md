# Test fixtures

`fixtures/sample.docx` is a deterministic local DOCX fixture for v0.2.0 conversion checks. It covers:

- Japanese Heading 1
- normal, bold, and italic runs
- unordered and nested ordered numbering
- an external hyperlink
- a two-column table with a merge marker for warning coverage
- one embedded PNG under `word/media/`, referenced from the main document with a DrawingML relationship

`fixtures/sample.expected.md` records the intended Markdown shape. The expected Markdown includes `![docx-sample-image.png](images/image-001.png)`. The extracted PNG must match the embedded package bytes exactly. The fixture intentionally triggers merged-cell and external-link warnings.

`fixtures/sample.pptx` is a deterministic PowerPoint fixture for v0.3.0 conversion checks. It covers:

- two slides in presentation order
- slide titles and content-placeholder text
- inherited bullet levels
- an external hyperlink
- a two-column table
- Speaker Notes on both slides
- one embedded PNG under `ppt/media/`
- one chart under `ppt/charts/` for warning coverage

`fixtures/sample.pptx.expected.md` records the intended Markdown shape. The expected Markdown includes `![pptx-sample-image.png](images/image-001.png)`. The extracted PNG must match the embedded package bytes exactly. The fixture intentionally triggers chart and external-link warnings.


`fixtures/sample.xlsx` is a deterministic Excel fixture for v0.4.0 conversion checks. It covers:

- two visible worksheets in workbook order
- one hidden worksheet
- shared strings, numbers, booleans, and Excel serial dates
- one cached formula result and one formula without a cached result
- merged cells
- drawing/image, comment, and external-link entries for warning coverage

`fixtures/sample.xlsx.expected.md` records the intended Markdown shape. The fixture intentionally triggers hidden-sheet, merged-cell, drawing, comment, external-link, and uncached-formula warnings.


`fixtures/sample.pdf` is the deterministic v0.5.0 text-PDF fixture (retained for v0.8.0 regression). It covers:

- three pages in source order
- large-font heading inference
- paragraphs and list prefixes
- table-like positioned text
- an external link annotation
- rotated text
- a two-column test page
- Japanese CID text for the embedded Japanese CMap path

`fixtures/sample.pdf.expected.md` records the current intended Markdown output.

`fixtures/scanned.pdf` is an image-only PDF and must fail with the explicit OCR-not-supported message rather than producing an empty successful conversion.

## v0.6.0 partial-conversion fixtures

`fixtures/partial.pptx` is derived from the deterministic PPTX fixture with slide 2 deliberately removed from the package. The converter must keep slide 1, return a partial result, and identify **Slide 2** in the Partial failure section.

`fixtures/partial.xlsx` is derived from the deterministic XLSX fixture with the visible `Dates & Formulas` worksheet deliberately removed. The converter must keep the readable worksheet, return a partial result, and identify **Sheet “Dates & Formulas”** in the Partial failure section.
