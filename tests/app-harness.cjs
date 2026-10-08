'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'), 'utf8'));
function launch(t, language = 'en') {
  const messages = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => messages.push(error));
  const dom = new JSDOM(html, { url: 'https://local.test/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  Object.assign(window, { Blob, File, Response, TextEncoder, TextDecoder, DecompressionStream });
  window.URL.createObjectURL = URL.createObjectURL;
  window.URL.revokeObjectURL = URL.revokeObjectURL;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  Object.defineProperty(window.navigator, 'language', { value: language });
  let script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace('__APP_CONFIG_JSON__', JSON.stringify(config))
    .replace('__BUILD_MANIFEST_JSON__', '{"dependencies":[]}')
    .replace('__EMBEDDED_ASSET_BUNDLE_JSON__', '{}');
  script = script.replace(/\}\)\(\);\s*$/, `window.testApp = { convertFile, docxToMarkdown, parseXml, parseDocxStyles, parseDocxNumbering, docxParagraphInfo, renderDocxBlocks, addFiles, cancelItem, resetSession, removeItem, processQueue, showSelectedItem, normalizedFilenameBase, markdownToSafeHtml, openZip, downloadAllResults, downloadMarkdown, get items() { return batchItems; }, get result() { return currentResult; }, get busy() { return processingQueue; } }; })();`);
  window.eval(script);
  if (t) t.after(() => window.close());
  return { window, document: window.document, app: window.testApp, messages };
}
function fixture(name) { return new File([fs.readFileSync(path.join(__dirname, 'fixtures', name))], name); }
async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Timed out waiting for app state'); await new Promise(resolve => setTimeout(resolve, 10)); }
}
const plain = value => JSON.parse(JSON.stringify(value));
module.exports = { launch, fixture, until, plain, html, config };
