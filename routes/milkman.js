'use strict';

const { Router } = require('express');
const milkmanController        = require('../controllers/milkmanController');
const milkmanInvoiceController = require('../controllers/milkmanInvoiceController');

const router = Router();

router.get('/', milkmanController.index);

router.get('/invoices/:id',          milkmanInvoiceController.show);
router.post('/invoices/:id/split',   milkmanInvoiceController.split);
router.post('/invoices/:id/settle',  milkmanInvoiceController.settle);

module.exports = router;
