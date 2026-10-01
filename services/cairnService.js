'use strict';

// Shared facts for the Cairn pages (homepage module, landing, legal pages).
// Kept in one place so the domain, contact inbox and policy date don't drift
// across views/controllers.

/** Canonical public origin for Cairn (used for <link rel="canonical"> + og:url). */
const DOMAIN = process.env.CAIRN_DOMAIN || 'https://cairn.cappylabs.uk';

/** Contact inbox shown on the legal pages. Must be a monitored mailbox —
 *  Google Play expects a working data-deletion request channel. */
const EMAIL = process.env.CAIRN_PRIVACY_EMAIL || 'dev@cappylabs.uk';

/** "Last updated" date shown on the privacy policy. Bump on material changes. */
const PRIVACY_UPDATED = process.env.CAIRN_PRIVACY_UPDATED || '1 October 2026';

/** The data controller named in the privacy policy, e.g. "Jane Smith, trading
 *  as CappyLabs". The line is left out while this is unset. */
const CONTROLLER = (process.env.CAIRN_CONTROLLER || '').trim();

/** One-line brand tagline (per docs/cairn-brand-guidelines.html). */
const TAGLINE = 'Your location, for the few you trust.';

/** Public source repository (self-hosting docs live in its README). */
const REPO = 'https://github.com/CappyTech/cairn';

/** Pages listed in /sitemap.xml (paths under DOMAIN). */
const PAGES = ['/', '/support', '/security', '/privacy', '/delete'];

/** Is this request for the Cairn site (cairn.cappylabs.uk)? */
const isCairnHost = (req) => (req.hostname || '').toLowerCase().startsWith('cairn.');

// The Cairn pages are static documents: no scripts, frames or forms. Only the
// brand font comes from elsewhere (Google Fonts) until it's self-hosted.
const CSP = [
  "default-src 'self'",
  "script-src 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self'",
  "manifest-src 'self'",
  "connect-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

/** Express middleware: the stricter headers for Cairn-branded pages. */
function headers(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

module.exports = {
  DOMAIN, EMAIL, PRIVACY_UPDATED, CONTROLLER, TAGLINE, REPO, PAGES, CSP,
  isCairnHost, headers,
};
