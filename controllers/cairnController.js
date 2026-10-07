'use strict';

const cairn = require('../services/cairnService');
const betaService = require('../services/betaService');

/** Locals every Cairn-branded page needs. */
const page = (path, extra) => ({
  layout: 'legal/cairn-layout',
  canonical: `${cairn.DOMAIN}${path}`,
  privacyEmail: cairn.EMAIL,
  repo: cairn.REPO,
  ...extra,
});

/**
 * GET /support
 * Support page with an FAQ and contact address (the App Store "Support URL").
 */
function support(req, res) {
  res.render('cairn/support', page('/support', {
    title: 'Cairn support',
    description: 'Answers to common questions about Cairn, and how to get in touch.',
  }));
}

/**
 * GET /security
 * How Cairn's encryption works, and what the relay server can and can't see.
 */
function security(req, res) {
  res.render('cairn/security', page('/security', {
    title: 'Cairn security',
    description: 'How Cairn encrypts your location, and exactly what the server can and cannot see.',
  }));
}

/** Locals for the beta pages: which platforms have a build right now. */
const betaPage = (path, extra) => page(path, {
  title: 'Test Cairn before it launches',
  description: 'Sign up to try Cairn early on Android, or join the iPhone waitlist.',
  androidOpen: betaService.isOpen('android'),
  iosOpen: betaService.isOpen('ios'),
  form: {},
  error: null,
  ...extra,
});

/**
 * GET /beta
 * Sign-up form for the Play closed testing track (and the iOS waitlist).
 */
function beta(req, res) {
  res.render('cairn/beta', betaPage('/beta'));
}

/**
 * POST /beta
 * Record the sign-up, then show the next steps (also emailed). Bots that
 * fill the hidden "website" field get the thank-you page and nothing else.
 */
async function betaSignUp(req, res, next) {
  const body = req.body || {};
  const form = {
    email: typeof body.email === 'string' ? body.email.slice(0, 254) : '',
    platform: body.platform,
  };
  const retry = (status, error) =>
    res.status(status).render('cairn/beta', betaPage('/beta', { form, error }));

  if (body.website) return res.render('cairn/beta-thanks', betaPage('/beta', { tester: null, cfg: betaService.config() }));
  if (!betaService.allow(req.ip)) return retry(429, 'Too many sign-ups from here. Try again in a few minutes.');

  const email = betaService.normaliseEmail(form.email);
  if (!email) return retry(400, 'Enter a valid email address.');
  if (!betaService.PLATFORMS.includes(form.platform)) return retry(400, 'Choose Android or iPhone.');
  if (body.consent !== 'yes') return retry(400, 'Tick the box to agree to how we use your email.');

  try {
    const { tester } = await betaService.signUp({ email, platform: form.platform });
    res.render('cairn/beta-thanks', betaPage('/beta', {
      title: 'Thanks for signing up · Cairn',
      tester,
      cfg: betaService.config(),
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /beta/leave?t=…
 * Confirm leaving the beta. Deletion happens on POST, so link scanners that
 * open the email link can't remove someone by accident.
 */
async function betaLeave(req, res, next) {
  try {
    const tester = await betaService.findByToken(req.query.t);
    res.status(tester ? 200 : 404).render('cairn/beta-leave', betaPage('/beta/leave', {
      title: 'Leave the Cairn beta',
      token: tester ? tester.token : null,
      done: false,
      cfg: betaService.config(),
    }));
  } catch (err) {
    next(err);
  }
}

/** POST /beta/leave — delete the sign-up for good. */
async function betaLeaveConfirm(req, res, next) {
  try {
    await betaService.leave((req.body || {}).t);
    res.render('cairn/beta-leave', betaPage('/beta/leave', {
      title: 'You’ve left the Cairn beta',
      token: null,
      done: true,
      cfg: betaService.config(),
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /.well-known/security.txt (RFC 9116)
 * Where to report vulnerabilities. Expires a year after the server starts, so
 * a running deploy never serves a stale file for long.
 */
const SECURITY_TXT_EXPIRES = new Date(Date.now() + 365 * 24 * 3600 * 1000);
function securityTxt(req, res) {
  const origin = `${req.protocol}://${req.hostname}`;
  res.type('text/plain').send([
    `Contact: mailto:${cairn.EMAIL}`,
    `Expires: ${SECURITY_TXT_EXPIRES.toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${origin}/.well-known/security.txt`,
    `Policy: ${cairn.DOMAIN}/security`,
    '',
  ].join('\n'));
}

/** GET /sitemap.xml — the Cairn site only; other hosts fall through to 404. */
function sitemap(req, res, next) {
  if (!cairn.isCairnHost(req)) return next();
  const urls = cairn.PAGES
    .map((p) => `  <url><loc>${cairn.DOMAIN}${p}</loc></url>`)
    .join('\n');
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + `${urls}\n</urlset>\n`,
  );
}

/** GET /robots.txt — Cairn host: allow all and point at the sitemap. */
function robots(req, res, next) {
  if (!cairn.isCairnHost(req)) return next();
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${cairn.DOMAIN}/sitemap.xml\n`);
}

/** GET /manifest.webmanifest — installable-site metadata for the Cairn pages. */
function manifest(req, res) {
  res.type('application/manifest+json').send(JSON.stringify({
    name: 'Cairn',
    short_name: 'Cairn',
    description: 'Private, end-to-end encrypted location sharing, by CappyLabs.',
    lang: 'en-GB',
    start_url: '/',
    display: 'browser',
    background_color: '#EDF0EE',
    theme_color: '#1F2A2E',
    icons: [
      { src: '/resources/images/cairn-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/resources/images/cairn-icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/resources/images/cairn-app-icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }, null, 2));
}

/** Cairn-branded 404 for the Cairn host; other hosts fall through. */
function notFound(req, res, next) {
  if (!cairn.isCairnHost(req)) return next();
  cairn.headers(req, res, () => {
    res.status(404).render('cairn/404', page(req.path, {
      title: 'Page not found · Cairn',
      description: 'That page doesn’t exist.',
      canonical: null, // no canonical for a page that doesn't exist
    }));
  });
}

module.exports = {
  support, security, beta, betaSignUp, betaLeave, betaLeaveConfirm,
  securityTxt, sitemap, robots, manifest, notFound,
};
