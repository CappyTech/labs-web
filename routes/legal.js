'use strict';

const { Router } = require('express');
const legalController = require('../controllers/legalController');

const router = Router();

// Cairn legal pages (served at cairn.cappylabs.uk/…).
router.get('/delete', legalController.cairnDelete);
router.get('/privacy', legalController.cairnPrivacy);

module.exports = router;
