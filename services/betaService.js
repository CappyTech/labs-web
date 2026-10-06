'use strict';

// Cairn beta (internal testing) sign-ups.
//
// Google Play only accepts Google Groups as API-managed tester lists, so the
// Play internal track lists one public Google Group and testers join it
// themselves. This service sits in front of that: it records who signed up,
// enforces a cap (Play's internal track takes at most 100 testers), emails
// the join + opt-in steps, tells the developer, and lets people leave.

const crypto = require('crypto');
const BetaTester = require('../models/BetaTester');
const mail = require('./mailService');
const cairn = require('./cairnService');

const PLATFORMS = ['android', 'ios'];

/** Settings from the environment, read per call so tests can change them. */
function config() {
  const cap = Number.parseInt(process.env.CAIRN_BETA_CAP, 10);
  return {
    // Google Group that the Play internal track lists as its testers.
    androidGroupUrl: process.env.CAIRN_BETA_ANDROID_GROUP_URL || '',
    // Play Console → Internal testing → Testers → "Join on the web" link.
    androidOptInUrl: process.env.CAIRN_BETA_ANDROID_OPTIN_URL || '',
    // TestFlight public link. Unset until iOS builds exist: iOS is waitlist-only.
    iosUrl: process.env.CAIRN_BETA_IOS_URL || '',
    cap: Number.isFinite(cap) && cap > 0 ? cap : 100,
    notify: process.env.CAIRN_BETA_NOTIFY || cairn.EMAIL,
  };
}

/** Does this platform have a build people can install right now? */
function isOpen(platform, cfg = config()) {
  if (platform === 'android') return Boolean(cfg.androidGroupUrl && cfg.androidOptInUrl);
  if (platform === 'ios') return Boolean(cfg.iosUrl);
  return false;
}

/** Lower-cased, trimmed email, or null if it doesn't look like one. */
function normaliseEmail(input) {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** invited if the platform is open and under the cap, otherwise waitlist. */
function decideStatus(platform, invitedCount, cfg = config()) {
  return isOpen(platform, cfg) && invitedCount < cfg.cap ? 'invited' : 'waitlist';
}

// ── Rate limit ───────────────────────────────────────────────────────
// In-memory, per IP: plenty for a single container and a public form.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

/** Record a sign-up attempt from `key`; false once it's over the limit. */
function allow(key, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10000) hits.clear(); // crude bound on memory
  return recent.length <= MAX_PER_WINDOW;
}

// ── Emails ───────────────────────────────────────────────────────────
const leaveUrl = (tester) => `${cairn.DOMAIN}/beta/leave?t=${tester.token}`;

function welcomeEmail(tester, cfg = config()) {
  const lines = ['Hi,', '', 'Thanks for signing up to test Cairn.', ''];
  if (tester.status === 'invited' && tester.platform === 'android') {
    lines.push(
      'To get the test build on your Android phone:',
      '',
      `1. Join the testers group (use the Google account your phone uses):`,
      `   ${cfg.androidGroupUrl}`,
      `2. Accept the invite to test:`,
      `   ${cfg.androidOptInUrl}`,
      '3. Install Cairn from the Play Store link on that page.',
      '   Updates then arrive through Google Play like any other app.',
      '',
      'If step 2 says the app is not available, wait a few minutes after',
      'joining the group and try again.',
    );
  } else if (tester.status === 'invited' && tester.platform === 'ios') {
    lines.push(
      'To get the test build on your iPhone, install TestFlight from the',
      'App Store, then open this link on your phone:',
      '',
      `   ${cfg.iosUrl}`,
    );
  } else {
    lines.push(
      isOpen(tester.platform, cfg)
        ? "The test group is full right now. You're on the waitlist, and we'll"
        : `There's no ${tester.platform === 'ios' ? 'iPhone' : 'Android'} test build yet. You're on the waitlist, and we'll`,
      'email you when a place opens.',
    );
  }
  lines.push(
    '',
    `Found a bug or have feedback? Reply to this email, or write to ${cairn.EMAIL}.`,
    '',
    'We only use your email address for the beta. To leave and have it deleted:',
    leaveUrl(tester),
    '',
    'Cairn, by CappyLabs',
  );
  return {
    to: tester.email,
    replyTo: cairn.EMAIL,
    subject: tester.status === 'invited' ? 'Your Cairn beta invite' : "You're on the Cairn beta waitlist",
    text: lines.join('\n'),
  };
}

