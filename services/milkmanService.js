'use strict';

/**
 * milkmanService is superseded by the dedicated service modules:
 *
 *   MemberService    — member CRUD
 *   ProductService   — product CRUD
 *   RuleService      — allocation rule CRUD
 *   InvoiceService   — invoice CRUD + computeSettlement
 *   SettlementService — query and aggregate settlements
 *   SplitEngine      — pure split / reconcile functions
 *
 * This file re-exports them for convenience.
 */
module.exports = {
  ...require('./MemberService'),
  ...require('./InvoiceService'),
};

