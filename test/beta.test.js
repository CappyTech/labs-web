'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');

process.env.CAIRN_BETA_ANDROID_GROUP_URL = 'https://groups.google.com/g/cairn-testers';
process.env.CAIRN_BETA_ANDROID_OPTIN_URL = 'https://play.google.com/apps/internaltest/123';
delete process.env.CAIRN_BETA_IOS_URL;
delete process.env.SMTP_URL;

const beta = require('../services/betaService');

const realAllow = beta.allow; // the HTTP tests below stub it

// ── Pure logic ────────────────────────────────────────────────────────

test('normaliseEmail lower-cases, trims and rejects junk', () => {
  assert.equal(beta.normaliseEmail('  Jo@Example.COM '), 'jo@example.com');
  for (const bad of ['', 'jo', 'jo@', 'jo@example', 'a b@c.d', null, 42, `${'a'.repeat(250)}@x.io`]) {
    assert.equal(beta.normaliseEmail(bad), null, String(bad));
  }
});

test('decideStatus invites under the cap, waitlists over it or when closed', () => {
  const cfg = { ...beta.config(), cap: 2 };
  assert.equal(beta.decideStatus('android', 0, cfg), 'invited');
  assert.equal(beta.decideStatus('android', 1, cfg), 'invited');
  assert.equal(beta.decideStatus('android', 2, cfg), 'waitlist');
  assert.equal(beta.decideStatus('ios', 0, cfg), 'waitlist'); // no TestFlight link yet
  assert.equal(beta.decideStatus('ios', 0, { ...cfg, iosUrl: 'https://testflight.apple.com/join/x' }), 'invited');
  assert.equal(beta.decideStatus('android', 0, { ...cfg, androidOptInUrl: '' }), 'waitlist');
});

test('the cap defaults to 100', () => {
  assert.equal(beta.config().cap, 100);
});

test('allow rate-limits per key', () => {
  const now = 1e12;
  for (let i = 0; i < 5; i += 1) assert.ok(realAllow('rl-test', now + i));
  assert.equal(realAllow('rl-test', now + 5), false);
  assert.ok(realAllow('rl-test', now + 11 * 60 * 1000), 'window expires');
});

test('welcome email has the join + opt-in steps and a leave link', () => {
  const tester = { email: 'jo@example.com', platform: 'android', status: 'invited', token: 'ab'.repeat(24) };
  const m = beta.welcomeEmail(tester);
  assert.equal(m.to, 'jo@example.com');
  assert.match(m.subject, /invite/);
  assert.match(m.text, /groups\.google\.com\/g\/cairn-testers/);
  assert.match(m.text, /internaltest\/123/);
  assert.match(m.text, new RegExp(`/beta/leave\\?t=${tester.token}`));
});

test('waitlist emails say why', () => {
  const ios = beta.welcomeEmail({ email: 'a@b.co', platform: 'ios', status: 'waitlist', token: 'x' });
  assert.match(ios.subject, /waitlist/);
  assert.match(ios.text, /no iPhone test build yet/);
  const full = beta.welcomeEmail({ email: 'a@b.co', platform: 'android', status: 'waitlist', token: 'x' });
  assert.match(full.text, /group is full/);
});

// ── HTTP flow (service stubbed: no MongoDB) ───────────────────────────

const ROOT = path.join(__dirname, '..');
const CAIRN = 'cairn.cappylabs.uk';
let server;
let base;
let calls;

before(async () => {
  // Stub the data layer before the controller is loaded.
  beta.signUp = async ({ email, platform }) => {
    calls.push(['signUp', email, platform]);
    return { tester: { email, platform, status: platform === 'ios' ? 'waitlist' : 'invited' }, created: true };
  };
  beta.findByToken = async (t) => (t === 'ab'.repeat(24) ? { token: t } : null);
  beta.leave = async (t) => { calls.push(['leave', t]); return true; };
  beta.allow = () => true;

  const app = express();
  app.set('trust proxy', true);
  app.use((req, res, next) => { res.locals.appVersion = 'test'; next(); });
  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.use(express.urlencoded({ extended: false }));
  app.use('/', require('../routes/cairn'));
  await new Promise((resolve) => {
    server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
  });
});

after(() => server && server.close());
beforeEach(() => { calls = []; });

const headers = { 'x-forwarded-host': CAIRN };
const post = (p, form) => fetch(base + p, {
  method: 'POST',
  headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(form).toString(),
}).then(async (r) => ({ status: r.status, csp: r.headers.get('content-security-policy'), body: await r.text() }));

test('GET /beta renders the form with a CSP that allows posting to self only', async () => {
  const r = await fetch(`${base}/beta`, { headers });
  const body = await r.text();
  assert.equal(r.status, 200);
  assert.match(body, /<form[^>]+method="post" action="\/beta"/);
  assert.match(body, /name="consent"/);
  assert.match(body, /iPhone \(waitlist\)/);
  assert.doesNotMatch(body, /style="/);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /script-src 'none'/);
});

test('a valid Android sign-up shows the join and opt-in steps', async () => {
  const r = await post('/beta', { email: ' Jo@Example.com', platform: 'android', consent: 'yes' });
  assert.equal(r.status, 200);
  assert.deepEqual(calls, [['signUp', 'jo@example.com', 'android']]);
  assert.match(r.body, /Join the Cairn testers group/);
  assert.match(r.body, /href="https:\/\/play\.google\.com\/apps\/internaltest\/123"/);
});

test('an iPhone sign-up lands on the waitlist page', async () => {
  const r = await post('/beta', { email: 'jo@example.com', platform: 'ios', consent: 'yes' });
  assert.equal(r.status, 200);
  assert.match(r.body, /on the waitlist/);
  assert.match(r.body, /no iPhone test build yet/);
});

test('invalid sign-ups re-show the form with an error and store nothing', async () => {
  const cases = [
    [{ email: 'nope', platform: 'android', consent: 'yes' }, /valid email/],
    [{ email: 'jo@example.com', platform: 'windows', consent: 'yes' }, /Android or iPhone/],
    [{ email: 'jo@example.com', platform: 'android' }, /Tick the box/],
  ];
  for (const [form, msg] of cases) {
    const r = await post('/beta', form);
    assert.equal(r.status, 400);
    assert.match(r.body, msg);
  }
  assert.deepEqual(calls, []);
});

test('submitted values are escaped when the form is re-shown', async () => {
  const r = await post('/beta', { email: '"><script>x</script>', platform: 'android', consent: 'yes' });
  assert.equal(r.status, 400);
  assert.doesNotMatch(r.body, /<script>x/);
});

test('the honeypot swallows bot sign-ups', async () => {
  const r = await post('/beta', { email: 'bot@example.com', platform: 'android', consent: 'yes', website: 'spam' });
  assert.equal(r.status, 200);
  assert.match(r.body, /Check your email/);
  assert.deepEqual(calls, []);
});

test('leaving: GET confirms, POST deletes, unknown tokens 404', async () => {
  const token = 'ab'.repeat(24);
  const confirm = await fetch(`${base}/beta/leave?t=${token}`, { headers });
  assert.equal(confirm.status, 200);
  assert.match(await confirm.text(), new RegExp(`name="t" value="${token}"`));
  assert.deepEqual(calls, [], 'GET must not delete');

  const done = await post('/beta/leave', { t: token });
  assert.equal(done.status, 200);
  assert.match(done.body, /deleted your email address/);
  assert.deepEqual(calls, [['leave', token]]);

  assert.equal((await fetch(`${base}/beta/leave?t=bogus`, { headers })).status, 404);
});
