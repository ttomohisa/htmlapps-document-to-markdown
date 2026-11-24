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
    assert.equal(document.querySelector('#versionBadge').textContent, 'v1.1.0');
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
test('image-only export panel is truly hidden for no-image results and after clear', async t => {
  const { app, window, document } = launch(t); const panel = document.querySelector('#assetExportOptions');
  assert.equal(window.getComputedStyle(panel).display, 'none', 'initial hidden panel must not be displayed');
  await app.addFiles([new File(['No images'], 'plain.txt'), fixture('sample.docx')]); await until(() => !app.busy);
  app.showSelectedItem(app.items[0]); assert.equal(panel.hidden, true); assert.equal(window.getComputedStyle(panel).display, 'none');
  app.showSelectedItem(app.items[1]); assert.equal(panel.hidden, false); assert.notEqual(window.getComputedStyle(panel).display, 'none');
  app.showSelectedItem(app.items[0]); assert.equal(window.getComputedStyle(panel).display, 'none');
  app.resetSession(); assert.equal(panel.hidden, true); assert.equal(window.getComputedStyle(panel).display, 'none');
});
test('retrying a cancelled text file does not expose image-export actions', async t => {
  const { app, window, document } = launch(t);
  await app.addFiles([new File(['first'], 'first.txt'), new File(['retry'], 'retry.txt')]); const item = app.items[1]; app.cancelItem(item.id); await until(() => !app.busy);
  document.querySelector(`[data-retry-item="${item.id}"]`).click(); await until(() => !app.busy); app.showSelectedItem(item);
  assert.equal(window.getComputedStyle(document.querySelector('#assetExportOptions')).display, 'none');
});

test('Excel date, time, elapsed duration and styled blank cells are distinct', t => {
  const {app}=launch(t); const styles=fmt=>({xfs:[fmt],custom:new Map()});
  assert.equal(app.xlsxSerialDate(0.5,false,0,styles(20)),'12:00:00');
  assert.equal(app.xlsxSerialDate(1.5,false,0,styles(46)),'36:00:00');
  assert.equal(app.xlsxSerialDate('',false,0,styles(14)),null);
  assert.equal(app.xlsxSerialDate(60,false,0,styles(14)),'1900-02-29');
  const c=app.parseXml('<c s="0"/>').documentElement;
  assert.equal(app.xlsxCellValue(c,[],styles(14),false,[],{formulas:0}),'');
});
test('sparse Excel ranges are rejected before allocating a rectangular table',t=>{
  const {app}=launch(t), styles={xfs:[],custom:new Map()};
  const sheet=app.parseXml('<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c></row><row r="1048576"><c r="XFD1048576"><v>2</v></c></row></sheetData></worksheet>');
  assert.throws(()=>app.renderXlsxWorksheet(sheet,[],styles,false,[],{formulas:0}),/XLSX_RANGE/);
});
test('Shift_JIS and BOM UTF-16 files decode locally and report source encoding',async t=>{
  const {app}=launch(t);
  const sj=await app.convertFile(new File([Uint8Array.from([0x93,0xfa,0x96,0x7b])],'jp.txt'));
  assert.equal(sj.markdown.trim(),'日本');assert.equal(sj.encoding,'Shift_JIS');
  const utf=await app.convertFile(new File([Uint8Array.from([255,254,65,0])],'utf.txt'));
  assert.equal(utf.markdown.trim(),'A');assert.equal(utf.encoding,'UTF-16LE');
});
test('large CSV does not spread all rows as function arguments',async t=>{
  const {app}=launch(t);const r=await app.convertFile(new File(['name\n'+'a\n'.repeat(200000)],'large.csv'));
  assert.equal(r.stats.rows,200001);
});
test('HTML without convertible content fails explicitly and preformatted lines survive',async t=>{
  const {app}=launch(t);
  await assert.rejects(app.convertFile(new File(['<script>void 0</script>'],'empty.html')),/EMPTY/);
  const r=await app.convertFile(new File(['<pre>A\n\n\nB</pre>'],'pre.html'));
  assert.match(r.markdown,/A\n\n\nB/);
});
test('batch ZIP folder allocation avoids collision with existing numeric suffix',async t=>{
  const {app,window}=launch(t);let saved;
  window.URL.createObjectURL=blob=>{saved=blob;return 'blob:test'};window.URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=function(){};
  await app.addFiles([new File(['A'],'same.txt'),new File(['B'],'same.txt'),new File(['C'],'same-2.txt')]);await until(()=>!app.busy);
  app.downloadAllResults();const zip=await app.openZip(await saved.arrayBuffer());
  assert.equal((await zip.read('same/same.md')).trim(),'A');
  assert.equal((await zip.read('same-2/same.md')).trim(),'B');
  assert.equal((await zip.read('same-2-2/same-2.md')).trim(),'C');
});
test('CSV retains explicit final empty row',async t=>{
  const {app}=launch(t);const r=await app.convertFile(new File(['a,b\nx,y\n,\n'],'empty-row.csv'));
  assert.equal(r.stats.rows,3);assert.match(r.markdown,/\|  \|  \|/);
});

