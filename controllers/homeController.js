'use strict';

const moduleService = require('../services/moduleService');
const cairn = require('../services/cairnService');

/**
 * GET /
 * Host-aware landing: the Cairn domain gets the Cairn-branded landing page;
 * every other host (cappylabs.uk) gets the labs-web station homepage.
 */
function index(req, res) {
  if (cairn.isCairnHost(req)) {
    const description = 'Private, self-hosted, end-to-end encrypted location sharing. Your location, for the few you trust. By CappyLabs.';
    return cairn.headers(req, res, () => res.render('cairn/index', {
      layout: 'legal/cairn-layout',
      title: 'Cairn — private location sharing',
      description,
      canonical: `${cairn.DOMAIN}/`,
      privacyEmail: cairn.EMAIL,
      tagline: cairn.TAGLINE,
      repo: cairn.REPO,
      // schema.org data for search engines (rendered as JSON-LD, not run).
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Cairn',
        description,
        url: `${cairn.DOMAIN}/`,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Android',
        publisher: { '@type': 'Organization', name: 'CappyLabs', url: 'https://cappylabs.uk' },
      },
    }));
  }

  res.render('index', {
    title: 'Cappy Labs',
    description: 'Cappy Labs — a home for small experiments and self-hosted projects.',
    modules: moduleService.getModules(),
  });
}

module.exports = { index };
