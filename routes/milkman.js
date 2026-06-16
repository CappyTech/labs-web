'use strict';

const { Router } = require('express');

const milkmanController            = require('../controllers/milkmanController');
const milkmanCalendarController    = require('../controllers/milkmanCalendarController');
const milkmanInvoiceController     = require('../controllers/milkmanInvoiceController');
const milkmanInvoicesController    = require('../controllers/milkmanInvoicesController');
const milkmanMembersController     = require('../controllers/milkmanMembersController');
const milkmanProductsController    = require('../controllers/milkmanProductsController');
const milkmanRulesController       = require('../controllers/milkmanRulesController');
const milkmanSettlementsController = require('../controllers/milkmanSettlementsController');

const router = Router();

// ── Landing ────────────────────────────────────────────────────────────────
router.get('/',          milkmanController.index);
router.get('/calendar',  milkmanCalendarController.calendar);

// ── Invoices ───────────────────────────────────────────────────────────────
// Static paths (/new, /parse, /confirm) must come before /:id.
router.get('/invoices',              milkmanInvoicesController.list);
router.get('/invoices/new',          milkmanInvoicesController.newForm);
router.post('/invoices',             milkmanInvoicesController.create);
router.get('/invoices/parse',        milkmanInvoicesController.parseForm);
router.post('/invoices/parse',       milkmanInvoicesController.parsePreview);
router.post('/invoices/confirm',     milkmanInvoicesController.confirmParse);

// Single invoice detail + status actions.
router.get('/invoices/:id',          milkmanInvoiceController.show);
router.post('/invoices/:id/split',   milkmanInvoiceController.split);
router.post('/invoices/:id/settle',  milkmanInvoiceController.settle);

// Delivery day mutations (pending invoices only).
router.post('/invoices/:id/delivery-days',                                      milkmanInvoicesController.addDay);
router.post('/invoices/:id/delivery-days/:dayIndex/delete',                     milkmanInvoicesController.removeDay);
router.post('/invoices/:id/delivery-days/:dayIndex/line-items',                 milkmanInvoicesController.addLineItem);
router.post('/invoices/:id/delivery-days/:dayIndex/line-items/:itemIndex/delete', milkmanInvoicesController.removeLineItem);
router.post('/invoices/:id/delivery-days/:dayIndex/communal-events',            milkmanInvoicesController.addCommunalEvent);
router.post('/invoices/:id/delivery-days/:dayIndex/communal-events/:eventIndex/delete', milkmanInvoicesController.removeCommunalEvent);

// Adjustment mutations.
router.post('/invoices/:id/adjustments',                      milkmanInvoicesController.addAdjustment);
router.post('/invoices/:id/adjustments/:adjIndex/delete',     milkmanInvoicesController.removeAdjustment);

// Charge mutations.
router.post('/invoices/:id/charges',                          milkmanInvoicesController.addCharge);
router.post('/invoices/:id/charges/:chargeIndex/delete',      milkmanInvoicesController.removeCharge);

// ── Members ────────────────────────────────────────────────────────────────
router.get('/members',             milkmanMembersController.list);
router.post('/members',            milkmanMembersController.create);
router.get('/members/:id/edit',    milkmanMembersController.editForm);
router.post('/members/:id',        milkmanMembersController.update);

// ── Products ───────────────────────────────────────────────────────────────
router.get('/products',            milkmanProductsController.list);
router.post('/products',           milkmanProductsController.create);
router.get('/products/:id/edit',   milkmanProductsController.editForm);
router.post('/products/:id',       milkmanProductsController.update);

// ── Allocation Rules ───────────────────────────────────────────────────────
router.get('/rules',               milkmanRulesController.list);
router.post('/rules',              milkmanRulesController.create);
router.post('/rules/:id/delete',   milkmanRulesController.remove);

// ── Settlements ────────────────────────────────────────────────────────────
router.get('/settlements',         milkmanSettlementsController.list);

module.exports = router;
