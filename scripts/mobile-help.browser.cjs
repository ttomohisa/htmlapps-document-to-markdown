'use strict';
// Run against the official generated files in the unprivileged PR build job.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const buildSelector = "#helpDialog details.build-details";
const disclosureSelector = "#helpDialog details.build-details";


async function prepareApp(page,width,label){
 assert.equal(await page.locator('#heroTitle').count(),0,label+': no hero title');
 assert.equal(await page.locator('[data-i18n="dropSub"]').count(),0,label+': no redundant drop subtitle');
 assert.equal(await page.locator('#pageIntro').isVisible(),true,label+': initial description');
 if(!label.startsWith('document-to-markdown.html')){assert.ok(await page.evaluate(()=>{const main=document.querySelector('main').getBoundingClientRect(),head=document.querySelector('.header-inner').getBoundingClientRect(),footer=document.querySelector('footer');return Math.abs(main.left-head.left)<1&&Math.abs(main.right-head.right)<1&&(getComputedStyle(footer).display==='none'||Math.abs(footer.getBoundingClientRect().left-main.left)<1&&Math.abs(footer.getBoundingClientRect().right-main.right)<1)}),label+': aligned content width');}
 assert.equal(await page.locator('#appMobileBottomBar').isVisible(),width<=600,label+': functional page tabs');
 if(width<=600)assert.ok(await page.locator('#appMobileBottomBar').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),label+': functional tabs fit');
}
async function smoke(page,results,file){
 await page.locator('#fileInput').setInputFiles({name:'synthetic-document.html',mimeType:'text/html',buffer:Buffer.from('<!doctype html><h1>Synthetic heading</h1><p>Local sample paragraph.</p><ul><li>First</li><li>Second</li></ul>')});await page.waitForFunction(()=>!document.querySelector('#downloadButton').disabled);assert.equal(await page.locator('#pageIntro').isVisible(),false);assert.equal(await page.locator('#fileIntro').isVisible(),false);await page.locator('#mobileInfo').click();assert.ok(await page.locator('dl.stats-grid .stat-row').count()>0);assert.equal(await page.locator('.stat-card').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(results,file.includes('self-extract')?'info-mobile-loader.png':'info-mobile-readable.png')});await page.locator('#mobileMarkdown').click();assert.ok(await page.locator('#downloadButton').evaluate(el=>el.getBoundingClientRect().top<document.querySelector('#markdownOutput').getBoundingClientRect().top));assert.ok(await page.locator('#editUndo').evaluate(el=>!!el.querySelector('svg')&&!!el.getAttribute('aria-label')&&el.getBoundingClientRect().width>=40));const original=await page.locator('#markdownOutput').inputValue();await page.locator('#markdownOutput').fill(original+'\nMobile edit');await page.locator('#editUndo').click();assert.equal(await page.locator('#markdownOutput').inputValue(),original);await page.locator('#editRedo').click();await page.locator('#outputFilename').fill('mobile-help-document');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(results,file.includes('self-extract')?'editor-mobile-loader.png':'editor-mobile-readable.png')});
 const pending=page.waitForEvent('download');await page.locator('#downloadButton').click();const download=await pending;assert.equal(download.suggestedFilename(),'mobile-help-document.md');const target=path.join(results,file.includes('self-extract')?'synthetic-loader.md':'synthetic-readable.md');await download.saveAs(target);const markdown=fs.readFileSync(target,'utf8');assert.match(markdown,/# Synthetic heading/);assert.match(markdown,/Local sample paragraph/);assert.match(markdown,/First/);assert.match(markdown,/Second/);assert.match(markdown,/Mobile edit/);
 console.log('PASS synthetic HTML to edited-name Markdown '+file);
}

