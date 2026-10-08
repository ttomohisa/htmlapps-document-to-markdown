'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, fixture, until, plain } = require('./app-harness.cjs');
const xml = contents => `<w:root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${contents}</w:root>`;
const numbered = '<w:abstractNum w:abstractNumId="8"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="8"/></w:num>';
function paragraphInfo(app, styles, properties) {
  return plain(app.docxParagraphInfo(app.parseXml(xml(`<w:p><w:pPr>${properties}</w:pPr><w:r><w:t>Item</w:t></w:r></w:p>`)).documentElement.firstChild, app.parseDocxStyles(app.parseXml(xml(styles))), app.parseDocxNumbering(app.parseXml(xml(numbered)))));
}
const bulletStyle = '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>';
test('Word ListBullet style preserves bullet markers and list statistics', async t => {
  const { app } = launch(t); const result = await app.docxToMarkdown(fixture('style-lists.docx'));
  assert.match(result.markdown, /^- First item$/m); assert.match(result.markdown, /^- Second item$/m); assert.equal(result.stats.lists, 2);
});
test('numbering inherits through basedOn and direct level overrides only that property', t => {
  const { app } = launch(t);
  const styles = bulletStyle + '<w:style w:type="paragraph" w:styleId="Custom"><w:basedOn w:val="ListBullet"/></w:style>';
  assert.deepEqual(paragraphInfo(app, styles, '<w:pStyle w:val="Custom"/>'), { heading: 0, list: { level: 0, ordered: false } });
  assert.deepEqual(paragraphInfo(app, styles, '<w:pStyle w:val="Custom"/><w:numPr><w:ilvl w:val="1"/></w:numPr>'), { heading: 0, list: { level: 1, ordered: true } });
});
test('explicit numId zero removes inherited numbering and style cycles terminate', t => {
  const { app } = launch(t);
  assert.equal(paragraphInfo(app, bulletStyle, '<w:pStyle w:val="ListBullet"/><w:numPr><w:numId w:val="0"/></w:numPr>').list, null);
  const cycles = '<w:style w:type="paragraph" w:styleId="A"><w:basedOn w:val="B"/></w:style><w:style w:type="paragraph" w:styleId="B"><w:basedOn w:val="A"/></w:style>';
  assert.deepEqual(paragraphInfo(app, cycles, '<w:pStyle w:val="A"/>'), { heading: 0, list: null });
});
test('existing Office fixtures keep exact Markdown and extracted image bytes', async t => {
  const { app } = launch(t);
  for (const [name, expected] of [['sample.docx', 'sample.expected.md'], ['sample.pptx', 'sample.pptx.expected.md'], ['sample.xlsx', 'sample.xlsx.expected.md']]) {
    const result = await app.convertFile(fixture(name));
    assert.equal(result.markdown.trim(), fs.readFileSync(path.join(__dirname, 'fixtures', expected), 'utf8').trim(), name);
    if (name !== 'sample.xlsx') { assert.equal(result.assets.length, 1); assert.ok(result.assets[0].bytes.length > 0); }
  }
});
test('TXT HTML CSV TSV conversion preserves content without executing imported scripts', async t => {
  const { app, window } = launch(t);
  const cases = [['sample.txt', 'hello\r\nworld', /hello\nworld/], ['sample.csv', 'Name,Note\nA,"x|y"', /x\\\|y/], ['sample.tsv', 'Name\tNote\nA\tB', /\| A \| B \|/], ['sample.html', '<h1>Safe</h1><script>window.pwned=1</script><p>Hello</p><img src="https://example.test/tracker">', /# Safe/]];
  for (const [name, text, expected] of cases) assert.match((await app.convertFile(new File([text], name))).markdown, expected);
  assert.equal(window.pwned, undefined); assert.doesNotMatch(app.markdownToSafeHtml('![remote](https://example.test/a.png)'), /<img/);
});
test('invalid empty unsupported and oversized files fail with explicit codes', async t => {
  const { app } = launch(t);
  for (const [file, code] of [[new File(['bad'], 'bad.docx'), 'DOCX_INVALID'], [new File([''], 'empty.txt'), 'EMPTY'], [new File(['a'], 'bad.exe'), 'UNSUPPORTED'], [{ name: 'big.txt', size: 101 * 1024 * 1024 }, 'TOO_LARGE']]) await assert.rejects(app.convertFile(file), new RegExp(code));
});
test('retry cancelled queue item once without duplicating file or changing output name', async t => {
  const { app, document } = launch(t);
  await app.addFiles([new File(['First'], 'one.txt'), new File(['Second'], 'two.txt')]);
  const item = app.items[1]; item.outputBase = 'custom-name'; app.cancelItem(item.id);
  await until(() => !app.busy);
  const retry = document.querySelector(`[data-retry-item="${item.id}"]`); assert.ok(retry, 'cancelled row must expose Retry');
  retry.click(); retry.click(); await until(() => !app.busy);
  assert.equal(app.items.length, 2); assert.equal(item.status, 'done'); assert.equal(item.outputBase, 'custom-name'); assert.equal(item.result.markdown.trim(), 'Second');
  assert.equal(document.querySelector(`[data-retry-item="${item.id}"]`), null);
});
test('failed conversion can retry and a remaining invalid file stays failed', async t => {
  const { app, document } = launch(t); let attempts = 0;
  const file = { name: 'retry.txt', size: 8, async text() { if (++attempts === 1) throw new Error('EMPTY'); return 'Recovered'; } };
  await app.addFiles([file, new File(['bad'], 'invalid.docx')]); await until(() => !app.busy);
  assert.equal(app.items[0].status, 'failed');
  const retry = document.querySelector(`[data-retry-item="${app.items[0].id}"]`); assert.ok(retry, 'failed row must expose Retry'); retry.click(); await until(() => !app.busy);
  assert.equal(app.items[0].status, 'done'); assert.equal(app.items[1].status, 'failed'); assert.equal(attempts, 2);
});
test('clear while a conversion is waiting prevents stale results from reappearing', async t => {
  const { app } = launch(t); let finish;
  await app.addFiles([{ name: 'slow.txt', size: 3, text: () => new Promise(resolve => { finish = resolve; }) }]); await until(() => finish);
  app.resetSession(); await app.addFiles([new File(['New content'], 'new.txt')]); finish('Old content'); await until(() => !app.busy);
  assert.equal(app.items.length, 1); assert.equal(app.items[0].file.name, 'new.txt'); assert.equal(app.result.markdown.trim(), 'New content');
});
test('header uses compact destination language, localized help and actual patch version', t => {
  for (const lang of ['en', 'ja']) {
    const { document } = launch(t, lang); const button = document.querySelector('#languageButton');
    assert.equal(button.textContent, lang === 'ja' ? 'EN' : 'JA'); assert.equal(button.title, button.getAttribute('aria-label'));
    assert.equal(document.querySelector('#versionBadge').textContent, 'v1.0.1');
    assert.equal(document.querySelector('#helpButton').title, document.querySelector('#helpButton').getAttribute('aria-label'));
    if (lang === 'ja') assert.equal(document.querySelector('[data-i18n="localBadge"]').textContent, '完全ローカル処理');
  }
});
test('partial Office fixtures retain good content and report the missing unit', async t => {
  const { app } = launch(t);
  for (const name of ['partial.pptx', 'partial.xlsx']) { const result = await app.convertFile(fixture(name)); assert.equal(result.quality.state, 'partial'); assert.ok(result.markdown.trim()); assert.ok(result.quality.entries.some(e => e.severity === 'partial' && e.location)); }
});
test('direct numbering still wins and malformed levels do not discard paragraph content', t => {
  const { app } = launch(t);
  for (const level of ['-1', 'NaN', '99999999']) { const result = paragraphInfo(app, bulletStyle, `<w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="${level}"/></w:numPr>`); assert.ok(result.list.level >= 0 && result.list.level <= 8); }
});
test('processing cancellation discards pending content and retry restarts only after settlement', async t => {
  const { app, document } = launch(t); let finish, calls = 0;
  await app.addFiles([{ name: 'slow.txt', size: 4, text() { calls++; return calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve('Retry output'); } }]);
  await until(() => finish); const item = app.items[0]; app.cancelItem(item.id);
  assert.equal(document.querySelector('[data-retry-item]'), null); finish('Cancelled output'); await until(() => !app.busy);
  assert.equal(item.status, 'cancelled'); assert.equal(item.result, null);
  document.querySelector('[data-retry-item]').click(); await until(() => !app.busy);
  assert.equal(calls, 2); assert.equal(item.result.markdown.trim(), 'Retry output');
});
test('image asset exports preserve original package bytes', async t => {
  const { app } = launch(t);
  for (const name of ['sample.docx', 'sample.pptx']) { const file = fixture(name), zip = await app.openZip(await file.arrayBuffer()), result = await app.convertFile(file); for (const asset of result.assets) assert.deepEqual(Buffer.from(asset.bytes), Buffer.from(await zip.read(asset.sourcePath, false))); }
});
test('batch ZIP separates duplicate filenames and preserves Markdown bytes', async t => {
  const { app, window } = launch(t); const saved = [];
  window.URL.createObjectURL = blob => { saved.push(blob); return 'blob:test'; }; window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  await app.addFiles([new File(['Alpha'], 'same.txt'), new File(['Beta'], 'same.txt')]); await until(() => !app.busy);
  await app.downloadAllResults(); const zip = await app.openZip(await saved[0].arrayBuffer());
  assert.equal((await zip.read('same/same.md')).trim(), 'Alpha'); assert.equal((await zip.read('same-2/same.md')).trim(), 'Beta');
});
test('individual Markdown save uses edited safe filename and exact UTF-8 content', async t => {
  const { app, window, document } = launch(t); let saved, filename;
  window.URL.createObjectURL = blob => { saved = blob; return 'blob:test'; }; window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  await app.addFiles([new File(['日本語 output'], 'input.txt')]); await until(() => !app.busy);
  document.querySelector('#outputFilename').value = '../renamed:test.md'; app.downloadMarkdown();
  assert.equal(filename.includes('/'), false); assert.equal(filename.includes(':'), false); assert.equal(filename.endsWith('.md'), true);
  assert.equal(await saved.text(), app.result.markdown);
});
test('style-linked multilevel numbering resolves its pStyle level and marker', t => {
  const { app } = launch(t);
  const styles = app.parseDocxStyles(app.parseXml(xml('<w:style w:type="paragraph" w:styleId="NestedBullet"><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>')));
  const numbering = app.parseDocxNumbering(app.parseXml(xml('<w:abstractNum w:abstractNumId="8"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:pStyle w:val="NestedBullet"/><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="8"/></w:num>')));
  const paragraph = app.parseXml(xml('<w:p><w:pPr><w:pStyle w:val="NestedBullet"/></w:pPr></w:p>')).documentElement.firstChild;
  assert.deepEqual(plain(app.docxParagraphInfo(paragraph, styles, numbering)), { heading: 0, list: { level: 1, ordered: false } });
});
test('body style based on Heading1 does not acquire a heading from numbering inheritance', t => {
  const { app } = launch(t);
  const styles = '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Body"><w:basedOn w:val="Heading1"/><w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:style>';
  assert.equal(paragraphInfo(app, styles, '<w:pStyle w:val="Body"/>').heading, 0);
});
