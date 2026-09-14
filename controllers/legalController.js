'use strict';

// Contact inbox shown on the Cairn data-deletion page. Must be a monitored
// mailbox — Google Play expects a working data-deletion request channel.
const CAIRN_PRIVACY_EMAIL = process.env.CAIRN_PRIVACY_EMAIL || 'dev@cappylabs.uk';

/**
 * GET /delete
 * Google Play "Data deletion URL" page for the Cairn app.
 * Names the app + developer, gives prominent deletion steps, and lists what
 * data is deleted/kept and for how long. Rendered standalone in the Cairn
 * brand (not the labs-web layout) via views/legal/cairn-layout.ejs.
 */
function cairnDelete(req, res) {
  res.render('legal/delete', {
    layout: 'legal/cairn-layout',
    title: 'Delete your Cairn data',
    description: 'How to delete the data associated with your Cairn account — by CappyLabs.',
    privacyEmail: CAIRN_PRIVACY_EMAIL,
  });
}

// Date shown as "Last updated" on the privacy policy. Bump when the policy text
// materially changes.
const CAIRN_PRIVACY_UPDATED = '14 September 2026';

/**
 * GET /privacy
 * Privacy policy for the Cairn app — used in Google Play's Data Safety
 * "Privacy policy" field. Rendered standalone in the Cairn brand.
 */
function cairnPrivacy(req, res) {
  res.render('legal/privacy', {
    layout: 'legal/cairn-layout',
    title: 'Cairn Privacy Policy',
    description: 'How Cairn handles your data — private, self-hosted, end-to-end encrypted, by CappyLabs.',
    privacyEmail: CAIRN_PRIVACY_EMAIL,
    lastUpdated: CAIRN_PRIVACY_UPDATED,
  });
}

module.exports = { cairnDelete, cairnPrivacy };