async function conversionSmoke(page,errors,results,file){
 const root=path.resolve(__dirname,'..','tests','fixtures');
 async function load(name,expected){
   await page.locator('#fileInput').setInputFiles(path.join(root,name));
   await page.waitForFunction(name=>[...document.querySelectorAll('.queue-item')].some(el=>el.querySelector('.file-name')?.textContent===name&&['done','review','partial','failed'].includes(el.querySelector('.queue-state')?.dataset.state)),name,{timeout:60000});
   const row=page.locator('.queue-item').filter({has:page.locator('.file-name',{hasText:name})}).first();
   const status=await row.locator('.queue-state').getAttribute('data-state');
   if(expected){assert.ok(['done','review','partial'].includes(status),name+' '+status);await row.locator('.queue-main').click();assert.match(await page.locator('#markdownOutput').inputValue(),expected,name);}
   else assert.equal(status,'failed',name);
 }
 await load('sample.docx',/テスト文書/);
 assert.equal(await page.locator('#previewSurface img').count(),1);
 await load('sample.pptx',/Quarterly Review/);
 assert.equal(await page.locator('#pageIntro').isVisible(),false);assert.ok(await page.locator('dl.stats-grid .stat-row').count()>=8);assert.equal(await page.locator('.stat-card').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await load('sample.xlsx',/売上 2026/);
 await load('sample.pdf',/日本語PDFテスト/);
 await page.locator('#conversionSettings > summary').click();await page.locator('#sourceRange').fill('3');await page.locator('#applyConversion').click();await page.waitForFunction(()=>document.querySelector('#markdownOutput').value.includes('<!-- Page 3 -->')&&!document.querySelector('#markdownOutput').value.includes('<!-- Page 1 -->'),null,{timeout:60000});
 await page.locator('#partialExport > summary').click();await page.locator('#partialRange').fill('3');let pending=page.waitForEvent('download');await page.locator('#savePartial').click();let download=await pending;const target=path.join(results,file.includes('self-extract')?'partial-loader.md':'partial-readable.md');await download.saveAs(target);assert.match(fs.readFileSync(target,'utf8'),/日本語PDFテスト/);
 await page.locator('[data-workspace-view="info"]').click();assert.equal(await page.locator('#infoPage').isVisible(),true);await page.locator('[data-workspace-view="split"]').click();assert.equal(await page.locator('#markdownPage').isVisible(),true);assert.equal(await page.locator('#previewPage').isVisible(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(results,file.includes('self-extract')?'workspace-loader.png':'workspace-readable.png')});
 assert.ok(await page.locator('#downloadAllButton').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return Math.abs(a.width-b.width)<1}));await page.locator('#combineButton').click();await page.locator('#combineEmbed').check();await page.locator('#combineName').fill('combined-test');pending=page.waitForEvent('download');await page.locator('#saveCombined').click();download=await pending;assert.equal(download.suggestedFilename(),'combined-test.md');const combinedPath=path.join(results,file.includes('self-extract')?'combined-loader.md':'combined-readable.md');await download.saveAs(combinedPath);const combined=fs.readFileSync(combinedPath,'utf8');assert.match(combined,/sample.docx/);assert.match(combined,/sample.pdf/);assert.match(combined,/data:image\/png;base64,/);
 const start=errors.length;
 await load('scanned.pdf',null);
 const expectedErrors=errors.splice(start).filter(message=>!message.includes('PDF_NO_TEXT'));
 errors.push(...expectedErrors);
 console.log('PASS local Office, PDF and scanned PDF fixtures');
}
async function main() {
  const results = path.resolve(__dirname, '..', 'test-results', 'mobile-help');
  fs.mkdirSync(results, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'document-to-markdown.html']) {
      for (const language of ['ja', 'en']) {
        for (const [width, height] of [[1360, 900], [601, 568], [600, 568], [360, 640], [320, 568], [393, 252]]) {
          const context = await browser.newContext({ viewport: { width, height }, locale: language, reducedMotion: 'reduce' });
          const page = await context.newPage();
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
          page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
          const label = `${file} ${language} ${width}x${height}`;
          try {
            await page.goto(pathToFileURL(path.resolve(__dirname, '..', file)).href);
            await page.locator('#helpButton').waitFor();
            if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
            await page.locator('#languageButton').click();await page.locator('#languageButton').click();
            assert.equal(await page.locator('html').getAttribute('lang'),language,label+': repeated language toggles');
            for(const id of ["buildVersion", "builtAt", "dependencyCount"]){assert.equal(await page.locator('#'+id).count(),1,label+': unique metadata after toggles');assert.ok(!['','—','-'].includes((await page.locator('#'+id).textContent()).trim()),label+': populated metadata after toggles');}
            assert.equal(await page.locator('[data-i18n="localBadge"]').textContent(), language === 'en' ? 'Fully local processing' : '完全ローカル処理', label);
            assert.equal(await page.locator('.local-badge').isVisible(),width>600,label+': desktop-only local badge');
            if(width>600)assert.ok(await page.locator('.local-badge').evaluate(el => {
              const box = el.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(el.querySelector('[data-i18n="localBadge"]'));
              return box.left >= 0 && box.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1
                && [...range.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
            }), label + ': badge text fits');
            assert.equal(await page.locator('main #buildVersion').count(), 0, label);
            assert.equal(await page.locator('footer').isVisible(), width > 600, label);
            await prepareApp(page, width, label);

            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');

            await page.locator('#helpButton').click();
            const body = page.locator('#helpDialog > .dialog-body');
            assert.ok(await body.evaluate(el => el.lastElementChild.contains(document.querySelector('#buildVersion'))), label + ': build is final body child');
            assert.equal(await page.locator(buildSelector).count(), 1, label);
            assert.equal(await page.locator(buildSelector).isVisible(), true, label);
            for (const id of ["buildVersion", "builtAt", "dependencyCount"]) assert.equal(await page.locator('#' + id).count(), 1, label);

            if (await page.locator(disclosureSelector).getAttribute('open') === null) {
              const summary = page.locator(disclosureSelector).locator('summary');
              await summary.focus();
              await page.keyboard.press('Enter');
              assert.equal(await page.locator(disclosureSelector).getAttribute('open'), '', label);
              assert.notEqual(await page.locator('#buildVersion').innerText(), '—', label);
              assert.ok(!['','—','-'].includes((await page.locator("#dependencyCount").innerText()).trim()),label+': populated metadata');
            }
            await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
            const finalItem = page.locator("#dependencyCount");
            const finalBox = await finalItem.boundingBox(), bodyBox = await body.boundingBox();
            console.log('GEOMETRY ' + label + ' ' + JSON.stringify({ finalBox, bodyBox, viewportHeight: height }));
            assert.ok(finalBox && bodyBox && finalBox.y >= 0 && finalBox.y + finalBox.height <= height && finalBox.y >= bodyBox.y - 1 && finalBox.y + finalBox.height <= bodyBox.y + bodyBox.height + 1, label + ': final Help item reachable');
            assert.ok(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': Help width');
            const headerBox = await page.locator('#helpDialog .dialog-header').boundingBox();
            assert.ok(headerBox && headerBox.x >= 0 && headerBox.x + headerBox.width <= width && headerBox.y >= 0 && headerBox.y + headerBox.height <= height, label + ': header visible');
            const closeBox=await page.locator('#closeHelpButton').boundingBox();
            assert.ok(closeBox && closeBox.x>=0 && closeBox.x+closeBox.width<=width && closeBox.y>=headerBox.y && closeBox.y+closeBox.height<=headerBox.y+headerBox.height+1,label+': Close fits header');
            if (file === 'dist/index.html' && [1360, 320].includes(width)) {
              await page.screenshot({ path: path.join(results, `help-${language}-${width}.png`) });
            }
            const dialogBox = await page.locator('#helpDialog').boundingBox();
            assert.ok(finalBox.y >= dialogBox.y - 1 && finalBox.y + finalBox.height <= dialogBox.y + dialogBox.height + 1, label + ': final item inside dialog');
            assert.ok(dialogBox.y > 1, label + ': top coordinate is genuine backdrop');
            const beforeScroll = await page.evaluate(() => scrollY);
            await page.mouse.move(2, 1);
            await page.mouse.wheel(0, 400);
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => scrollY), beforeScroll, label + ': background locked');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Escape');
            await page.locator('#helpButton').click();
            await page.locator('#closeHelpButton').click();
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': reopen and Close');
            await page.locator('#helpButton').click();
            await page.mouse.click(2, 1);
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': backdrop');
            if(file!=='document-to-markdown.html' && language==='ja' && width===360) await smoke(page,results,file);
            if(file!=='document-to-markdown.html'&&language==='en'&&width===1360){await context.setOffline(true);await conversionSmoke(page,errors,results,file);}
            assert.deepEqual(errors, [], label + ': console errors');
            assert.deepEqual(requests, [], label + ': external runtime requests');
            console.log('PASS ' + label);
          } catch (error) {
            await page.screenshot({ path: path.join(results, `failure-${file.replace(/[^a-z0-9]/gi, '-')}-${language}-${width}x${height}.png`) }).catch(() => {});
            throw error;
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
