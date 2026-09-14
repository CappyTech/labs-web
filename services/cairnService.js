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
const PRIVACY_UPDATED = process.env.CAIRN_PRIVACY_UPDATED || '14 September 2026';

/** One-line brand tagline (per docs/cairn-brand-guidelines.html). */
const TAGLINE = 'Your location, for the few you trust.';

module.exports = { DOMAIN, EMAIL, PRIVACY_UPDATED, TAGLINE };
