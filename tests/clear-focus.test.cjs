'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launch, until } = require('./app-harness.cjs');

async function openClear(t) {
  const context = launch(t);
  const { app, document } = context;
  await app.addFiles([new File(['Synthetic focus audit'], 'focus.txt')]);
  await until(() => !app.busy);
  document.querySelector('#clearButton').focus();
  document.querySelector('#clearButton').click();
  await until(() => document.activeElement.id === 'appConfirmCancel');
  return context;
}

test('confirmed Clear all focuses Choose file after the old opener is hidden', async t => {
  const { app, document } = await openClear(t);
  document.querySelector('#appConfirmOk').click();
  await until(() => app.items.length === 0);
  assert.equal(document.querySelector('#appConfirmDialog').open, false);
  assert.equal(document.activeElement.id, 'chooseButton');
  assert.equal(document.querySelector('#markdownOutput').value, '');
});

test('dismissed Clear all keeps its original opener and results', async t => {
  for (const route of ['appConfirmCancel', 'appConfirmClose', 'escape', 'backdrop']) {
    const { app, document, window } = await openClear(t);
    const dialog = document.querySelector('#appConfirmDialog');
    if (route === 'escape') dialog.dispatchEvent(new window.Event('cancel', { cancelable: true }));
    else if (route === 'backdrop') dialog.dispatchEvent(new window.MouseEvent('click', { clientX: 10, clientY: 10 }));
    else document.getElementById(route).click();
    await Promise.resolve();
    assert.equal(dialog.open, false, route);
    assert.equal(document.activeElement.id, 'clearButton', route);
    assert.equal(app.items.length, 1, route);
  }
});

test('confirmed Clear all does not steal focus from a newer modal', async t => {
  const { app, document } = await openClear(t);
  document.querySelector('#appConfirmOk').click();
  document.querySelector('#helpDialog').showModal();
  document.querySelector('#closeHelpButton').focus();
  await until(() => app.items.length === 0);
  assert.equal(document.querySelector('#helpDialog').open, true);
  assert.equal(document.activeElement.id, 'closeHelpButton');
});

test('an empty session Clear action does not move unrelated focus', t => {
  const { document } = launch(t);
  document.querySelector('#helpButton').focus();
  document.querySelector('#clearButton').click();
  assert.equal(document.querySelector('#appConfirmDialog').open, false);
  assert.equal(document.activeElement.id, 'helpButton');
});
