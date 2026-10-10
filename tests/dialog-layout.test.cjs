'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let html=fs.readFileSync(process.env.AUDIT_HTML || path.join(__dirname,'../src/index.template.html'),'utf8');
if(!html.includes('id="helpDialog"')) {
  const payload=html.match(/id="self-extract-payload"[^>]*>([^<]+)/) || html.match(/const b='([^']+)'/);
  assert.ok(payload,'self-extract payload');
  html=require('node:zlib').gunzipSync(Buffer.from(payload[1],'base64')).toString('utf8');
}
// A source contract, not a geometry substitute: final native checks cover wheel/scroll restoration.
test('Native modal locks root and body only for the lifetime of an open modal',()=>{
  assert.match(html,/html:has\(dialog:modal\),body:has\(dialog:modal\)\s*\{[^}]*overflow\s*:\s*hidden/);
});
test('Help keeps its independent scrolling body and explicit close control',()=>{
  assert.match(html,/\.dialog-body\s*\{[^}]*overflow\s*:\s*auto/);
  assert.match(html,/<button[^>]*id="closeHelpButton"[^>]*type="button"/);
});
test('Local badge keeps the canonical shield and existing truthful text',()=>{
  assert.match(html,/M12 3 5 6v5c0 4\.6 2\.8 8 7 10 4\.2-2 7-5\.4 7-10V6z/);
  assert.ok(html.includes('完全ローカル処理')); assert.ok(html.includes('Fully local processing'));
});
