'use strict';

const { Router } = require('express');
const cairn = require('../services/cairnService');
const cairnController = require('../controllers/cairnController');

const router = Router();

// Cairn site pages (served at cairn.cappylabs.uk/…).
router.get('/support', cairn.headers, cairnController.support);
router.get('/security', cairn.headers, cairnController.security);

// Site files.
router.get('/.well-known/security.txt', cairnController.securityTxt);
router.get('/sitemap.xml', cairnController.sitemap);
router.get('/robots.txt', cairnController.robots);
router.get('/manifest.webmanifest', cairnController.manifest);

module.exports = router;