test('HTML whitespace follows HTML semantics and explicit line breaks survive',async t=>{
 const {app}=launch(t);const r=await app.convertFile(new File(['<p>A\n B<br>C</p>'],'line.html'));
 assert.match(r.markdown,/A B  \nC/);assert.match(app.markdownToSafeHtml(r.markdown),/A B<br>C/);
});
test('safe preview does not rewrite emphasis in generated link attributes',t=>{
 const {app}=launch(t);assert.match(app.markdownToSafeHtml('[Link](https://example.com/a*b*c)'),/href="https:\/\/example\.com\/a\*b\*c"/);
 assert.doesNotMatch(app.markdownToSafeHtml('[Link](java\t script:bad)'),/<a /);
 assert.doesNotMatch(app.markdownToSafeHtml('[Link](javascript:bad)'),/<a /);
});
test('CSV conversion cancellation is observed at a cooperative checkpoint',async t=>{
 const {app}=launch(t);const control={cancelRequested:false};
 const result=app.convertFile(new File(['a\n'+'b\n'.repeat(200000)],'large.csv'),control);
 setTimeout(()=>{control.cancelRequested=true},0);
 await assert.rejects(result,/CANCELLED/);
});

test('preview preserves nested lists and ordered start values',t=>{
 const {app,document}=launch(t);const div=document.createElement('div');
 div.innerHTML=app.markdownToSafeHtml('3. Parent\n  - Child\n4. Next');
 assert.equal(div.querySelector('ol').start,3);assert.equal(div.querySelector('ol > li > ul > li').textContent,'Child');
 assert.equal(div.querySelectorAll('ol > li').length,2);
});
test('embedded raster images render with blob URLs; external references remain placeholders',async t=>{
 const {app,document}=launch(t);
 await app.addFiles([fixture('sample.docx')]);await until(()=>!app.busy);
 assert.match(document.querySelector('#previewSurface img').getAttribute('src'),/^blob:/);
 assert.doesNotMatch(app.markdownToSafeHtml('![remote](https://example.test/image.png)'),/<img/);
 app.resetSession();assert.equal(document.querySelector('#previewSurface img'),null);
});
test('custom Word outline levels and direct body override are respected',t=>{
 const {app}=launch(t);
 const styles='<w:style w:type="paragraph" w:styleId="Custom"><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>';
 assert.equal(paragraphInfo(app,styles,'<w:pStyle w:val="Custom"/>').heading,2);
 assert.equal(paragraphInfo(app,styles,'<w:pStyle w:val="Custom"/><w:outlineLvl w:val="9"/>').heading,0);
});
test('HTML ordered-list start is preserved',async t=>{
 const {app}=launch(t);const r=await app.convertFile(new File(['<ol start="5"><li>Item</li></ol>'],'list.html'));
 assert.match(r.markdown,/^5\. Item/m);
});
test('HTML conversion cooperates with cancellation',async t=>{
 const {app}=launch(t);const control={cancelRequested:false};
 const promise=app.convertFile(new File(['<div>text</div>'.repeat(500)],'large.html'),control);
 setTimeout(()=>{control.cancelRequested=true},0);await assert.rejects(promise,/CANCELLED/);
});