function notifyEmail(tester, counts, cfg = config()) {
  return {
    to: cfg.notify,
    subject: `Cairn beta: ${tester.email} (${tester.platform}, ${tester.status})`,
    text: [
      `New Cairn beta sign-up: ${tester.email}`,
      `Platform: ${tester.platform}`,
      `Status: ${tester.status}`,
      '',
      `Invited: ${counts.invited}/${cfg.cap} Android, ${counts.iosInvited} iOS. Waitlist: ${counts.waitlist}.`,
    ].join('\n'),
  };
}

async function counts() {
  const [invited, iosInvited, waitlist] = await Promise.all([
    BetaTester.countDocuments({ platform: 'android', status: 'invited' }),
    BetaTester.countDocuments({ platform: 'ios', status: 'invited' }),
    BetaTester.countDocuments({ status: 'waitlist' }),
  ]);
  return { invited, iosInvited, waitlist };
}

// ── Flow ─────────────────────────────────────────────────────────────

/**
 * Sign someone up. Returns { tester, created }. A repeat sign-up returns the
 * existing record and sends nothing, so the form can't be used to spam an
 * address that's already on the list.
 */
async function signUp({ email, platform }) {
  const cfg = config();
  const existing = await BetaTester.findOne({ email });
  if (existing) return { tester: existing, created: false };

  const invitedCount = await BetaTester.countDocuments({ platform, status: 'invited' });
  let tester;
  try {
    tester = await BetaTester.create({
      email,
      platform,
      status: decideStatus(platform, invitedCount, cfg),
      token: crypto.randomBytes(24).toString('hex'),
    });
  } catch (err) {
    if (err.code !== 11000) throw err; // lost a race with the same email
    return { tester: await BetaTester.findOne({ email }), created: false };
  }

  // Emails are best-effort: the thank-you page shows the same steps.
  try {
    await mail.send(welcomeEmail(tester, cfg));
    await mail.send(notifyEmail(tester, await counts(), cfg));
  } catch (err) {
    console.error('[beta] email failed:', err.message);
  }
  return { tester, created: true };
}

/**
 * Invite people off the waitlist, oldest first, while their platform is open
 * and under the cap. Runs at startup (so setting CAIRN_BETA_IOS_URL and
 * redeploying invites the iOS waitlist) and whenever someone leaves.
 * Resolves to the number of people invited.
 */
async function promoteWaitlist() {
  const cfg = config();
  let promoted = 0;
  for (const platform of PLATFORMS) {
    if (!isOpen(platform, cfg)) continue;
    const invited = await BetaTester.countDocuments({ platform, status: 'invited' });
    const room = cfg.cap - invited;
    if (room <= 0) continue;
    const next = await BetaTester.find({ platform, status: 'waitlist' })
      .sort({ createdAt: 1 }).limit(room);
    for (const tester of next) {
      tester.status = 'invited';
      await tester.save();
      promoted += 1;
      try {
        await mail.send(welcomeEmail(tester, cfg));
      } catch (err) {
        console.error('[beta] invite email failed:', err.message);
      }
    }
  }
  if (promoted) {
    try {
      await mail.send({
        to: cfg.notify,
        subject: `Cairn beta: invited ${promoted} from the waitlist`,
        text: `Invited ${promoted} people from the Cairn beta waitlist.`,
      });
    } catch (err) {
      console.error('[beta] notify email failed:', err.message);
    }
  }
  return promoted;
}

/** Find a sign-up by its leave token (null if unknown or malformed). */
async function findByToken(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) return null;
  return BetaTester.findOne({ token });
}

/** Delete a sign-up by its leave token. Resolves true if one was removed. */
async function leave(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) return false;
  const { deletedCount } = await BetaTester.deleteOne({ token });
  if (deletedCount > 0) promoteWaitlist().catch((err) => console.error('[beta] promote failed:', err.message));
  return deletedCount > 0;
}

module.exports = {
  PLATFORMS, config, isOpen, normaliseEmail, decideStatus, allow,
  welcomeEmail, notifyEmail, signUp, promoteWaitlist, findByToken, leave,
};
