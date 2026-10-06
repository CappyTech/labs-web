'use strict';

const { Router } = require('express');
const cairn = require('../services/cairnService');
const cairnController = require('../controllers/cairnController');

const router = Router();

// Cairn site pages (served at cairn.cappylabs.uk/…).
router.get('/support', cairn.headers, cairnController.support);
router.get('/security', cairn.headers, cairnController.security);

// Beta sign-up for the Play internal track (and iOS waitlist).
router.get('/beta', cairn.formHeaders, cairnController.beta);
router.post('/beta', cairn.formHeaders, cairnController.betaSignUp);
router.get('/beta/leave', cairn.formHeaders, cairnController.betaLeave);
router.post('/beta/leave', cairn.formHeaders, cairnController.betaLeaveConfirm);

// Site files.
router.get('/.well-known/security.txt', cairnController.securityTxt);
router.get('/sitemap.xml', cairnController.sitemap);
router.get('/robots.txt', cairnController.robots);
router.get('/manifest.webmanifest', cairnController.manifest);

module.exports = router;
