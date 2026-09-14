'use strict';

const cairn = require('../services/cairnService');

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
    canonical: `${cairn.DOMAIN}/delete`,
    privacyEmail: cairn.EMAIL,
  });
}

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
    canonical: `${cairn.DOMAIN}/privacy`,
    privacyEmail: cairn.EMAIL,
    lastUpdated: cairn.PRIVACY_UPDATED,
  });
}

module.exports = { cairnDelete, cairnPrivacy };
