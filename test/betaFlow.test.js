'use strict';

// The sign-up / cap / waitlist / leave flow in betaService, run against an
// in-memory stand-in for the BetaTester model and a mail spy (no MongoDB).

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let rows;
let seq;
const matches = (row, q) => Object.entries(q).every(([k, v]) => row[k] === v);
const doc = (row) => Object.assign(row, { save: async () => row });

const FakeBetaTester = {
  findOne: async (q) => rows.find((r) => matches(r, q)) || null,
  countDocuments: async (q) => rows.filter((r) => matches(r, q)).length,
  create: async (data) => {
    if (rows.some((r) => r.email === data.email)) throw Object.assign(new Error('dup'), { code: 11000 });
    const row = doc({ ...data, createdAt: seq += 1 });
    rows.push(row);
    return row;
  },
  find: (q) => ({
    sort: () => ({
      limit: async (n) => rows.filter((r) => matches(r, q)).sort((a, b) => a.createdAt - b.createdAt).slice(0, n),
    }),
  }),
  deleteOne: async (q) => {
    const before = rows.length;
    rows = rows.filter((r) => !matches(r, q));
    return { deletedCount: before - rows.length };
  },
};

const sent = [];
const stub = (rel, exports) => {
  const id = require.resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
stub('../models/BetaTester', FakeBetaTester);
stub('../services/mailService', { send: async (m) => { sent.push(m); return true; }, isConfigured: () => true });

process.env.CAIRN_BETA_ANDROID_GROUP_URL = 'https://groups.google.com/g/cairn-testers';
process.env.CAIRN_BETA_ANDROID_OPTIN_URL = 'https://play.google.com/apps/internaltest/123';
process.env.CAIRN_BETA_CAP = '2';
process.env.CAIRN_BETA_NOTIFY = 'owner@example.com';
delete process.env.CAIRN_BETA_IOS_URL;

const beta = require('../services/betaService');
const tick = () => new Promise((r) => setImmediate(r));

beforeEach(() => { rows = []; seq = 0; sent.length = 0; delete process.env.CAIRN_BETA_IOS_URL; });

test('sign-ups are invited up to the cap, then waitlisted; each mails tester + owner', async () => {
  const a = await beta.signUp({ email: 'a@x.io', platform: 'android' });
  const b = await beta.signUp({ email: 'b@x.io', platform: 'android' });
  const c = await beta.signUp({ email: 'c@x.io', platform: 'android' });
  assert.deepEqual([a, b, c].map((r) => r.tester.status), ['invited', 'invited', 'waitlist']);
  assert.ok(a.tester.token.match(/^[0-9a-f]{48}$/));
  assert.deepEqual(sent.map((m) => m.to), ['a@x.io', 'owner@example.com', 'b@x.io', 'owner@example.com', 'c@x.io', 'owner@example.com']);
  assert.match(sent[5].subject, /c@x\.io \(android, waitlist\)/);
  assert.match(sent[5].text, /Invited: 2\/2 Android/);
});

test('a repeat sign-up returns the existing record and sends nothing', async () => {
  await beta.signUp({ email: 'a@x.io', platform: 'android' });
  sent.length = 0;
  const again = await beta.signUp({ email: 'a@x.io', platform: 'ios' });
  assert.equal(again.created, false);
  assert.equal(again.tester.platform, 'android');
  assert.equal(sent.length, 0);
});

test('leaving deletes the record and invites the next person on the waitlist', async () => {
  const a = await beta.signUp({ email: 'a@x.io', platform: 'android' });
  await beta.signUp({ email: 'b@x.io', platform: 'android' });
  await beta.signUp({ email: 'c@x.io', platform: 'android' });
  sent.length = 0;

  assert.equal(await beta.leave(a.tester.token), true);
  await tick(); await tick(); await tick();
  assert.equal(rows.find((r) => r.email === 'a@x.io'), undefined);
  assert.equal(rows.find((r) => r.email === 'c@x.io').status, 'invited');
  assert.equal(sent[0].to, 'c@x.io');
  assert.match(sent[0].subject, /invite/);
  assert.match(sent[1].subject, /invited 1 from the waitlist/);

  assert.equal(await beta.leave(a.tester.token), false, 'token is single-use');
  assert.equal(await beta.leave('not-a-token'), false);
});

test('iPhone sign-ups wait until a TestFlight link is set, then get invited', async () => {
  const r = await beta.signUp({ email: 'i@x.io', platform: 'ios' });
  assert.equal(r.tester.status, 'waitlist');
  assert.equal(await beta.promoteWaitlist(), 0);

  process.env.CAIRN_BETA_IOS_URL = 'https://testflight.apple.com/join/abc';
  sent.length = 0;
  assert.equal(await beta.promoteWaitlist(), 1);
  assert.equal(rows[0].status, 'invited');
  assert.match(sent[0].text, /testflight\.apple\.com\/join\/abc/);
});
