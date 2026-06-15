'use strict';

const { Router } = require('express');

const ProductController    = require('../controllers/ProductController');
const MemberController     = require('../controllers/MemberController');
const RuleController       = require('../controllers/RuleController');
const InvoiceController    = require('../controllers/InvoiceController');
const SplitController      = require('../controllers/SplitController');
const SettlementController = require('../controllers/SettlementController');

const router = Router();

// ── Products ──────────────────────────────────────────────────────────
router.get('/products',         ProductController.list);
router.post('/products',        ProductController.create);
router.get('/products/:id',     ProductController.get);
router.put('/products/:id',     ProductController.update);
router.delete('/products/:id',  ProductController.remove);

// ── Members ───────────────────────────────────────────────────────────
router.get('/members',          MemberController.list);
router.post('/members',         MemberController.create);
router.get('/members/:id',      MemberController.get);
router.put('/members/:id',      MemberController.update);
router.delete('/members/:id',   MemberController.remove);

// ── Allocation rules ──────────────────────────────────────────────────
router.get('/allocation-rules',         RuleController.list);
router.post('/allocation-rules',        RuleController.create);
router.get('/allocation-rules/:id',     RuleController.get);
router.put('/allocation-rules/:id',     RuleController.update);
router.delete('/allocation-rules/:id',  RuleController.remove);

// ── Invoices ──────────────────────────────────────────────────────────
router.get('/invoices',              InvoiceController.list);
router.post('/invoices',             InvoiceController.create);
router.get('/invoices/:id',          InvoiceController.get);
router.put('/invoices/:id',          InvoiceController.update);
router.patch('/invoices/:id/status', InvoiceController.setStatus);

// ── Split (communal events must be stored on the invoice beforehand) ──
router.post('/invoices/:id/split',   SplitController.split);

// ── Settlements ───────────────────────────────────────────────────────
router.get('/settlements',      SettlementController.list);
router.post('/settlements',     SettlementController.create);
router.get('/settlements/:id',  SettlementController.get);

module.exports = router;
