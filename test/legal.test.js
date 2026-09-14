'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');

// Spin up a minimal app with the real routers + view stack (no MongoDB needed:
// the home, legal and Cairn-landing routes don't touch the database).
const ROOT = path.join(__dirname, '..');
let server;
let base;

before(async () => {
  const app = express();
  app.set('trust proxy', true); // mirror app.js so X-Forwarded-Host drives req.hostname
  app.use((req, res, next) => { res.locals.appVersion = 'test'; next(); });
  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.use('/resources', express.static(path.join(ROOT, 'resources')));
  app.use('/', require('../routes/index'));
  app.use('/', require('../routes/legal'));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => server && server.close());

const get = (p, host) =>
  fetch(base + p, host ? { headers: { 'x-forwarded-host': host } } : undefined)
    .then(async (r) => ({ status: r.status, body: await r.text() }));

test('/delete meets Google Play data-deletion requirements', async () => {
  const { status, body } = await get('/delete');
  assert.equal(status, 200);
  // Names the app + developer.
  assert.match(body, /Cairn/);
  assert.match(body, /CappyLabs/);
  // Prominent deletion steps (in-app + email).
  assert.match(body, /Danger zone/);
  assert.match(body, /Delete this identity/);
  assert.match(body, /dev@cappylabs\.uk/);
  // Retention specifics.
  assert.match(body, /30 days/);
  // Cairn brand, not the labs-web station chrome.
  assert.match(body, /cairn\.css/);
  assert.doesNotMatch(body, /STATION/);
  // Canonical points at the registered Cairn URL.
  assert.match(body, /<link rel="canonical" href="https:\/\/cairn\.cappylabs\.uk\/delete">/);
});

test('/privacy renders the policy in the Cairn brand', async () => {
  const { status, body } = await get('/privacy');
  assert.equal(status, 200);
  assert.match(body, /Cairn Privacy Policy/);
  assert.match(body, /end-to-end encrypted/i);
  assert.match(body, /ICO/); // GDPR rights
  assert.match(body, /dev@cappylabs\.uk/);
  assert.doesNotMatch(body, /privacy@cappylabs\.uk/); // old placeholder gone
  assert.match(body, /<link rel="canonical" href="https:\/\/cairn\.cappylabs\.uk\/privacy">/);
});

test('legal pages cross-link each other', async () => {
  const del = (await get('/delete')).body;
  const priv = (await get('/privacy')).body;
  assert.match(del, /href="\/privacy"/);
  assert.match(priv, /href="\/delete"/);
});

test('/ on the Cairn host shows the Cairn landing', async () => {
  const { status, body } = await get('/', 'cairn.cappylabs.uk');
  assert.equal(status, 200);
  assert.match(body, /Your location, for the few you trust/);
  assert.match(body, /cairn\.css/);
  assert.doesNotMatch(body, /STATION/);
});

test('/ on the default host shows the labs homepage with Cairn listed', async () => {
  const { status, body } = await get('/', 'cappylabs.uk');
  assert.equal(status, 200);
  assert.match(body, /STATION/);           // labs-web station chrome
  assert.match(body, /Active modules/);
  assert.match(body, /\[CAIRN\]/);         // Cairn module card
});
