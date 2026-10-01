'use strict';

const { Router } = require('express');
const cairn = require('../services/cairnService');
const legalController = require('../controllers/legalController');

const router = Router();

// Cairn legal pages (served at cairn.cappylabs.uk/…).
router.get('/delete', cairn.headers, legalController.cairnDelete);
router.get('/privacy', cairn.headers, legalController.cairnPrivacy);

module.exports = router;
