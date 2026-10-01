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
  app.use('/', require('../routes/cairn'));
  app.use(require('../controllers/cairnController').notFound);
  app.use((req, res) => res.status(404).send('labs 404'));

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

// ── Cairn site ────────────────────────────────────────────────────────

const CAIRN = 'cairn.cappylabs.uk';
const getRaw = (p, host) =>
  fetch(base + p, host ? { headers: { 'x-forwarded-host': host } } : undefined);

test('the landing says "identity", not "account", next to "No accounts"', async () => {
  const { body } = await get('/', CAIRN);
  assert.match(body, /No accounts/);
  assert.match(body, /Delete your identity and all associated data/);
  assert.doesNotMatch(body, /Delete your account/);
});

test('the landing explains background location and misuse safeguards', async () => {
  const { body } = await get('/', CAIRN);
  assert.match(body, /Why Cairn asks for background location/);
  assert.match(body, /all the time/);
  assert.match(body, /can't be used to track someone secretly/);
  assert.match(body, /What Cairn isn't/);
  assert.match(body, /application\/ld\+json/);
  assert.match(body, /"@type":"SoftwareApplication"/);
});

test('Cairn pages share large PNG previews, touch icon, manifest and en-GB', async () => {
  const { body } = await get('/', CAIRN);
  assert.match(body, /<html lang="en-GB">/);
  assert.match(body, /og:image" content="https:\/\/cairn\.cappylabs\.uk\/resources\/images\/cairn-og\.png"/);
  assert.match(body, /twitter:card" content="summary_large_image"/);
  assert.match(body, /rel="apple-touch-icon" href="\/resources\/images\/cairn-apple-touch-icon\.png"/);
  assert.match(body, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(body, /sets no cookies/);
  for (const img of ['cairn-og.png', 'cairn-apple-touch-icon.png', 'cairn-icon-192.png', 'cairn-icon-512.png']) {
    const r = await getRaw(`/resources/images/${img}`);
    assert.equal(r.status, 200, img);
    assert.equal(r.headers.get('content-type'), 'image/png', img);
  }
});

test('every Cairn page sends the strict CSP and has no inline styles', async () => {
  for (const p of ['/', '/support', '/security', '/privacy', '/delete']) {
    const r = await getRaw(p, CAIRN);
    const body = await r.text();
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-security-policy') || '', /script-src 'none'/, p);
    assert.match(r.headers.get('content-security-policy') || '', /frame-ancestors 'none'/, p);
    assert.doesNotMatch(body, /style="/, `${p} has an inline style the CSP would block`);
  }
});

test('/support has the FAQ and a contact address', async () => {
  const { status, body } = await get('/support', CAIRN);
  assert.equal(status, 200);
  assert.match(body, /Frequently asked questions/);
  assert.match(body, /battery/i);
  assert.match(body, /24-word recovery phrase/);
  assert.match(body, /mailto:dev@cappylabs\.uk/);
  assert.match(body, /<link rel="canonical" href="https:\/\/cairn\.cappylabs\.uk\/support">/);
});

test('/security names the crypto and what the server can see', async () => {
  const { status, body } = await get('/security', CAIRN);
  assert.equal(status, 200);
  assert.match(body, /X25519/);
  assert.match(body, /ChaCha20-Poly1305/);
  assert.match(body, /What the server can and can't see/);
  assert.match(body, /IP address/);
});

test('security.txt follows RFC 9116', async () => {
  const r = await getRaw('/.well-known/security.txt', CAIRN);
  const body = await r.text();
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/plain/);
  assert.match(body, /^Contact: mailto:dev@cappylabs\.uk$/m);
  const expires = new Date(body.match(/^Expires: (.+)$/m)[1]);
  assert.ok(expires > new Date(), 'Expires is in the future');
  assert.ok(expires - Date.now() <= 366 * 24 * 3600 * 1000, 'and at most a year out');
  assert.match(body, /^Canonical: https?:\/\/cairn\.cappylabs\.uk\/\.well-known\/security\.txt$/m);
});

test('sitemap and robots on the Cairn host only', async () => {
  const sm = await get('/sitemap.xml', CAIRN);
  assert.equal(sm.status, 200);
  for (const p of ['/', '/support', '/security', '/privacy', '/delete']) {
    assert.match(sm.body, new RegExp(`<loc>https://cairn\\.cappylabs\\.uk${p.replace(/\//g, '\\/')}</loc>`));
  }
  assert.match((await get('/robots.txt', CAIRN)).body, /Sitemap: https:\/\/cairn\.cappylabs\.uk\/sitemap\.xml/);
  assert.equal((await get('/sitemap.xml', 'cappylabs.uk')).status, 404);
  assert.equal((await get('/robots.txt', 'cappylabs.uk')).status, 404);
});

test('the manifest is valid JSON with PNG icons', async () => {
  const r = await getRaw('/manifest.webmanifest', CAIRN);
  assert.equal(r.status, 200);
  const m = await r.json();
  assert.equal(m.name, 'Cairn');
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.type === 'image/png'));
});

test('unknown paths get a Cairn 404 on the Cairn host, the labs 404 elsewhere', async () => {
  const cairn = await get('/nope', CAIRN);
  assert.equal(cairn.status, 404);
  assert.match(cairn.body, /That page isn't here/);
  assert.match(cairn.body, /cairn\.css/);
  assert.doesNotMatch(cairn.body, /rel="canonical"/);
  const labs = await get('/nope', 'cappylabs.uk');
  assert.equal(labs.status, 404);
  assert.match(labs.body, /labs 404/);
});
test('answers from the owner: availability, cost, licence, relay location, audit', async () => {
  const landing = (await get('/', CAIRN)).body;
  assert.match(landing, /Coming soon to Android and iOS/);
  const support = (await get('/support', CAIRN)).body;
  assert.match(support, /Is Cairn free\?/);
  assert.match(support, /always free/);
  assert.match(support, /AGPL-3\.0/);
  const security = (await get('/security', CAIRN)).body;
  assert.match(security, /located in the UK/);
  assert.match(security, /hasn't been independently audited yet/);
  assert.match(security, /AGPL-3\.0/);
});