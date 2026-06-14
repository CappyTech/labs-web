'use strict';

const { Router } = require('express');
const milkmanController = require('../controllers/milkmanController');

const router = Router();

router.get('/', milkmanController.index);

module.exports = router;