test('intro has no title or redundant drop subtitle and hides until queue is empty',async t=>{
 const {app,document}=launch(t);
 const intro=document.querySelector('#pageIntro'),fileIntro=document.querySelector('#fileIntro');
 assert.equal(document.querySelector('#heroTitle'),null);
 assert.equal(document.querySelector('[data-i18n="dropSub"]'),null);
 assert.equal(intro.classList.contains('hidden'),false);
 await app.addFiles([new File(['# Sample'],'one.txt')]);await until(()=>!app.busy);
 assert.equal(intro.classList.contains('hidden'),true);
 assert.equal(fileIntro.classList.contains('hidden'),true);
 app.removeItem(app.items[0].id);
 assert.equal(intro.classList.contains('hidden'),false);
 document.querySelector('#appToastAction').click();
 assert.equal(intro.classList.contains('hidden'),true);
 app.resetSession();
 assert.equal(intro.classList.contains('hidden'),false);
 assert.equal(fileIntro.classList.contains('hidden'),false);
});
test('document statistics are labeled definition-list rows and retain zero values',async t=>{
 const {app,document}=launch(t,'ja');
 await app.addFiles([fixture('sample.pptx')]);await until(()=>!app.busy);
 const stats=document.querySelector('dl.stats-grid');
 assert.ok(stats);
 assert.equal(stats.querySelector('.stat-card'),null);
 const rows=[...stats.querySelectorAll('.stat-row')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent]);
 assert.ok(rows.some(([label])=>label==='発表者ノート'));
 assert.ok(rows.length>=8);
 document.querySelector('#languageButton').click();
 assert.equal(document.documentElement.lang,'en');
 assert.ok([...document.querySelectorAll('.stats-grid dt')].some(el=>el.textContent==='Speaker notes'));
 app.resetSession();
 await app.addFiles([new File(['<p>Only text</p>'],'zero-counts.html')]);await until(()=>!app.busy);
 const zeroRows=new Map([...document.querySelectorAll('.stats-grid .stat-row')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent]));
 assert.equal(zeroRows.get('Images'),'0');
 assert.equal(zeroRows.get('Tables'),'0');
});

test('partial conversion uses original slide and visible-sheet numbers',async t=>{
 const {app}=launch(t);
 const ppt=await app.convertFile(fixture('sample.pptx'),{settings:{range:'2'}});
 assert.match(ppt.markdown,/<!-- Slide 2 -->/);assert.doesNotMatch(ppt.markdown,/Quarterly Review/);assert.equal(ppt.stats.slides,1);assert.equal(ppt.catalog.length,2);
 const xls=await app.convertFile(fixture('sample.xlsx'),{settings:{range:'2'}});
 assert.match(xls.markdown,/Dates & Formulas/);assert.doesNotMatch(xls.markdown,/売上 2026/);assert.equal(xls.stats.sheets,1);
 await assert.rejects(app.convertFile(fixture('sample.pptx'),{settings:{range:'3'}}),/INVALID_RANGE/);
});
test('partial save selects source units without unrelated image assets',async t=>{
 const {app}=launch(t);const r=await app.convertFile(fixture('sample.pptx'));
 const part=app.selectPartialOutput(r,'2');assert.match(part.markdown,/Risks/);assert.equal(part.assets.length,0);
 assert.throws(()=>app.selectPartialOutput(r,'0'),/INVALID_RANGE/);
});
test('explicit decoding can override auto detection',async t=>{
 const {app}=launch(t);const result=await app.convertFile(new File([Uint8Array.of(0xe9)],'legacy.txt'),{settings:{encoding:'Windows-1252'}});
 assert.equal(result.markdown.trim(),'é');assert.equal(result.encoding,'Windows-1252');
});
test('output options preserve code and default output, omit requested features',async t=>{
 const {app}=launch(t);const r=await app.convertFile(fixture('sample.pptx'),{settings:{images:false,notes:false,links:false,headings:false,tables:false,formatting:false}});
 assert.equal(r.assets.length,0);assert.doesNotMatch(r.markdown,/Speaker Notes|!\[|https:\/\/example\.com|^## /m);assert.match(r.markdown,/Region\tRevenue/);
 const code='**bold**\n\n\x60\x60\x60\n**literal**\n\x60\x60\x60\n';assert.match(app.transformOutput(code,{headings:true,formatting:false,links:true,tables:true,images:true}),/\*\*literal\*\*/);
});
test('combined documents namespace their local image references',async t=>{
 const {app}=launch(t);const file=fixture('sample.docx'),result=await app.convertFile(file);
 const out=app.combineResults([{file,result},{file,result}],{headings:true,separator:true});
 assert.equal(out.assets.length,2);assert.notEqual(out.assets[0].path,out.assets[1].path);assert.ok(out.assets.every(asset=>out.markdown.includes(']('+asset.path+')')));assert.match(out.markdown,/\n---\n/);
});
