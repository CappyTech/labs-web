'use strict';

const moduleService = require('../services/moduleService');
const cairn = require('../services/cairnService');

/**
 * GET /
 * Host-aware landing: the Cairn domain gets the Cairn-branded landing page;
 * every other host (cappylabs.uk) gets the labs-web station homepage.
 */
function index(req, res) {
  const host = (req.hostname || '').toLowerCase();

  if (host.startsWith('cairn.')) {
    return res.render('cairn/index', {
      layout: 'legal/cairn-layout',
      title: 'Cairn — private location sharing',
      description: 'Private, self-hosted, end-to-end encrypted location sharing. Your location, for the few you trust. By CappyLabs.',
      canonical: `${cairn.DOMAIN}/`,
      privacyEmail: cairn.EMAIL,
      tagline: cairn.TAGLINE,
    });
  }

  res.render('index', {
    title: 'Cappy Labs',
    description: 'Cappy Labs — a home for small experiments and self-hosted projects.',
    modules: moduleService.getModules(),
  });
}

module.exports = { index };
